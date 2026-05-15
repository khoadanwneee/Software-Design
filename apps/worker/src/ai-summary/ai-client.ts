import { ApiError, GoogleGenAI } from "@google/genai";
import { AiSummaryProcessingError } from "./errors.js";
import { buildWorkshopPdfSummaryPrompt } from "./prompt.js";

export interface AiSummaryClient {
  summarizeWorkshopPdf(input: {
    title?: string | null;
    description?: string | null;
    pdfText: string;
    language: "vi";
  }): Promise<{
    summary: string;
    model: string;
  }>;
}

function envNumber(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function geminiModel() {
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash-lite";
}

function maxOutputTokens() {
  const maxWords = envNumber("AI_SUMMARY_MAX_OUTPUT_WORDS", 250);
  return Math.max(256, Math.ceil(maxWords * 2.2));
}

export class MockAiSummaryClient implements AiSummaryClient {
  async summarizeWorkshopPdf(input: { title?: string | null; description?: string | null; pdfText: string }) {
    const title = input.title?.trim() || "workshop";
    const excerpt = input.pdfText.slice(0, 220).replace(/\s+/g, " ").trim();
    return {
      model: "mock-ai-v1",
      summary: `Bản tóm tắt mock cho ${title}: ${excerpt}`
    };
  }
}

export class GeminiAiSummaryClient implements AiSummaryClient {
  private readonly ai: GoogleGenAI;

  constructor(
    private readonly apiKey: string,
    private readonly model = geminiModel(),
    private readonly timeoutMs = envNumber("AI_SUMMARY_TIMEOUT_MS", 30_000)
  ) {
    this.ai = new GoogleGenAI({ apiKey: this.apiKey });
  }

  async summarizeWorkshopPdf(input: {
    title?: string | null;
    description?: string | null;
    pdfText: string;
    language: "vi";
  }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: buildWorkshopPdfSummaryPrompt(input),
        config: {
          abortSignal: controller.signal,
          maxOutputTokens: maxOutputTokens(),
          temperature: 0.2
        }
      });

      return {
        model: this.model,
        summary: response.text?.trim() ?? ""
      };
    } catch (error) {
      throw normalizeGeminiError(error);
    } finally {
      clearTimeout(timer);
    }
  }
}

function normalizeGeminiError(error: unknown) {
  if (error instanceof AiSummaryProcessingError) {
    return error;
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return new AiSummaryProcessingError("AI_TIMEOUT", "Gemini request timed out", true);
  }

  if (error instanceof Error && error.name === "AbortError") {
    return new AiSummaryProcessingError("AI_TIMEOUT", "Gemini request timed out", true);
  }

  if (error instanceof ApiError) {
    if (error.status === 429) {
      return new AiSummaryProcessingError("AI_RATE_LIMITED", error.message, true);
    }
    if (error.status >= 500) {
      return new AiSummaryProcessingError("AI_PROVIDER_UNAVAILABLE", error.message, true);
    }
    return new AiSummaryProcessingError("AI_PROVIDER_ERROR", error.message, false);
  }

  if (error instanceof Error) {
    return new AiSummaryProcessingError("AI_PROVIDER_ERROR", error.message, true);
  }

  return new AiSummaryProcessingError("AI_PROVIDER_ERROR", "Gemini request failed", true);
}

export function createAiSummaryClient() {
  const provider = (process.env.AI_PROVIDER ?? "gemini").trim().toLowerCase();
  if (provider === "mock") {
    return new MockAiSummaryClient();
  }

  if (provider === "gemini") {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      throw new AiSummaryProcessingError("AI_PROVIDER_MISCONFIGURED", "GEMINI_API_KEY is required", false);
    }
    return new GeminiAiSummaryClient(apiKey);
  }

  throw new AiSummaryProcessingError("AI_PROVIDER_MISCONFIGURED", `Unsupported AI_PROVIDER: ${provider}`, false);
}
