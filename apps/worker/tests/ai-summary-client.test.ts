import { afterEach, describe, expect, it } from "vitest";
import { AiSummaryProcessingError } from "../src/ai-summary/errors";
import { MockAiSummaryClient, createAiSummaryClient } from "../src/ai-summary/ai-client";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
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
});
