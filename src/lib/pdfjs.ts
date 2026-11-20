import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

/**
 * PDF ingestion (spec F1/F2): page count, text layer, and page rasterization
 * for the vision model. pdfjs runs in Node; rasterization uses @napi-rs/canvas.
 */

export type PdfPageInfo = {
  pageNo: number;
  width: number;
  height: number;
  text: string;
};

export type PdfInfo = {
  pageCount: number;
  encrypted: boolean;
  pages: PdfPageInfo[];
};

function open(data: Buffer) {
  return getDocument({
    data: new Uint8Array(data),
    // Never let a PDF reach out to the network (spec 12.2 SSRF control):
    // external streams/URLs are simply not provided.
    useSystemFonts: false,
    verbosity: 0,
  });
}

/** Read page count + text layer of every page (capped at maxPages). */
export async function readPdf(data: Buffer, maxPages: number): Promise<PdfInfo> {
  const loadingTask = open(data);
  try {
    const doc = await loadingTask.promise;
    const pageCount = doc.numPages;
    const pages: PdfPageInfo[] = [];
    const n = Math.min(pageCount, maxPages);
    for (let i = 1; i <= n; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const text = content.items
        .map((it) => ("str" in it ? it.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      pages.push({
        pageNo: i,
        width: Math.round(viewport.width),
        height: Math.round(viewport.height),
        text,
      });
      page.cleanup();
    }
    return { pageCount, encrypted: false, pages };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/password|encrypt/i.test(msg)) {
      return { pageCount: 0, encrypted: true, pages: [] };
    }
    throw e;
  } finally {
    await loadingTask.destroy().catch(() => undefined);
  }
}

/** Rasterize one PDF page to a JPEG buffer (vision model input). */
export async function rasterizePdfPage(
  data: Buffer,
  pageNo: number,
  maxEdge = 2000,
): Promise<{ jpeg: Buffer; width: number; height: number } | null> {
  const loadingTask = open(data);
  try {
    const doc = await loadingTask.promise;
    if (pageNo < 1 || pageNo > doc.numPages) return null;
    const page = await doc.getPage(pageNo);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.max(Math.min(1, maxEdge / Math.max(base.width, base.height)), 0.5);
    const viewport = page.getViewport({ scale });

    const { createCanvas } = await import("@napi-rs/canvas");
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({
      canvas: null,
      canvasContext: ctx as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;
    const jpeg = canvas.toBuffer("image/jpeg", 85);
    page.cleanup();
    return { jpeg, width: canvas.width, height: canvas.height };
  } catch {
    return null;
  } finally {
    await loadingTask.destroy().catch(() => undefined);
  }
}
