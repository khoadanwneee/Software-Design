import { Queue } from "bullmq";
import type { QueueOptions } from "bullmq";
import { logRedisUnavailable, redisConnection } from "../../config/redis.js";

function createQueue(name: string, options: QueueOptions) {
  const queue = new Queue(name, options);
  queue.on("error", (error) => logRedisUnavailable(`Queue ${name}`, error));
  return queue;
}

export const notificationQueue = createQueue("notifications", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 500
  }
});

export const aiSummaryQueue = createQueue("ai-summary", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 500
  }
});

export const studentImportQueue = createQueue("student-import", {
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
  try {
    await notificationQueue.add(data.eventType, data, {
      jobId: data.dedupeKey
    });
  } catch (error) {
    logRedisUnavailable("Notification queue publish", error);
  }
}
