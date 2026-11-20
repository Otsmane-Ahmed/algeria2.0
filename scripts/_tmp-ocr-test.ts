import "./env";
import { readFileSync } from "node:fs";
import { rasterizePdfPage } from "../src/lib/pdfjs";
import { ocrImages } from "../src/lib/ocr";
import { callJSON } from "../src/lib/ai/callJSON";
import { ExtractionResult, PROMPT_VERSION, build as buildExtractPrompt, JSON_SCHEMA } from "../src/lib/ai/prompts/extract.v1";

/** One-shot check: upscale + OCR of the user's real scan, then the text-extraction call. */
async function main() {
  const file =
    "data/storage/01a1f96a-ffaf-764b-a8df-48c5da6dc50c/01a1f96b-3f38-78e4-ad20-23223bbcda13/original.pdf";
  const data = readFileSync(file);
  const raster = await rasterizePdfPage(data, 1, 2000, true);
  console.log("raster:", raster ? `${raster.width}x${raster.height}` : "FAILED");
  if (!raster) return;

  const [text] = await ocrImages([raster.jpeg]);
  console.log("=== OCR TEXT (" + (text?.length ?? 0) + " chars) ===");
  console.log(text);
  if (process.argv.includes("--ocr-only")) return;

  const prompt = buildExtractPrompt({ kindHint: "transcript", locale: "fr", pageCount: 1 });
  const context = {
    declared_kind: "transcript",
    declared_filename: "L2.pdf",
    page_text: [{ page: 1, text: (text ?? "").slice(0, 4000) }],
  };
  try {
    const { data: result } = await callJSON<ExtractionResult>({
      role: "agent",
      promptId: PROMPT_VERSION,
      system: prompt.system,
      user: [{ type: "text", text: `Context: ${JSON.stringify(context)}\n\n${prompt.user}` }],
      schema: ExtractionResult,
      jsonSchema: JSON_SCHEMA,
      requestId: "test_text_path",
    });
    console.log("=== EXTRACT OK ===");
    console.log(
      JSON.stringify(
        {
          full_name_latin: result.holder.full_name_latin,
          birth_date: result.holder.birth_date,
          level: result.program.level,
          year: result.program.year,
          institution: result.institution.name,
          field_free_text: result.program.field_free_text,
          cumulative: result.cumulative,
          terms: result.terms.length,
          language: result.language,
          warnings: result.warnings,
          field_confidence: result.field_confidence,
        },
        null,
        1,
      ),
    );
  } catch (e) {
    console.log("=== EXTRACT FAIL ===", e instanceof Error ? `${e.name}: ${e.message}` : e);
  }
}

void main().finally(() => process.exit(0)); // the tesseract worker keeps the event loop alive
