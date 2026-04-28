import "dotenv/config";
import { Worker } from "bullmq";
import { prisma } from "@unihub/db";
import { redisConnection } from "./queues.js";
import { processNotification } from "./processors/notification.processor.js";
import { processPayment } from "./processors/payment.processor.js";
import { processAiSummary } from "./processors/ai-summary.processor.js";
import { processStudentImport } from "./processors/student-import.processor.js";
import { processCheckinSync } from "./processors/checkin-sync.processor.js";

const workers = [
  new Worker("notifications", processNotification, { connection: redisConnection, concurrency: 5 }),
  new Worker("payments", processPayment, { connection: redisConnection, concurrency: 2 }),
  new Worker("ai-summary", processAiSummary, { connection: redisConnection, concurrency: 2 }),
  new Worker("student-import", processStudentImport, { connection: redisConnection, concurrency: 1 }),
  new Worker("checkin-sync", processCheckinSync, { connection: redisConnection, concurrency: 2 })
];

for (const worker of workers) {
  worker.on("completed", (job) => console.log(`[worker:${worker.name}] completed job ${job.id}`));
  worker.on("failed", (job, error) => console.error(`[worker:${worker.name}] failed job ${job?.id}`, error));
}

async function shutdown() {
  await Promise.all(workers.map((worker) => worker.close()));
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log("UniHub worker started.");
