import { randomBytes } from "node:crypto";

/**
 * UUIDv7: 48-bit big-endian unix-ms timestamp + version 7 + variant + 62 random bits.
 * Time-sortable ids without a DB extension (spec §0.3).
 */
export function uuidv7(atMs: number = Date.now()): string {
  const bytes = randomBytes(16);
  // 48-bit big-endian timestamp in bytes 0-5; bytes 6-7 stay random (rand_a)
  bytes.writeUIntBE(atMs, 0, 6);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70; // version 7
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80; // RFC 4122 variant
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
