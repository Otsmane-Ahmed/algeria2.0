import type { Worker } from "tesseract.js";
import sharp from "sharp";

/**
 * Local OCR fallback (no sudo, no system tesseract): tesseract.js WASM runs
 * inside Node. Used when a document is a scan — no text layer for the model,
 * and the vision call is unavailable (key scoped to a text-only model).
 *
 * Degradation contract: when anything fails (download, engine, worker), this
 * module returns empty text instead of throwing; ingestion then parks the
 * document at needs_review for manual entry. Nothing is ever invented.
 */

/** Page text this thin means the PDF is a scan: the raster has to be read, not the layer. */
export function isSparseText(text: string): boolean {
  return text.replace(/\s+/g, "").length < 120;
}

/**
 * Sideways scans (landscape content on a portrait page) OCR as symbol noise:
 * try each orientation and keep the one that reads most like real text —
 * score rewards both letter volume and density (garbage is symbol-heavy).
 * Upright pages stop after the first pass, so normal documents pay nothing.
 */
const ORIENTATIONS = [0, 90, 270, 180];
// Upright real text scores ~900+ (letters x density); a mirrored pass can
// still reach ~600, so only stop early well above that.
const GOOD_SCORE = 800;

function textScore(text: string): number {
  const letters = (text.match(/\p{L}/gu) ?? []).length;
  const chars = text.replace(/\s+/g, "").length || 1;
  return letters * (letters / chars);
}

let worker: Worker | null = null;
let starting: Promise<Worker | null> | null = null;

// fra+eng+ara: Algerian transcripts mix French/Arabic, degrees print in English.
const LANGS = ["fra", "eng", "ara"];

async function getWorker(): Promise<Worker | null> {
  if (worker) return worker;
  if (!starting) {
    starting = (async () => {
      try {
        const { createWorker } = await import("tesseract.js");
        const w = await createWorker(LANGS);
        worker = w;
        return w;
      } catch (e) {
        console.error("[ocr] worker unavailable:", e);
        starting = null; // next call may retry (first run downloads traineddata)
        return null;
      }
    })();
  }
  return starting;
}

async function recognize(w: Worker, buf: Buffer): Promise<string> {
  try {
    const { data } = await w.recognize(buf);
    return data.text ?? "";
  } catch (e) {
    console.error("[ocr] recognize failed:", e);
    return "";
  }
}

/**
 * OCR image buffers sequentially (one worker, one job at a time).
 * Returns "" per image on failure so callers can decide, never throws.
 */
export async function ocrImages(bufs: Buffer[]): Promise<string[]> {
  const w = await getWorker();
  if (!w) return bufs.map(() => "");
  const out: string[] = [];
  for (const buf of bufs) {
    let best = "";
    let bestScore = -1;
    for (const deg of ORIENTATIONS) {
      const img = deg === 0 ? buf : await sharp(buf).rotate(deg).jpeg().toBuffer();
      const text = await recognize(w, img);
      const score = textScore(text);
      console.log(`[ocr] orientation=${deg} score=${score} chars=${text.length}`);
      if (score > bestScore) {
        best = text;
        bestScore = score;
      }
      if (score >= GOOD_SCORE) break;
    }
    out.push(best);
  }
  return out;
}
