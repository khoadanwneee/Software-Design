import type { Job } from "bullmq";
import { AiSummaryStatus } from "@unihub/shared-types";
import { prisma } from "@unihub/db";
import { aiSummaryProvider } from "../providers/ai-summary.provider.js";

interface AiSummaryJobData {
  documentId: string;
  summaryId: string;
}

export async function processAiSummary(job: Job<AiSummaryJobData>) {
  const summary = await prisma.aiSummary.findUnique({
    where: { id: job.data.summaryId },
    include: { document: true }
  });

  if (!summary || summary.status === AiSummaryStatus.COMPLETED) {
    return;
  }

  await prisma.aiSummary.update({
    where: { id: summary.id },
    data: { status: AiSummaryStatus.PROCESSING }
  });

  try {
    const summaryText = await aiSummaryProvider.summarize({
      fileName: summary.document.fileName,
      storageKey: summary.document.storageKey
    });
    await prisma.aiSummary.update({
      where: { id: summary.id },
      data: {
        status: AiSummaryStatus.COMPLETED,
        summaryText,
        modelVersion: "mock-ai-v1",
        promptVersion: summary.promptVersion ?? "summary-vi-v1"
      }
    });
  } catch (error) {
    await prisma.aiSummary.update({
      where: { id: summary.id },
      data: {
        status: AiSummaryStatus.FAILED,
        errorMessage: error instanceof Error ? error.message : "AI summary failed"
      }
    });
    throw error;
  }
}
