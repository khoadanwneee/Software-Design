import type { Job } from "bullmq";
import { prisma } from "@unihub/db";
import { notificationQueue } from "../queues.js";
import { notificationLogger } from "../notifications/observability.js";
import type { NotificationJobData } from "./notification.processor.js";

export interface ReminderScanJobData {
  kind: "workshop.reminder.scan";
  nowIso?: string;
}

export interface ReminderOffset {
  key: string;
  label: string;
  milliseconds: number;
}

export interface ReminderProcessorDeps {
  prisma: any;
  enqueueNotification: (data: NotificationJobData) => Promise<void>;
  now: () => Date;
  reminderOffsets: ReminderOffset[];
  scanWindowMs: number;
}

const DEFAULT_REMINDER_OFFSETS: ReminderOffset[] = [
  { key: "24h", label: "24 hours", milliseconds: 24 * 60 * 60 * 1000 },
  { key: "1h", label: "1 hour", milliseconds: 60 * 60 * 1000 }
];

function parseDuration(value: string) {
  const match = value.trim().match(/^(\d+)(m|h)$/i);
  if (!match) {
    return null;
  }
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  return unit === "h" ? amount * 60 * 60 * 1000 : amount * 60 * 1000;
}

export function parseReminderOffsets(value = process.env.NOTIFICATION_REMINDER_OFFSETS) {
  if (!value?.trim()) {
    return DEFAULT_REMINDER_OFFSETS;
  }

  const parsed = value
    .split(",")
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((key) => {
      const milliseconds = parseDuration(key);
      if (!milliseconds) {
        return null;
      }
      const label = key.endsWith("h") ? `${key.slice(0, -1)} hour${key === "1h" ? "" : "s"}` : key;
      return { key, label, milliseconds };
    })
    .filter((offset): offset is ReminderOffset => Boolean(offset));

  return parsed.length > 0 ? parsed : DEFAULT_REMINDER_OFFSETS;
}

function defaultScanWindowMs() {
  const minutes = Number(process.env.NOTIFICATION_REMINDER_WINDOW_MINUTES ?? "5");
  return Number.isFinite(minutes) && minutes > 0 ? minutes * 60 * 1000 : 5 * 60 * 1000;
}

function defaultEnqueueNotification(data: NotificationJobData) {
  return notificationQueue.add(data.eventType, data, { jobId: data.dedupeKey }).then(() => undefined);
}

export function createDefaultReminderProcessorDeps(): ReminderProcessorDeps {
  return {
    prisma,
    enqueueNotification: defaultEnqueueNotification,
    now: () => new Date(),
    reminderOffsets: parseReminderOffsets(),
    scanWindowMs: defaultScanWindowMs()
  };
}

function reminderStartTimeLabel(value: Date) {
  return value.toISOString();
}

export async function processReminderScan(
  job: Job<ReminderScanJobData>,
  deps = createDefaultReminderProcessorDeps()
) {
  const now = job.data.nowIso ? new Date(job.data.nowIso) : deps.now();

  for (const offset of deps.reminderOffsets) {
    const from = new Date(now.getTime() + offset.milliseconds);
    const to = new Date(from.getTime() + deps.scanWindowMs);
    const workshops = await deps.prisma.workshop.findMany({
      where: {
        status: "PUBLISHED",
        startTime: { gte: from, lt: to }
      },
      select: {
        id: true,
        title: true,
        startTime: true,
        registrations: {
          where: { status: "CONFIRMED" },
          select: { userId: true }
        }
      }
    });

    for (const workshop of workshops) {
      for (const registration of workshop.registrations) {
        const dedupeKey = `workshop.reminder:${workshop.id}:${offset.key}:${registration.userId}`;
        await deps.enqueueNotification({
          eventType: "workshop.reminder",
          userId: registration.userId,
          workshopId: workshop.id,
          dedupeKey,
          title: "Workshop reminder",
          body: `${workshop.title} starts in ${offset.label}.`,
          metadata: {
            reminderLabel: offset.label,
            reminderOffset: offset.key,
            workshopStartTime: reminderStartTimeLabel(new Date(workshop.startTime))
          }
        });
        notificationLogger.info("notification.reminder_enqueued", {
          eventType: "workshop.reminder",
          dedupeKey,
          recipientId: registration.userId,
          workshopId: workshop.id,
          reminderOffset: offset.key
        });
      }
    }
  }
}

export async function scheduleReminderScans() {
  await notificationQueue.add(
    "workshop.reminder.scan",
    { kind: "workshop.reminder.scan" },
    {
      jobId: "workshop.reminder.scan",
      repeat: { every: 60_000 }
    }
  );
}
