import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile, stat } from "node:fs/promises";
import path from "node:path";

/**
 * Local filesystem storage (spec asks for S3-compatible buckets; README
 * documents the deviation). Layout: data/storage/<userId>/<documentId>/<file>.
 * Files are never served statically: every read goes through an authenticated
 * route handler, so there is no signed-URL expiry to manage.
 */

export const STORAGE_ROOT = path.join(process.cwd(), "data", "storage");
export const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_MB ?? 15) * 1024 * 1024;
export const MAX_PAGES = Number(process.env.MAX_PAGES_PER_DOC ?? 8);

export const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
]);

export function storageKey(userId: string, documentId: string, filename: string): string {
  return path.join(userId, documentId, filename);
}

function resolveKey(key: string): string {
  const abs = path.resolve(STORAGE_ROOT, key);
  // Reject any traversal outside the storage root.
  if (abs !== STORAGE_ROOT && !abs.startsWith(STORAGE_ROOT + path.sep)) {
    throw new Error("invalid storage key");
  }
  return abs;
}

export async function putFile(key: string, data: Buffer | Uint8Array): Promise<number> {
  const abs = resolveKey(key);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, data);
  return data.byteLength;
}

export async function getFile(key: string): Promise<Buffer> {
  return readFile(resolveKey(key));
}

export async function fileExists(key: string): Promise<boolean> {
  try {
    await stat(resolveKey(key));
    return true;
  } catch {
    return false;
  }
}

export async function deletePrefix(userId: string, documentId: string): Promise<void> {
  await rm(path.join(STORAGE_ROOT, userId, documentId), { recursive: true, force: true });
}

/** SHA-256 of the upload, used for the per-user dedupe index. */
export function sha256(data: Buffer | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * MIME sniffing from magic bytes (spec 12.2: never trust the client's
 * Content-Type). Returns the detected type or null when it is not a type we
 * accept.
 */
export function sniffMime(data: Buffer): string | null {
  if (data.length < 12) return null;
  const b = data.subarray(0, 12);
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46) return "image/webp";
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "application/pdf";
  // HEIC/HEIF: ftyp box at offset 4
  if (b.subarray(4, 8).toString("latin1") === "ftyp") return "image/heic";
  return null;
}
