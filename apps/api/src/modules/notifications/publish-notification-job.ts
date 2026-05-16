import { logRedisUnavailable } from "../../config/redis.js";
import { notificationQueue } from "../../common/queues.js";

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
