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

function ngrokSummaryUrl() {
  return process.env.NGROK_AI_SUMMARY_URL?.trim() || process.env.AI_SUMMARY_NGROK_URL?.trim() || "";
}

function ngrokModel() {
  return process.env.NGROK_AI_SUMMARY_MODEL?.trim() || "ngrok-ai-summary";
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

export class NgrokAiSummaryClient implements AiSummaryClient {
  constructor(
    private readonly url: string,
    private readonly model = ngrokModel(),
    private readonly timeoutMs = envNumber("AI_SUMMARY_TIMEOUT_MS", 30_000),
    private readonly apiKey = process.env.NGROK_AI_SUMMARY_API_KEY?.trim() || ""
  ) {}

  async summarizeWorkshopPdf(input: {
    title?: string | null;
    description?: string | null;
    pdfText: string;
    language: "vi";
  }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.url, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          title: input.title ?? "",
          description: input.description ?? "",
          pdfText: input.pdfText,
          language: input.language,
          prompt: buildWorkshopPdfSummaryPrompt(input),
          maxOutputWords: envNumber("AI_SUMMARY_MAX_OUTPUT_WORDS", 250)
        }),
        signal: controller.signal
      });

      const payload = await readNgrokResponse(response);
      if (!response.ok) {
        throw normalizeNgrokHttpError(response, payload);
      }

      return {
        model: extractNgrokModel(payload) || this.model,
        summary: extractNgrokSummary(payload)
      };
    } catch (error) {
      throw normalizeNgrokError(error);
    } finally {
      clearTimeout(timer);
    }
  }

  private headers() {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "ngrok-skip-browser-warning": "true"
    };

    if (this.apiKey) {
      headers.authorization = `Bearer ${this.apiKey}`;
    }

    return headers;
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

function normalizeNgrokHttpError(response: Response, payload: unknown) {
  const message = extractErrorMessage(payload) || `Ngrok AI summary request failed with HTTP ${response.status}`;
  if (response.status === 408 || response.status === 504) {
    return new AiSummaryProcessingError("AI_TIMEOUT", message, true);
  }
  if (response.status === 429) {
    return new AiSummaryProcessingError("AI_RATE_LIMITED", message, true);
  }
  if (response.status >= 500) {
    return new AiSummaryProcessingError("AI_PROVIDER_UNAVAILABLE", message, true);
  }
  return new AiSummaryProcessingError("AI_PROVIDER_ERROR", message, false);
}

function normalizeNgrokError(error: unknown) {
  if (error instanceof AiSummaryProcessingError) {
    return error;
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return new AiSummaryProcessingError("AI_TIMEOUT", "Ngrok AI summary request timed out", true);
  }

  if (error instanceof Error && error.name === "AbortError") {
    return new AiSummaryProcessingError("AI_TIMEOUT", "Ngrok AI summary request timed out", true);
  }

  if (error instanceof Error) {
    return new AiSummaryProcessingError("AI_PROVIDER_ERROR", error.message, true);
  }

  return new AiSummaryProcessingError("AI_PROVIDER_ERROR", "Ngrok AI summary request failed", true);
}

async function readNgrokResponse(response: Response): Promise<unknown> {
  const rawBody = (await response.text()).trim();
  if (!rawBody) {
    return "";
  }

  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    return rawBody;
  }
}

function extractNgrokSummary(payload: unknown) {
  const summary = firstString(
    payload,
    "summary",
    "text",
    "result",
    "output",
    "content",
    "data.summary",
    "data.text",
    "data.result",
    "message.content",
    "choices.0.text",
    "choices.0.message.content"
  );

  return summary.trim();
}

function extractNgrokModel(payload: unknown) {
  return firstString(payload, "model", "data.model").trim();
}

function extractErrorMessage(payload: unknown) {
  return firstString(payload, "error", "message", "detail", "error.message").trim();
}

function firstString(payload: unknown, ...paths: string[]) {
  if (typeof payload === "string") {
    return payload;
  }

  for (const path of paths) {
    const value = getPath(payload, path);
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return "";
}

function getPath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (Array.isArray(current)) {
      const index = Number(segment);
      return Number.isInteger(index) ? current[index] : undefined;
    }

    if (isRecord(current)) {
      return current[segment];
    }

    return undefined;
  }, value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function createAiSummaryClient() {
  const provider = (process.env.AI_PROVIDER ?? "ngrok").trim().toLowerCase();
  if (provider === "mock") {
    return new MockAiSummaryClient();
  }

  if (provider === "ngrok") {
    const url = ngrokSummaryUrl();
    if (!url) {
      throw new AiSummaryProcessingError(
        "AI_PROVIDER_MISCONFIGURED",
        "NGROK_AI_SUMMARY_URL is required",
        false
      );
    }
    return new NgrokAiSummaryClient(url);
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
