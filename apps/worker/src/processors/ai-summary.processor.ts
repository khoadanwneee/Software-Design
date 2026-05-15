import type { Job } from "bullmq";
import { processAiSummaryJob, type AiSummaryJobData } from "../ai-summary/ai-summary.worker.js";

export async function processAiSummary(job: Job<AiSummaryJobData>) {
  return processAiSummaryJob(job);
}
