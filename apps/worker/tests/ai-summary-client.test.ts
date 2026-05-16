import { afterEach, describe, expect, it, vi } from "vitest";
import { AiSummaryProcessingError } from "../src/ai-summary/errors";
import { MockAiSummaryClient, NgrokAiSummaryClient, createAiSummaryClient } from "../src/ai-summary/ai-client";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllGlobals();
});

describe("AI summary client selection", () => {
  it("uses the deterministic mock provider when configured", async () => {
    process.env.AI_PROVIDER = "mock";

    const client = createAiSummaryClient();
    expect(client).toBeInstanceOf(MockAiSummaryClient);
    await expect(
      client.summarizeWorkshopPdf({
        title: "AI Career Starter",
        description: "",
        pdfText: "Nội dung workshop về AI.",
        language: "vi"
      })
    ).resolves.toMatchObject({ model: "mock-ai-v1" });
  });

  it("fails clearly when Gemini is configured without an API key", () => {
    process.env.AI_PROVIDER = "gemini";
    delete process.env.GEMINI_API_KEY;

    try {
      createAiSummaryClient();
      throw new Error("Expected createAiSummaryClient to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(AiSummaryProcessingError);
      expect(error).toMatchObject({
        code: "AI_PROVIDER_MISCONFIGURED",
        retryable: false
      });
    }
  });

  it("uses the ngrok provider when configured", async () => {
    process.env.AI_PROVIDER = "ngrok";
    process.env.NGROK_AI_SUMMARY_URL = "https://example.ngrok-free.app/summarize";

    let capturedRequestInit: RequestInit | undefined;
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      capturedRequestInit = init;
      return new Response(JSON.stringify({ model: "local-summary-model", summary: "Tóm tắt từ ngrok." }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createAiSummaryClient();
    expect(client).toBeInstanceOf(NgrokAiSummaryClient);

    await expect(
      client.summarizeWorkshopPdf({
        title: "AI Career Starter",
        description: "",
        pdfText: "Nội dung workshop về AI.",
        language: "vi"
      })
    ).resolves.toMatchObject({
      model: "local-summary-model",
      summary: "Tóm tắt từ ngrok."
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.ngrok-free.app/summarize",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "content-type": "application/json",
          "ngrok-skip-browser-warning": "true"
        })
      })
    );

    if (!capturedRequestInit?.body) {
      throw new Error("Expected ngrok summary request body");
    }

    const requestBody = JSON.parse(String(capturedRequestInit.body));
    expect(requestBody).toMatchObject({
      title: "AI Career Starter",
      language: "vi",
      pdfText: "Nội dung workshop về AI."
    });
    expect(requestBody.prompt).toContain("AI Career Starter");
  });

  it("fails clearly when ngrok is configured without a URL", () => {
    process.env.AI_PROVIDER = "ngrok";
    delete process.env.NGROK_AI_SUMMARY_URL;
    delete process.env.AI_SUMMARY_NGROK_URL;

    try {
      createAiSummaryClient();
      throw new Error("Expected createAiSummaryClient to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(AiSummaryProcessingError);
      expect(error).toMatchObject({
        code: "AI_PROVIDER_MISCONFIGURED",
        retryable: false
      });
    }
  });
});
