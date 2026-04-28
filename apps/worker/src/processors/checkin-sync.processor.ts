import type { Job } from "bullmq";
import { prisma } from "@unihub/db";

export async function processCheckinSync(job: Job<{ olderThanHours?: number }>) {
  if (job.name !== "checkin_sync.cleanup") {
    return;
  }

  const olderThanHours = job.data.olderThanHours ?? 24;
  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
  const failed = await prisma.offlineCheckinSyncLog.count({
    where: { syncStatus: "FAILED", createdAt: { lt: cutoff } }
  });
  console.log(`[checkin-sync] ${failed} failed sync logs older than ${olderThanHours}h need review`);
}
