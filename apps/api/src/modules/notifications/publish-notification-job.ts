import { logRedisUnavailable } from "../../config/redis.js";
import { notificationQueue } from "../../common/queues.js";

function toQueueJobId(dedupeKey: string) {
  return `dedupe-${Buffer.from(dedupeKey).toString("base64url")}`;
}

export async function publishNotificationJob(data: {
  eventType: string;
  userId?: string;
  workshopId?: string;
  dedupeKey: string;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await notificationQueue.add(data.eventType, data, {
      jobId: toQueueJobId(data.dedupeKey)
    });
  } catch (error) {
    logRedisUnavailable("Notification queue publish", error);
  }
}
