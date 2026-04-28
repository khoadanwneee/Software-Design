import { Queue } from "bullmq";
import { redisConnection } from "../../config/redis.js";

export const notificationQueue = new Queue("notifications", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 500
  }
});

export const aiSummaryQueue = new Queue("ai-summary", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 500
  }
});

export const studentImportQueue = new Queue("student-import", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 3000 },
    removeOnComplete: 100,
    removeOnFail: 500
  }
});

export async function publishNotificationJob(data: {
  eventType: string;
  userId?: string;
  workshopId?: string;
  dedupeKey: string;
  title: string;
  body: string;
}) {
  await notificationQueue.add(data.eventType, data, {
    jobId: data.dedupeKey
  });
}
