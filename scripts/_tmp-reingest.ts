import "./env";
import { runIngestion } from "../src/lib/ingest";

async function main() {
  for (const id of [
    "01a1f968-6bcd-7cbd-90ce-6ea97631c3ff", // L1.pdf
    "01a1f96b-3f38-78e4-ad20-23223bbcda13", // L2.pdf
  ]) {
    console.log("ingesting", id);
    await runIngestion(id);
    console.log("done", id);
  }
}
void main().finally(() => process.exit(0));
