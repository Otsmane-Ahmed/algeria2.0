import sharp from "sharp";

/**
 * Image preprocessing for the vision model (spec 3.2 stack): auto-orient,
 * resize to <= 2000px long edge, normalize, JPEG q85. Keeps vision cost and
 * upload latency sane on phone photos.
 */
export async function preprocessImage(
  input: Buffer,
): Promise<{ jpeg: Buffer; width: number; height: number; warnings: string[] }> {
  const warnings: string[] = [];
  const meta = await sharp(input, { failOn: "none" }).metadata();
  const longEdge = Math.max(meta.width ?? 0, meta.height ?? 0);
  if (longEdge > 0 && longEdge < 600) warnings.push("low_resolution");

  const pipeline = sharp(input, { failOn: "none" })
    .rotate() // EXIF orientation
    .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
    .normalise({ lower: 2, upper: 98 })
    .jpeg({ quality: 85, mozjpeg: false });

  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  return { jpeg: data, width: info.width, height: info.height, warnings };
}

/** Quick blur/darkness heuristic used to warn before extraction (spec F1). */
export async function qualityHints(input: Buffer): Promise<string[]> {
  const hints: string[] = [];
  try {
    const stats = await sharp(input, { failOn: "none" })
      .greyscale()
      .resize({ width: 64, height: 64, fit: "inside" })
      .stats();
    const channel = stats.channels[0];
    const mean = channel?.mean ?? 128;
    const stdev = channel?.stdev ?? 64;
    if (mean < 70) hints.push("too_dark");
    if (stdev < 25) hints.push("too_flat_or_blurry");
  } catch {
    /* non-fatal: hints are advisory only */
  }
  return hints;
}
