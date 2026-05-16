import type { Job } from "bullmq";
import { prisma } from "@unihub/db";

export async function processWorkshopStatus(job: Job) {
  if (job.name !== "workshop.status.refresh") {
    return;
  }

  const now = new Date();
  const updated = await prisma.workshop.updateMany({
    where: {
      status: "PUBLISHED",
      endTime: { lt: now }
    },
    data: { status: "COMPLETED" }
  });

  if (updated.count > 0) {
    console.log(`[workshop-status] marked ${updated.count} workshops as COMPLETED`);
  }
}
