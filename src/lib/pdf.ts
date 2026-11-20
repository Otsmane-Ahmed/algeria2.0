/**
 * Minimal PDF writer for the plan export (spec F8).
 *
 * Hand-rolled because @react-pdf/renderer does not load under Next ESM here
 * (documented deviation in README). Uses Helvetica with WinAnsiEncoding, which
 * covers fr/en. Arabic has no RTL shaping in this renderer, so the `ar` route
 * 302-redirects to the printable HTML view instead of calling this module.
 */

type TextOp = { text: string; size?: number; gap?: number; bold?: boolean };

const PAGE_W = 595.28; // A4 portrait, points
const PAGE_H = 841.89;
const MARGIN_X = 56;
const MARGIN_TOP = 64;
const MARGIN_BOTTOM = 56;

function esc(s: string): string {
  // WinAnsi: keep Latin-1, replace anything outside with '?'
  let out = "";
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 63;
    if (ch === "\\" || ch === "(" || ch === ")") out += "\\" + ch;
    else if (code >= 32 && code <= 255) out += ch;
    else out += "?";
  }
  return out;
}

/** Rough Helvetica advance width (per 1000 units) — good enough for wrapping. */
function textWidth(s: string, size: number): number {
  let units = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 32;
    if (c === 32) units += 278;
    else if (c >= 48 && c <= 57) units += 556;
    else if (ch === ch.toUpperCase() && /[A-Z]/.test(ch)) units += 667;
    else units += 556;
  }
  return (units / 1000) * size;
}

function wrap(text: string, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (textWidth(next, size) > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

type Page = { ops: string[]; y: number };

export function buildPdf(title: string, blocks: TextOp[]): Uint8Array {
  const maxWidth = PAGE_W - MARGIN_X * 2;
  const pages: Page[] = [];
  let page: Page = { ops: [], y: PAGE_H - MARGIN_TOP };

  const newPage = () => {
    pages.push(page);
    page = { ops: [], y: PAGE_H - MARGIN_TOP };
  };

  for (const b of blocks) {
    const size = b.size ?? 10.5;
    const leading = size * 1.45;
    const lines: string[] = [];
    for (const para of b.text.split("\n")) {
      if (para === "") lines.push("");
      else lines.push(...wrap(para, size, maxWidth));
    }
    for (const line of lines) {
      if (page.y - leading < MARGIN_BOTTOM) newPage();
      page.y -= leading;
      const font = b.bold ? "/F2" : "/F1";
      page.ops.push(
        `BT ${font} ${size} Tf 1 0 0 1 ${MARGIN_X} ${page.y.toFixed(2)} Tm (${esc(line)}) Tj ET`,
      );
    }
    if (b.gap) {
      page.y -= b.gap;
      if (page.y < MARGIN_BOTTOM) newPage();
    }
  }
  pages.push(page);

  // --- assemble objects ---
  const objects: string[] = [];
  const add = (body: string) => {
    objects.push(body);
    return objects.length; // 1-based object number
  };

  const fontRegular = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const fontBold = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");

  const contentIds: number[] = [];
  for (const p of pages) {
    const stream = p.ops.join("\n");
    contentIds.push(add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`));
  }

  const pagesId = objects.length + pages.length + 1;
  const pageIds: number[] = [];
  for (let i = 0; i < pages.length; i++) {
    pageIds.push(
      add(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
          `/Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> ` +
          `/Contents ${contentIds[i]} 0 R >>`,
      ),
    );
  }
  add(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);
  const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  const infoId = add(`<< /Title (${esc(title)}) /Producer (SAFAR) >>`);

  let out = "%PDF-1.4\n";
  const offsets: number[] = [0];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefPos = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    out += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;

  // Latin-1 bytes
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return bytes;
}
