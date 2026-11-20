import { z } from "zod";
import { ApiError, errorResponse, ok, readBody } from "@/lib/http";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { uuidv7 } from "@/lib/core/ids";
import { and, desc, eq } from "drizzle-orm";
import {
  ALLOWED_MIME,
  MAX_UPLOAD_BYTES,
  putFile,
  sha256,
  sniffMime,
  storageKey,
} from "@/lib/storage";
import { runIngestion } from "@/lib/ingest";

/**
 * POST /api/documents — multipart upload (spec F1).
 *
 * The spec's two-step upload-url/complete flow exists for presigned S3 URLs;
 * this build stores to the local filesystem, so the file arrives directly and
 * processing is enqueued in-process right away (README documents the deviation).
 *
 * Security: MIME sniffed from magic bytes (never the client header), size cap,
 * per-user key prefix, dedupe by sha256 within a user.
 */

const MAX_UPLOAD = MAX_UPLOAD_BYTES;

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw ApiError.unauthenticated();

    const form = await req.formData().catch(() => null);
    if (!form) {
      throw ApiError.validation([{ path: "(root)", message: "Expected multipart/form-data" }]);
    }

    const file = form.get("file");
    const kindRaw = form.get("kind");
    if (!(file instanceof File)) {
      throw ApiError.validation([{ path: "file", message: "A file is required" }]);
    }
    if (file.size > MAX_UPLOAD) {
      throw new ApiError("file_too_large", 413, `Maximum ${Math.round(MAX_UPLOAD / 1048576)} MB`);
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const mime = sniffMime(buf);
    if (!mime || !ALLOWED_MIME.has(mime)) {
      throw new ApiError("unsupported_media", 415, "Only JPEG, PNG, WebP, HEIC or PDF files are accepted.");
    }

    const kind = z
      .enum([
        "transcript",
        "diploma",
        "bac",
        "cv",
        "passport",
        "id_card",
        "language_cert",
        "recommendation",
        "motivation_letter",
        "birth_certificate",
        "bank_statement",
        "other",
      ])
      .catch("other")
      .parse(typeof kindRaw === "string" ? kindRaw : "transcript");

    const digest = sha256(buf);
    // Dedupe is per user: without the owner filter a file another account
    // already uploaded 409s here, telling the caller it exists when it doesn't.
    const dupes = await db
      .select({ id: documents.id })
      .from(documents)
      .where(and(eq(documents.sha256, digest), eq(documents.userId, user.id)))
      .limit(1);
    if (dupes[0]) {
      throw ApiError.conflict("You already uploaded this exact file.");
    }

    const id = uuidv7();
    const key = storageKey(user.id, id, mime === "application/pdf" ? "original.pdf" : `original${mime === "image/png" ? ".png" : mime === "image/webp" ? ".webp" : mime === "image/heic" ? ".heic" : ".jpg"}`);
    await putFile(key, buf);

    await db.insert(documents).values({
      id,
      userId: user.id,
      kind,
      originalFilename: file.name?.slice(0, 200) || null,
      mime,
      sizeBytes: buf.byteLength,
      storageKey: key,
      sha256: digest,
      status: "uploaded",
    });

    // In-process job (no queue in P0): fire and forget, status is polled.
    void runIngestion(id).catch((e) => console.error(`[ingest] ${id}:`, e));

    return ok({ document_id: id, status: "uploaded" }, { status: 202 });
  } catch (e) {
    return errorResponse(req, e);
  }
}

const ListSchema = z.object({
  kind: z.string().max(40).optional(),
});

/** GET /api/documents?kind= — list the caller's documents (spec 8.3). */
export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw ApiError.unauthenticated();
    const url = new URL(req.url);
    const kind = url.searchParams.get("kind") ?? undefined;

    const conds = [eq(documents.userId, user.id)];
    if (kind) conds.push(eq(documents.kind, kind));
    const rows = await db
      .select()
      .from(documents)
      .where(and(...conds))
      .orderBy(desc(documents.createdAt))
      .limit(100);

    const mine = rows;
    return ok({
      items: mine.map((d) => ({
        id: d.id,
        kind: d.kind,
        filename: d.originalFilename,
        mime: d.mime,
        size_bytes: d.sizeBytes,
        page_count: d.pageCount,
        status: d.status,
        error_code: d.errorCode,
        created_at: d.createdAt,
        updated_at: d.updatedAt,
      })),
    });
  } catch (e) {
    return errorResponse(req, e);
  }
}
