import type { Job } from "bullmq";
import { AiSummaryStatus, localObjectStorage, prisma } from "@unihub/db";
import { cleanPdfText } from "./clean.js";
import { AiSummaryProcessingError, toAiSummaryError } from "./errors.js";
import { extractPdfText } from "./extract.js";
import { createAiSummaryClient, type AiSummaryClient } from "./ai-client.js";
import { AI_SUMMARY_PROMPT_VERSION, isInsufficientContentSummary } from "./prompt.js";

const MIN_EXTRACTABLE_TEXT_CHARS = 80;

export interface AiSummaryJobData {
  workshopId?: string;
  uploadedFileId?: string;
  aiSummaryId?: string;
  requestedBy?: string;
  summaryId?: string;
}

function aiSummaryIdFromJob(job: Job<AiSummaryJobData>) {
  return job.data.aiSummaryId ?? job.data.summaryId;
}

function jobAttempt(job: Job<AiSummaryJobData>) {
  return job.attemptsMade + 1;
}

function maxAttempts(job: Job<AiSummaryJobData>) {
  return typeof job.opts.attempts === "number" && job.opts.attempts > 0 ? job.opts.attempts : 1;
}

function logAiSummary(level: "info" | "warn" | "error", payload: Record<string, unknown>) {
  const message = JSON.stringify({ component: "ai-summary-worker", ...payload });
  if (level === "error") {
    console.error(message);
  } else if (level === "warn") {
    console.warn(message);
  } else {
    console.log(message);
  }
}

async function markFailed(aiSummaryId: string, error: AiSummaryProcessingError) {
  await prisma.aiSummary.update({
    where: { id: aiSummaryId },
    data: {
      status: AiSummaryStatus.FAILED,
      errorMessage: `${error.code}: ${error.message}`,
      completedAt: new Date()
    }
  });
}

export async function processAiSummaryJob(job: Job<AiSummaryJobData>, client?: AiSummaryClient) {
  const aiSummaryId = aiSummaryIdFromJob(job);
  if (!aiSummaryId) {
    throw new AiSummaryProcessingError("AI_SUMMARY_JOB_INVALID", "Missing aiSummaryId in job payload", false);
  }

  const summary = await prisma.aiSummary.findUnique({
    where: { id: aiSummaryId },
    include: {
      uploadedFile: true,
      workshop: true
    }
  });

  if (!summary || summary.status === AiSummaryStatus.DONE) {
    return;
  }

  await prisma.aiSummary.update({
    where: { id: aiSummaryId },
    data: {
      status: AiSummaryStatus.PROCESSING,
      errorMessage: null,
      startedAt: new Date(),
      attemptCount: { increment: 1 }
    }
  });

  const attempt = jobAttempt(job);
  const context = {
    jobId: job.id,
    aiSummaryId,
    uploadedFileId: summary.uploadedFileId,
    workshopId: summary.workshopId,
    attempt
  };

  try {
    const pdfBuffer = await localObjectStorage.readObject(summary.uploadedFile.storageKey);
    const rawText = await extractPdfText(pdfBuffer);
    const cleanedText = cleanPdfText(rawText);

    if (cleanedText.length < MIN_EXTRACTABLE_TEXT_CHARS) {
      throw new AiSummaryProcessingError("NO_EXTRACTABLE_TEXT", "PDF does not contain enough extractable text", false);
    }

    const aiClient = client ?? createAiSummaryClient();
    const aiResult = await aiClient.summarizeWorkshopPdf({
      title: summary.workshop.title,
      description: summary.workshop.description,
      pdfText: cleanedText,
      language: "vi"
    });

    const generatedSummary = aiResult.summary.trim();
    if (!generatedSummary) {
      throw new AiSummaryProcessingError("AI_EMPTY_RESPONSE", "AI provider returned an empty summary", true);
    }
    if (isInsufficientContentSummary(generatedSummary)) {
      throw new AiSummaryProcessingError("INSUFFICIENT_CONTENT", "AI provider reported insufficient content", false);
    }

    await prisma.aiSummary.update({
      where: { id: aiSummaryId },
      data: {
        status: AiSummaryStatus.DONE,
        summary: generatedSummary,
        errorMessage: null,
        model: aiResult.model,
        promptVersion: summary.promptVersion ?? AI_SUMMARY_PROMPT_VERSION,
        completedAt: new Date()
      }
    });

    logAiSummary("info", { ...context, status: "DONE", model: aiResult.model });
  } catch (error) {
    const aiError = toAiSummaryError(error);
    const finalAttempt = attempt >= maxAttempts(job);
    logAiSummary(aiError.retryable && !finalAttempt ? "warn" : "error", {
      ...context,
      errorCode: aiError.code,
      retryable: aiError.retryable,
      finalAttempt
    });

    if (aiError.retryable && !finalAttempt) {
      throw aiError;
    }

    await markFailed(aiSummaryId, aiError);
    if (aiError.retryable) {
      throw aiError;
    }
  }
}
