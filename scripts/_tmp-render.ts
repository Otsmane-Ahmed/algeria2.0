import "./env";
import { readFileSync, writeFileSync } from "node:fs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

async function main() {
  const fileArg = process.argv[2];
  const outArg = process.argv[3];
  if (!fileArg || !outArg) throw new Error("usage: _tmp-render.ts <pdf> <out.jpg>");
  const data = readFileSync(fileArg);
  const out = outArg;
  const doc = await getDocument({ data: new Uint8Array(data), useSystemFonts: false, verbosity: 0 }).promise;
  const page = await doc.getPage(1);
  const base = page.getViewport({ scale: 1 });
  console.log("page points:", base.width, "x", base.height, "rotation:", page.rotate, "pages:", doc.numPages);
  const viewport = page.getViewport({ scale: 2.6 });
  const { createCanvas } = await import("@napi-rs/canvas");
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas: null, canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport }).promise;
  writeFileSync(out, canvas.toBuffer("image/jpeg", 90));
  console.log("wrote", out, canvas.width + "x" + canvas.height);
}
void main();
