import type { Job } from "bullmq";
import { NotificationChannel, NotificationStatus } from "@unihub/shared-types";
import { prisma } from "@unihub/db";
import { emailProvider } from "../providers/email.provider.js";

interface NotificationJobData {
  eventType: string;
  userId?: string;
  workshopId?: string;
  dedupeKey: string;
  title: string;
  body: string;
}

export async function processNotification(job: Job<NotificationJobData>) {
  const data = job.data;
  if (!data.userId) {
    console.log(`[notification] skipped job ${job.id}: no userId`);
    return;
  }

  const existing = await prisma.notification.findUnique({ where: { dedupeKey: data.dedupeKey } });
  if (existing?.status === NotificationStatus.SENT) {
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: data.userId } });
  if (!user) {
    return;
  }

  await emailProvider.send({ to: user.email, subject: data.title, body: data.body });

  await prisma.notification.upsert({
    where: { dedupeKey: data.dedupeKey },
    update: {
      status: NotificationStatus.SENT,
      sentAt: new Date(),
      retryCount: { increment: job.attemptsMade > 0 ? 1 : 0 },
      lastError: null
    },
    create: {
      userId: data.userId,
      workshopId: data.workshopId,
      channel: NotificationChannel.IN_APP,
      eventType: data.eventType,
      title: data.title,
      body: data.body,
      status: NotificationStatus.SENT,
      dedupeKey: data.dedupeKey,
      sentAt: new Date()
    }
  });
}
