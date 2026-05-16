import "dotenv/config";
import { Queue } from "bullmq";
import { notificationDefaultJobOptions } from "./queue-options.js";

function parseRedisUrl(redisUrl: string) {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined
  };
}

export const redisConnection = parseRedisUrl(process.env.REDIS_URL ?? "redis://localhost:6379");

export const notificationQueue = new Queue("notifications", {
  connection: redisConnection,
  defaultJobOptions: notificationDefaultJobOptions
});

export const paymentQueue = new Queue("payments", {
  connection: redisConnection,
  defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 5000 } }
});

export const aiSummaryQueue = new Queue("ai-summary", {
  connection: redisConnection,
  defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 5000 } }
});

export const studentImportQueue = new Queue("student-import", {
  connection: redisConnection,
  defaultJobOptions: { attempts: 2, backoff: { type: "exponential", delay: 3000 } }
});

export const checkinSyncQueue = new Queue("checkin-sync", {
  connection: redisConnection,
  defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 3000 } }
});

export const workshopQueue = new Queue("workshops", {
  connection: redisConnection,
  defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 5000 } }
});
