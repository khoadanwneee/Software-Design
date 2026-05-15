export class AiSummaryProcessingError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable = false
  ) {
    super(message);
  }
}

export function toAiSummaryError(error: unknown): AiSummaryProcessingError {
  if (error instanceof AiSummaryProcessingError) {
    return error;
  }
  if (error instanceof Error) {
    return new AiSummaryProcessingError("AI_SUMMARY_FAILED", error.message, true);
  }
  return new AiSummaryProcessingError("AI_SUMMARY_FAILED", "AI summary failed", true);
}
