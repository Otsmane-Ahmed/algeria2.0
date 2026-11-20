import { and, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { documentPages, documents, extractions, academicTerms } from "./db/schema";
import { uuidv7 } from "./core/ids";
import { getFile, MAX_PAGES } from "./storage";
import { qualityHints, preprocessImage } from "./image";
import { readPdf, rasterizePdfPage } from "./pdfjs";
import { getCapabilities, aiReady } from "./ai/capabilities";
import { callJSON } from "./ai/callJSON";
import { ExtractionResult, PROMPT_VERSION, build as buildExtractPrompt, JSON_SCHEMA } from "./ai/prompts/extract.v1";
import { AiUnavailable, AiOutputInvalid } from "./ai/errors";
import { sanityCheckTerms } from "./core/extraction/postprocess";
import { isSparseText, ocrImages } from "./ocr";

/**
 * Document ingestion + extraction (spec F1/F2), run in-process (the spec's
 * Inngest/BullMQ queue is out of scope for P0; README documents this).
 *
 * Status flow: uploaded -> processing -> extracted | needs_review | failed
 * - With AI: try the vision model first. When it rejects the images (keys
 *   scoped to a text-only model are common), fall back to TEXT extraction:
 *   the PDF's own text layer, or local OCR (tesseract.js WASM) when the file
 *   is a scan. Either way a successful read lands as a pending_review
 *   extraction the review panel can accept.
 * - Without AI (no key, or a key whose model cannot see images): PDFs with a
 *   text layer still get their text stored (deterministic path); scans and
 *   photos park at needs_review with error_code ai_unavailable, and the review
 *   panel offers manual entry. Nothing is ever invented.
 */

export async function runIngestion(documentId: string): Promise<void> {
  const rows = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
  const doc = rows[0];
  if (!doc || doc.status === "confirmed") return;

  try {
    await db
      .update(documents)
      .set({ status: "processing", errorCode: null, updatedAt: new Date() })
      .where(eq(documents.id, documentId));

    const data = await getFile(doc.storageKey);
    const pages: { pageNo: number; text: string; width: number | null; height: number | null }[] = [];
    let pageCount: number | null = null;
    const isPdf = doc.mime === "application/pdf";

    if (isPdf) {
      const info = await readPdf(data, MAX_PAGES);
      if (info.encrypted) {
        await fail(documentId, "pdf_encrypted");
        return;
      }
      pageCount = info.pageCount;
      for (const p of info.pages) {
        pages.push({ pageNo: p.pageNo, text: p.text, width: p.width, height: p.height });
      }
    } else {
      // Single image: no text layer, but record dimensions + quality hints.
      const pre = await preprocessImage(data);
      pages.push({ pageNo: 1, text: "", width: pre.width, height: pre.height });
      pageCount = 1;
      const hints = await qualityHints(data);
      if (hints.includes("too_dark") || hints.includes("too_flat_or_blurry")) {
        await db
          .update(documents)
          .set({ languageDetected: null, updatedAt: new Date() })
          .where(eq(documents.id, documentId));
      }
    }

    // Persist page rows (text lives on pages, not in extractions.raw — spec 12.3).
    await db.delete(documentPages).where(eq(documentPages.documentId, documentId));
    for (const p of pages) {
      await db.insert(documentPages).values({
        id: uuidv7(),
        documentId,
        pageNo: p.pageNo,
        imageKey: `${doc.storageKey}#page-${p.pageNo}`,
        ocrText: p.text || null,
        width: p.width,
        height: p.height,
      });
    }

    await db
      .update(documents)
      .set({ pageCount, updatedAt: new Date() })
      .where(eq(documents.id, documentId));

    let caps = await getCapabilities();
    // A transient probe failure (first models.list after boot) must not
    // silently skip AI for this document: force one fresh probe.
    if (!aiReady(caps) && process.env.AIGRID_API_KEY) caps = await getCapabilities(true);
    if (!aiReady(caps)) {
      await textFallback(documentId, pages, isPdf);
      return;
    }

    try {
      await extractWithVision(doc, data, isPdf, pages, pageCount);
    } catch (e) {
      // Vision rejected (text-only key, quota, outage): read the text instead
      // — OCR when the file is a scan — rather than dead-ending the document.
      if (e instanceof AiUnavailable || e instanceof AiOutputInvalid) {
        const cause = e instanceof AiOutputInvalid ? "ai_output_invalid" : "ai_unavailable";
        await extractWithText(doc, data, isPdf, pages, pageCount, cause);
      } else throw e;
    }
  } catch (e) {
    if (e instanceof AiUnavailable) {
      await fail(documentId, "ai_unavailable");
    } else if (e instanceof AiOutputInvalid) {
      await fail(documentId, "ai_output_invalid");
    } else {
      console.error(`[ingest] ${documentId} failed:`, e);
      await fail(documentId, "internal");
    }
  }
}

/**
 * Deterministic park: keep whatever text the PDF gave us, else flag why
 * nothing was read. `code` overrides the inferred reason when a caller
 * already knows it (the vision/text failure that led here). Retry re-runs
 * ingestion, so this is a recoverable state, not a dead end.
 */
async function textFallback(
  documentId: string,
  pages: { text: string }[],
  isPdf: boolean,
  code?: string,
): Promise<void> {
  const joined = pages.map((p) => p.text).filter(Boolean).join("\n");
  const read = isPdf && joined.length > 40;
  await db
    .update(documents)
    .set({
      status: "needs_review",
      errorCode: code ?? (read ? null : "ai_unavailable"),
      updatedAt: new Date(),
    })
    .where(eq(documents.id, documentId));
}

async function fail(documentId: string, code: string) {
  await db
    .update(documents)
    .set({ status: "failed", errorCode: code, updatedAt: new Date() })
    .where(eq(documents.id, documentId));
}

function extractContext(doc: typeof documents.$inferSelect, pages: { pageNo: number; text: string }[]) {
  return {
    declared_kind: doc.kind,
    declared_filename: doc.originalFilename ?? null,
    page_text: pages.map((p) => ({ page: p.pageNo, text: p.text.slice(0, 4000) })),
  };
}

async function extractWithVision(
  doc: typeof documents.$inferSelect,
  data: Buffer,
  isPdf: boolean,
  pages: { pageNo: number; text: string }[],
  pageCount: number | null,
) {
  // Build image parts: rasterized PDF pages, or the preprocessed photo.
  const parts: { type: "image_url"; image_url: { url: string } }[] = [];
  if (isPdf) {
    const n = Math.min(pageCount ?? 1, MAX_PAGES);
    for (let i = 1; i <= n; i++) {
      const raster = await rasterizePdfPage(data, i);
      if (raster) {
        parts.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${raster.jpeg.toString("base64")}` } });
      }
    }
  } else {
    const pre = await preprocessImage(data);
    parts.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${pre.jpeg.toString("base64")}` } });
  }
  if (parts.length === 0) {
    const joined = pages.map((p) => p.text).filter(Boolean).join("\n");
    if (joined.length > 40) {
      await db
        .update(documents)
        .set({ status: "needs_review", errorCode: null, updatedAt: new Date() })
        .where(eq(documents.id, doc.id));
      return;
    }
    await fail(doc.id, "ai_unavailable");
    return;
  }

  const prompt = buildExtractPrompt({
    kindHint: doc.kind,
    locale: "fr",
    pageCount: parts.length,
  });

  const { data: result } = await callJSON<ExtractionResult>({
    role: "vision",
    promptId: PROMPT_VERSION,
    system: prompt.system,
    user: [
      { type: "text", text: `Context: ${JSON.stringify(extractContext(doc, pages))}\n\n${prompt.user}` },
      ...parts,
    ],
    schema: ExtractionResult,
    jsonSchema: JSON_SCHEMA,
    userId: doc.userId,
    requestId: `ingest_${doc.id}`,
  });

  await storeExtraction(doc, result, "vision");
}

/**
 * Text path: the model reads extracted text instead of images. This is what
 * makes scans work when the vision call is unavailable — the text comes from
 * local OCR. Failures park at needs_review (recoverable, manual entry);
 * unexpected errors propagate to runIngestion's catch.
 */
async function extractWithText(
  doc: typeof documents.$inferSelect,
  data: Buffer,
  isPdf: boolean,
  pages: { pageNo: number; text: string; width: number | null; height: number | null }[],
  pageCount: number | null,
  cause: string,
): Promise<void> {
  try {
    const readable = await readablePages(doc, data, isPdf, pages, pageCount);
    const joined = readable.map((p) => p.text).filter(Boolean).join("\n");
    if (isSparseText(joined)) {
      // Neither the layer nor OCR produced anything: manual entry.
      await textFallback(doc.id, pages, isPdf, cause);
      return;
    }

    const prompt = buildExtractPrompt({
      kindHint: doc.kind,
      locale: "fr",
      pageCount: readable.length,
    });

    const { data: result } = await callJSON<ExtractionResult>({
      role: "agent",
      promptId: PROMPT_VERSION,
      system: prompt.system,
      user: [{ type: "text", text: `Context: ${JSON.stringify(extractContext(doc, readable))}\n\n${prompt.user}` }],
      schema: ExtractionResult,
      jsonSchema: JSON_SCHEMA,
      userId: doc.userId,
      requestId: `ingest_text_${doc.id}`,
    });

    await storeExtraction(doc, result, "text");
  } catch (e) {
    if (e instanceof AiOutputInvalid) return textFallback(doc.id, pages, isPdf, "ai_output_invalid");
    if (e instanceof AiUnavailable) return textFallback(doc.id, pages, isPdf, "ai_unavailable");
    throw e;
  }
}

/**
 * Best available text per page: the PDF's own layer when it has one, else
 * local OCR of the rendered pages (a scan has no layer to read). OCR text is
 * written back to the page rows so the review panel can show what was read.
 */
async function readablePages(
  doc: typeof documents.$inferSelect,
  data: Buffer,
  isPdf: boolean,
  pages: { pageNo: number; text: string; width: number | null; height: number | null }[],
  pageCount: number | null,
): Promise<{ pageNo: number; text: string }[]> {
  const joined = pages.map((p) => p.text).filter(Boolean).join("\n");
  if (!isSparseText(joined)) return pages;

  const targets: { pageNo: number; buf: Buffer }[] = [];
  if (isPdf) {
    const n = Math.min(pageCount ?? 1, MAX_PAGES);
    for (let i = 1; i <= n; i++) {
      const raster = await rasterizePdfPage(data, i, 2000, true); // up=true: OCR needs ~150+ dpi
      if (raster) targets.push({ pageNo: i, buf: raster.jpeg });
    }
  } else {
    const pre = await preprocessImage(data);
    targets.push({ pageNo: 1, buf: pre.jpeg });
  }

  const texts = await ocrImages(targets.map((t) => t.buf));
  const byPage = new Map(targets.map((t, i) => [t.pageNo, (texts[i] ?? "").trim()]));
  const filled = pages.map((p) => ({ pageNo: p.pageNo, text: byPage.get(p.pageNo) || p.text }));
  if (isSparseText(filled.map((p) => p.text).filter(Boolean).join("\n"))) return pages;

  for (let i = 0; i < filled.length; i++) {
    const next = filled[i];
    const prev = pages[i];
    if (!next || !prev || next.text === prev.text) continue;
    await db
      .update(documentPages)
      .set({ ocrText: next.text || null })
      .where(and(eq(documentPages.documentId, doc.id), eq(documentPages.pageNo, next.pageNo)));
  }
  return filled;
}

/** Validate (spec §9.1), store the extraction + terms, and flag for review. */
async function storeExtraction(
  doc: typeof documents.$inferSelect,
  result: ExtractionResult,
  model: string,
): Promise<void> {
  // Post-processing: sanity-check term averages against course rows (spec F2.4).
  const warnings = [...result.warnings];
  const check = sanityCheckTerms(
    result.terms.map((tm) => ({
      average_20: tm.average_20,
      courses: tm.courses.map((c) => ({
        name: c.name,
        grade_20: c.grade_20,
        coef: c.coef,
        credits: c.credits,
      })),
    })),
    result.cumulative.average_20,
  );
  warnings.push(...check.warnings);

  const extractionId = uuidv7();
  await db.insert(extractions).values({
    id: extractionId,
    documentId: doc.id,
    userId: doc.userId,
    model,
    promptId: PROMPT_VERSION,
    raw: result as unknown as Record<string, unknown>,
    fieldConfidence: result.field_confidence,
    warnings: [...new Set(warnings)],
    status: "pending_review",
  });

  // Store extracted terms as academic rows (spec 5: academic_terms).
  const oldExtractionIds = await db
    .select({ id: extractions.id })
    .from(extractions)
    .where(eq(extractions.documentId, doc.id));
  if (oldExtractionIds.length) {
    await db
      .delete(academicTerms)
      .where(inArray(academicTerms.extractionId, oldExtractionIds.map((r) => r.id)));
  }
  for (const term of result.terms) {
    await db.insert(academicTerms).values({
      id: uuidv7(),
      userId: doc.userId,
      extractionId,
      academicYear: term.academic_year,
      levelLabel: term.term_label,
      termLabel: term.term_label,
      average20: term.average_20,
      creditsEarned: term.credits_earned,
      creditsTotal: term.credits_total,
      result: term.result,
      courses: term.courses as unknown[],
    });
  }

  await db
    .update(documents)
    .set({
      status: "needs_review",
      errorCode: null,
      languageDetected: result.language,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, doc.id));
}
