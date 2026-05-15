import { PDFParse } from "pdf-parse";
import { AiSummaryProcessingError } from "./errors.js";

export async function extractPdfText(buffer: Buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text ?? "";
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF parse failed";
    throw new AiSummaryProcessingError("PDF_PARSE_FAILED", message, false);
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}
