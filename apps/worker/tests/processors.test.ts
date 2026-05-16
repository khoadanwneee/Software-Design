import type { Job } from "bullmq";
import { describe, expect, it } from "vitest";
import { NotificationChannel, NotificationDeliveryStatus, NotificationStatus } from "@unihub/shared-types";
import { parseCsv } from "../src/processors/csv-parser";
import {
  type NotificationJobData,
  type NotificationProcessorDeps,
  processNotification
} from "../src/processors/notification.processor";
import { processReminderScan, type ReminderProcessorDeps } from "../src/processors/reminder.processor";
import {
  type ChannelPayload,
  type ChannelSendResult,
  type NotificationChannelAdapter,
  NotificationChannelRegistry
} from "../src/providers/notification-channels";
import { createNotificationRecipientResolver } from "../src/notifications/recipient-resolver";
import { notificationDefaultJobOptions } from "../src/queue-options";

describe("CSV parser", () => {
  it("supports quoted commas and newlines", () => {
    const csv = 'student_code,email,full_name,major\r\nS001,s1@example.com,"Nguyen, An","Computer\nScience"\r\n';
    expect(parseCsv(csv).rows).toEqual([
      ["student_code", "email", "full_name", "major"],
      ["S001", "s1@example.com", "Nguyen, An", "Computer\nScience"]
    ]);
  });

  it("supports escaped quotes", () => {
    const csv = 'student_code,email,full_name\nS002,s2@example.com,"Tran ""B"""\n';
    expect(parseCsv(csv).rows[1]).toEqual(["S002", "s2@example.com", 'Tran "B"']);
  });
});

class RecordingAdapter implements NotificationChannelAdapter {
  readonly calls: ChannelPayload[] = [];

  constructor(
    readonly channel: NotificationChannel,
    private readonly result: ChannelSendResult = { success: true, providerMsgId: `${channel}-message` }
  ) {}

  async send(payload: ChannelPayload): Promise<ChannelSendResult> {
    this.calls.push(payload);
    return this.result;
  }
}

function makeJob(data: NotificationJobData, attemptsMade = 0, attempts = 1): Job<NotificationJobData> {
  return {
    id: data.dedupeKey,
    name: data.eventType,
    data,
    attemptsMade,
    opts: { attempts }
  } as unknown as Job<NotificationJobData>;
}

function noopLogger() {
  return {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined
  };
}

function noopMetrics() {
  return {
    increment: () => undefined
  };
}

function createMemoryPrisma() {
  let nextId = 1;
  const state = {
    users: [
      {
        id: "student-1",
        email: "student1@example.test",
        fullName: "Student One"
      },
      {
        id: "student-2",
        email: "student2@example.test",
        fullName: "Student Two"
      }
    ],
    workshops: [
      {
        id: "workshop-1",
        title: "TypeScript 101",
        status: "PUBLISHED",
        startTime: new Date("2026-05-17T10:00:00.000Z")
      }
    ],
    registrations: [
      { userId: "student-1", workshopId: "workshop-1", status: "CONFIRMED" },
      { userId: "student-2", workshopId: "workshop-1", status: "CANCELLED" }
    ],
    preferences: new Map<string, { inApp: boolean; email: boolean; telegram: boolean }>(),
    notifications: [] as any[],
    deliveries: [] as any[]
  };

  const prisma = {
    state,
    user: {
      findUnique: async ({ where }: any) => state.users.find((user) => user.id === where.id) ?? null
    },
    workshop: {
      findUnique: async ({ where }: any) => state.workshops.find((workshop) => workshop.id === where.id) ?? null,
      findMany: async ({ where }: any) =>
        state.workshops
          .filter((workshop) => {
            if (where?.status && workshop.status !== where.status) {
              return false;
            }
            if (where?.startTime?.gte && workshop.startTime < where.startTime.gte) {
              return false;
            }
            if (where?.startTime?.lt && workshop.startTime >= where.startTime.lt) {
              return false;
            }
            return true;
          })
          .map((workshop) => ({
            ...workshop,
            registrations: state.registrations
              .filter((registration) => registration.workshopId === workshop.id && registration.status === "CONFIRMED")
              .map((registration) => ({ userId: registration.userId }))
          }))
    },
    registration: {
      findMany: async ({ where }: any) =>
        state.registrations
          .filter((registration) => {
            if (where?.workshopId && registration.workshopId !== where.workshopId) {
              return false;
            }
            if (where?.status && registration.status !== where.status) {
              return false;
            }
            return true;
          })
          .map((registration) => ({ userId: registration.userId }))
    },
    notificationPreference: {
      findUnique: async ({ where }: any) => state.preferences.get(where.userId) ?? null
    },
    notification: {
      findUnique: async ({ where }: any) =>
        state.notifications.find((notification) => notification.dedupeKey === where.dedupeKey) ?? null,
      upsert: async ({ where, create, update }: any) => {
        const existing = state.notifications.find((notification) => notification.dedupeKey === where.dedupeKey);
        if (existing) {
          Object.assign(existing, update, { updatedAt: new Date() });
          return existing;
        }
        const created = {
          id: `notification-${nextId++}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          sentAt: null,
          readAt: null,
          lastError: null,
          retryCount: 0,
          ...create
        };
        state.notifications.push(created);
        return created;
      },
      update: async ({ where, data }: any) => {
        const existing = state.notifications.find((notification) => notification.id === where.id);
        if (!existing) {
          throw new Error(`notification ${where.id} not found`);
        }
        Object.assign(existing, data, { updatedAt: new Date() });
        return existing;
      }
    },
    notificationDelivery: {
      findMany: async ({ where }: any) =>
        state.deliveries
          .filter((delivery) => {
            if (where?.notificationId && delivery.notificationId !== where.notificationId) {
              return false;
            }
            if (where?.status && delivery.status !== where.status) {
              return false;
            }
            return true;
          })
          .map((delivery) => ({ channel: delivery.channel })),
      createMany: async ({ data }: any) => {
        state.deliveries.push(...data);
        return { count: data.length };
      }
    }
  };

  return prisma;
}

function processorDeps(
  prisma: ReturnType<typeof createMemoryPrisma>,
  channels: Array<{ adapter: NotificationChannelAdapter; preferenceKey: string; defaultEnabled: boolean }>,
  enqueued: NotificationJobData[] = []
): NotificationProcessorDeps {
  return {
    prisma,
    channelRegistry: new NotificationChannelRegistry(
      channels.map((channel) => ({
        channel: channel.adapter.channel,
        preferenceKey: channel.preferenceKey,
        defaultEnabled: channel.defaultEnabled,
        adapter: channel.adapter
      }))
    ),
    recipientResolver: createNotificationRecipientResolver(prisma),
    enqueueNotification: async (data) => {
      enqueued.push(data);
    },
    logger: noopLogger(),
    metrics: noopMetrics()
  };
}

describe("notification processor", () => {
  it("configures BullMQ retry with exponential backoff", () => {
    expect(notificationDefaultJobOptions).toMatchObject({
      attempts: 5,
      backoff: { type: "exponential", delay: 2000 }
    });
  });

  it("deduplicates by dedupeKey and stores rendered in-app content", async () => {
    const prisma = createMemoryPrisma();
    const inApp = new RecordingAdapter(NotificationChannel.IN_APP);
    const deps = processorDeps(prisma, [{ adapter: inApp, preferenceKey: "inApp", defaultEnabled: true }]);
    const data: NotificationJobData = {
      eventType: "registration.confirmed",
      userId: "student-1",
      workshopId: "workshop-1",
      dedupeKey: "registration.confirmed:registration-1",
      title: "RAW TITLE",
      body: "RAW BODY"
    };

    await processNotification(makeJob(data), deps);
    await processNotification(makeJob(data), deps);

    expect(prisma.state.notifications).toHaveLength(1);
    expect(inApp.calls).toHaveLength(1);
    expect(prisma.state.notifications[0]).toMatchObject({
      title: "Registration confirmed",
      body: 'You have successfully registered for "TypeScript 101".',
      status: NotificationStatus.SENT
    });
  });

  it("does not send email when the email preference is disabled", async () => {
    const prisma = createMemoryPrisma();
    prisma.state.preferences.set("student-1", { inApp: true, email: false, telegram: false });
    const inApp = new RecordingAdapter(NotificationChannel.IN_APP);
    const email = new RecordingAdapter(NotificationChannel.EMAIL);
    const deps = processorDeps(prisma, [
      { adapter: inApp, preferenceKey: "inApp", defaultEnabled: true },
      { adapter: email, preferenceKey: "email", defaultEnabled: true }
    ]);

    await processNotification(
      makeJob({
        eventType: "registration.confirmed",
        userId: "student-1",
        workshopId: "workshop-1",
        dedupeKey: "registration.confirmed:registration-2"
      }),
      deps
    );

    expect(email.calls).toHaveLength(0);
    expect(prisma.state.deliveries).toContainEqual(
      expect.objectContaining({
        channel: NotificationChannel.EMAIL,
        status: NotificationDeliveryStatus.PREFERENCE_DISABLED
      })
    );
  });

  it("retries provider failures and marks FAILED_PROVIDER after max attempts", async () => {
    const prisma = createMemoryPrisma();
    const email = new RecordingAdapter(NotificationChannel.EMAIL, {
      success: false,
      error: "SMTP timeout",
      errorType: "PROVIDER_TIMEOUT"
    });
    const deps = processorDeps(prisma, [{ adapter: email, preferenceKey: "email", defaultEnabled: true }]);
    const data: NotificationJobData = {
      eventType: "registration.confirmed",
      userId: "student-1",
      workshopId: "workshop-1",
      dedupeKey: "registration.confirmed:provider-fails"
    };

    await expect(processNotification(makeJob(data, 0, 2), deps)).rejects.toThrow(/EMAIL/);
    expect(prisma.state.notifications[0].status).toBe(NotificationStatus.PENDING);

    await expect(processNotification(makeJob(data, 1, 2), deps)).rejects.toThrow(/EMAIL/);
    expect(email.calls).toHaveLength(2);
    expect(prisma.state.notifications[0].status).toBe(NotificationStatus.FAILED_PROVIDER);
    expect(prisma.state.registrations[0].status).toBe("CONFIRMED");
  });

  it("resolves workshop recipients from CONFIRMED registrations only", async () => {
    const prisma = createMemoryPrisma();
    const enqueued: NotificationJobData[] = [];
    const deps = processorDeps(
      prisma,
      [{ adapter: new RecordingAdapter(NotificationChannel.IN_APP), preferenceKey: "inApp", defaultEnabled: true }],
      enqueued
    );

    await processNotification(
      makeJob({
        eventType: "workshop.changed",
        workshopId: "workshop-1",
        dedupeKey: "workshop.changed:workshop-1:version-1"
      }),
      deps
    );

    expect(enqueued).toEqual([
      expect.objectContaining({
        userId: "student-1",
        dedupeKey: "workshop.changed:workshop-1:version-1:student-1"
      })
    ]);
  });

  it("does not create an in-app notification when in-app is the only channel and it is disabled", async () => {
    const prisma = createMemoryPrisma();
    prisma.state.preferences.set("student-1", { inApp: false, email: false, telegram: false });
    const deps = processorDeps(prisma, [
      { adapter: new RecordingAdapter(NotificationChannel.IN_APP), preferenceKey: "inApp", defaultEnabled: true }
    ]);

    await processNotification(
      makeJob({
        eventType: "registration.confirmed",
        userId: "student-1",
        workshopId: "workshop-1",
        dedupeKey: "registration.confirmed:in-app-disabled"
      }),
      deps
    );

    expect(prisma.state.notifications).toHaveLength(0);
    expect(prisma.state.deliveries).toHaveLength(0);
  });

  it("marks template render failures as FAILED_TEMPLATE and never SENT", async () => {
    const prisma = createMemoryPrisma();
    const deps = processorDeps(prisma, [
      { adapter: new RecordingAdapter(NotificationChannel.IN_APP), preferenceKey: "inApp", defaultEnabled: true }
    ]);

    await processNotification(
      makeJob({
        eventType: "missing.template",
        userId: "student-1",
        workshopId: "workshop-1",
        dedupeKey: "missing.template:student-1"
      }),
      deps
    );

    expect(prisma.state.notifications[0].status).toBe(NotificationStatus.FAILED_TEMPLATE);
    expect(prisma.state.notifications[0].status).not.toBe(NotificationStatus.SENT);
    expect(prisma.state.deliveries[0]).toMatchObject({
      channel: NotificationChannel.IN_APP,
      status: NotificationDeliveryStatus.FAILED_TEMPLATE
    });
  });

  it("enqueues idempotent reminders once per workshop, offset, and confirmed user", async () => {
    const prisma = createMemoryPrisma();
    const enqueued = new Map<string, NotificationJobData>();
    const now = new Date("2026-05-16T10:00:00.000Z");
    const deps: ReminderProcessorDeps = {
      prisma,
      now: () => now,
      reminderOffsets: [{ key: "24h", label: "24 hours", milliseconds: 24 * 60 * 60 * 1000 }],
      scanWindowMs: 60_000,
      enqueueNotification: async (data) => {
        enqueued.set(data.dedupeKey, data);
      }
    };

    await processReminderScan({ data: { kind: "workshop.reminder.scan" }, opts: {} } as any, deps);
    await processReminderScan({ data: { kind: "workshop.reminder.scan" }, opts: {} } as any, deps);

    expect(Array.from(enqueued.values())).toEqual([
      expect.objectContaining({
        eventType: "workshop.reminder",
        userId: "student-1",
        dedupeKey: "workshop.reminder:workshop-1:24h:student-1"
      })
    ]);

    const reminder = Array.from(enqueued.values())[0];
    const notificationDeps = processorDeps(prisma, [
      { adapter: new RecordingAdapter(NotificationChannel.IN_APP), preferenceKey: "inApp", defaultEnabled: true }
    ]);
    await processNotification(makeJob(reminder), notificationDeps);
    await processNotification(makeJob(reminder), notificationDeps);

    expect(prisma.state.notifications).toHaveLength(1);
    expect(prisma.state.notifications[0]).toMatchObject({
      title: "Workshop reminder",
      body: '"TypeScript 101" starts in 24 hours at 2026-05-17T10:00:00.000Z.',
      status: NotificationStatus.SENT
    });
  });
});
