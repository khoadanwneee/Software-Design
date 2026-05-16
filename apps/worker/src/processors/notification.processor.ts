import type { Job } from "bullmq";
import { NotificationChannel, NotificationDeliveryStatus, NotificationStatus } from "@unihub/shared-types";
import { prisma } from "@unihub/db";
import {
  type NotificationChannelRegistry,
  type NotificationPreferenceShape,
  channelRegistry
} from "../providers/notification-channels.js";
import { renderTemplate, type TemplateContent } from "../providers/notification-templates.js";
import { notificationQueue } from "../queues.js";
import {
  type NotificationLogger,
  type NotificationMetrics,
  notificationLogger,
  notificationMetrics
} from "../notifications/observability.js";
import {
  type NotificationRecipientResolver,
  createNotificationRecipientResolver
} from "../notifications/recipient-resolver.js";

export interface NotificationJobData {
  eventType: string;
  userId?: string;
  workshopId?: string;
  dedupeKey: string;
  title?: string;
  body?: string;
  metadata?: Record<string, unknown>;
}

interface DeliveryResult {
  channel: NotificationChannel;
  status: NotificationDeliveryStatus;
  providerMsgId?: string;
  error?: string;
}

export interface NotificationProcessorDeps {
  prisma: any;
  channelRegistry: NotificationChannelRegistry;
  recipientResolver: NotificationRecipientResolver;
  enqueueNotification: (data: NotificationJobData) => Promise<void>;
  logger: NotificationLogger;
  metrics: NotificationMetrics;
}

const TERMINAL_STATUSES = new Set<string>([
  NotificationStatus.SENT,
  NotificationStatus.PARTIAL_FAILED,
  NotificationStatus.FAILED_TEMPLATE,
  NotificationStatus.FAILED_PROVIDER,
  NotificationStatus.SKIPPED
]);

function toQueueJobId(dedupeKey: string) {
  return `dedupe-${Buffer.from(dedupeKey).toString("base64url")}`;
}

function requiredChannelsForEvent(eventType: string): Set<NotificationChannel> {
  if (eventType === "registration.confirmed") {
    return new Set([NotificationChannel.IN_APP, NotificationChannel.EMAIL]);
  }
  return new Set();
}

function defaultEnqueueNotification(data: NotificationJobData) {
  return notificationQueue.add(data.eventType, data, { jobId: toQueueJobId(data.dedupeKey) }).then(() => undefined);
}

export function createDefaultNotificationProcessorDeps(): NotificationProcessorDeps {
  return {
    prisma,
    channelRegistry,
    recipientResolver: createNotificationRecipientResolver(prisma),
    enqueueNotification: defaultEnqueueNotification,
    logger: notificationLogger,
    metrics: notificationMetrics
  };
}

function currentAttempt(job: Job<NotificationJobData>) {
  return job.attemptsMade + 1;
}

function maxAttempts(job: Job<NotificationJobData>) {
  const configured = Number(job.opts?.attempts ?? 1);
  return Number.isFinite(configured) && configured > 0 ? configured : 1;
}

function isFinalAttempt(job: Job<NotificationJobData>) {
  return currentAttempt(job) >= maxAttempts(job);
}

function preferenceShape(prefRecord: NotificationPreferenceShape | null | undefined) {
  return {
    inApp: prefRecord?.inApp ?? true,
    email: prefRecord?.email ?? true,
    telegram: prefRecord?.telegram ?? false,
    ...(prefRecord ?? {})
  };
}

function metadataStrings(metadata: Record<string, unknown> | undefined) {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata ?? {})) {
    if (value !== undefined && value !== null) {
      result[key] = String(value);
    }
  }
  return result;
}

function deliveryErrorSummary(results: DeliveryResult[]) {
  return results
    .filter((result) => result.error)
    .map((result) => `${result.channel}: ${result.status}${result.error ? ` (${result.error})` : ""}`)
    .join("; ");
}

function selectStoredContent(
  data: NotificationJobData,
  renderedByChannel: Map<NotificationChannel, TemplateContent>,
  preferredChannel: NotificationChannel | null
) {
  const preferred = preferredChannel ? renderedByChannel.get(preferredChannel) : null;
  if (preferred && preferredChannel) {
    return {
      channel: preferredChannel,
      title: preferred.subject,
      body: preferred.body
    };
  }

  const firstRendered = Array.from(renderedByChannel.entries())[0];
  if (firstRendered) {
    return {
      channel: firstRendered[0],
      title: firstRendered[1].subject,
      body: firstRendered[1].body
    };
  }

  return {
    channel: NotificationChannel.IN_APP,
    title: data.title ?? data.eventType,
    body: data.body ?? ""
  };
}

async function resolveRecipientJobs(data: NotificationJobData, deps: NotificationProcessorDeps) {
  const recipients = await deps.recipientResolver.resolve(data);
  if (recipients.length === 0) {
    deps.logger.warn("notification.no_recipients", {
      eventType: data.eventType,
      dedupeKey: data.dedupeKey
    });
    deps.metrics.increment("skipped", {
      eventType: data.eventType,
      dedupeKey: data.dedupeKey,
      failureReason: "NO_RECIPIENTS"
    });
    return;
  }

  await Promise.all(
    recipients.map((recipientId) => {
      const dedupeKey = data.dedupeKey.endsWith(`:${recipientId}`)
        ? data.dedupeKey
        : `${data.dedupeKey}:${recipientId}`;
      return deps.enqueueNotification({
        ...data,
        userId: recipientId,
        dedupeKey
      });
    })
  );
}

export async function processNotification(
  job: Job<NotificationJobData>,
  deps = createDefaultNotificationProcessorDeps()
) {
  const data = job.data;
  const attempt = currentAttempt(job);

  if (!data.userId) {
    await resolveRecipientJobs(data, deps);
    return;
  }

  const existing = await deps.prisma.notification.findUnique({
    where: { dedupeKey: data.dedupeKey }
  });

  if (existing && TERMINAL_STATUSES.has(existing.status)) {
    deps.logger.info("notification.deduplicated", {
      eventType: data.eventType,
      dedupeKey: data.dedupeKey,
      recipientId: data.userId,
      retryAttempt: attempt,
      status: existing.status
    });
    deps.metrics.increment("skipped", {
      eventType: data.eventType,
      dedupeKey: data.dedupeKey,
      recipientId: data.userId,
      failureReason: "DEDUPE_TERMINAL"
    });
    return;
  }

  const user = await deps.prisma.user.findUnique({ where: { id: data.userId } });
  if (!user) {
    deps.logger.warn("notification.user_missing", {
      eventType: data.eventType,
      dedupeKey: data.dedupeKey,
      recipientId: data.userId
    });
    deps.metrics.increment("skipped", {
      eventType: data.eventType,
      dedupeKey: data.dedupeKey,
      recipientId: data.userId,
      failureReason: "USER_MISSING"
    });
    return;
  }

  const prefRecord = await deps.prisma.notificationPreference.findUnique({
    where: { userId: data.userId }
  });
  const prefs = preferenceShape(prefRecord);
  const requiredChannels = requiredChannelsForEvent(data.eventType);
  const registeredChannels = deps.channelRegistry.list();
  const enabledChannels = registeredChannels.filter(
    (channel) => requiredChannels.has(channel.channel) || deps.channelRegistry.isEnabled(channel, prefs)
  );

  if (enabledChannels.length === 0) {
    deps.logger.info("notification.all_channels_disabled", {
      eventType: data.eventType,
      dedupeKey: data.dedupeKey,
      recipientId: data.userId
    });
    deps.metrics.increment("skipped", {
      eventType: data.eventType,
      dedupeKey: data.dedupeKey,
      recipientId: data.userId,
      failureReason: "ALL_CHANNELS_DISABLED"
    });
    return;
  }

  let workshopTitle = "";
  let workshopStartTime = "";
  let workshopUrl = "";
  if (data.workshopId) {
    const workshop = await deps.prisma.workshop.findUnique({
      where: { id: data.workshopId },
      select: { title: true, startTime: true }
    });
    workshopTitle = workshop?.title ?? "";
    workshopStartTime = workshop?.startTime ? new Date(workshop.startTime).toISOString() : "";
    const appOrigin = (process.env.APP_ORIGIN ?? "").trim().replace(/\/+$/, "");
    if (appOrigin) {
      workshopUrl = `${appOrigin}/workshops/${data.workshopId}`;
    }
  }

  const templateVars: Record<string, string> = {
    userName: user.fullName,
    workshopTitle,
    workshopStartTime,
    workshopUrl,
    reminderLabel: "",
    ...metadataStrings(data.metadata)
  };

  const renderedByChannel = new Map<NotificationChannel, TemplateContent>();
  const deliveryResults: DeliveryResult[] = [];

  for (const channel of registeredChannels) {
    const isRequired = requiredChannels.has(channel.channel);
    if (!isRequired && !deps.channelRegistry.isEnabled(channel, prefs)) {
      deliveryResults.push({
        channel: channel.channel,
        status: NotificationDeliveryStatus.PREFERENCE_DISABLED,
        error: "User preference disabled"
      });
      continue;
    }

    const rendered = renderTemplate(data.eventType, channel.channel, templateVars);
    if (!rendered) {
      deliveryResults.push({
        channel: channel.channel,
        status: NotificationDeliveryStatus.FAILED_TEMPLATE,
        error: `Template rendering failed for ${data.eventType}/${channel.channel}`
      });
      continue;
    }
    renderedByChannel.set(channel.channel, rendered);
  }

  const inAppEnabled = registeredChannels.some(
    (channel) => channel.channel === NotificationChannel.IN_APP && deps.channelRegistry.isEnabled(channel, prefs)
  );
  const stored = selectStoredContent(
    data,
    renderedByChannel,
    inAppEnabled ? NotificationChannel.IN_APP : renderedByChannel.keys().next().value ?? null
  );

  const notification = await deps.prisma.notification.upsert({
    where: { dedupeKey: data.dedupeKey },
    update: {
      channel: stored.channel,
      title: stored.title,
      body: stored.body,
      status: NotificationStatus.PENDING,
      retryCount: job.attemptsMade,
      lastError: null
    },
    create: {
      userId: data.userId,
      workshopId: data.workshopId,
      channel: stored.channel,
      eventType: data.eventType,
      title: stored.title,
      body: stored.body,
      status: NotificationStatus.PENDING,
      dedupeKey: data.dedupeKey,
      retryCount: job.attemptsMade
    }
  });

  const previouslySentDeliveries = await deps.prisma.notificationDelivery.findMany({
    where: {
      notificationId: notification.id,
      status: NotificationDeliveryStatus.SENT
    },
    select: { channel: true }
  });
  const alreadySentChannels = new Set(
    previouslySentDeliveries.map((delivery: { channel: NotificationChannel }) => delivery.channel)
  );

  for (const channel of enabledChannels) {
    const rendered = renderedByChannel.get(channel.channel);
    if (!rendered) {
      continue;
    }

    if (alreadySentChannels.has(channel.channel)) {
      deps.logger.info("notification.channel_already_sent", {
        eventType: data.eventType,
        dedupeKey: data.dedupeKey,
        recipientId: data.userId,
        channel: channel.channel,
        retryAttempt: attempt
      });
      continue;
    }

    const result = await channel.adapter.send({
      userId: data.userId,
      toEmail: user.email,
      userName: user.fullName,
      subject: rendered.subject,
      body: rendered.body,
      metadata: data.metadata
    });

    if (result.success) {
      deliveryResults.push({
        channel: channel.channel,
        status: NotificationDeliveryStatus.SENT,
        providerMsgId: result.providerMsgId
      });
      deps.logger.info("notification.channel_sent", {
        eventType: data.eventType,
        dedupeKey: data.dedupeKey,
        recipientId: data.userId,
        channel: channel.channel,
        retryAttempt: attempt,
        providerMsgId: result.providerMsgId
      });
      continue;
    }

    if (result.errorType === "CHANNEL_DISABLED") {
      deliveryResults.push({
        channel: channel.channel,
        status: NotificationDeliveryStatus.SKIPPED,
        error: result.error ?? "Channel disabled"
      });
      deps.logger.info("notification.channel_disabled", {
        eventType: data.eventType,
        dedupeKey: data.dedupeKey,
        recipientId: data.userId,
        channel: channel.channel,
        retryAttempt: attempt,
        failureReason: result.error
      });
      continue;
    }

    deliveryResults.push({
      channel: channel.channel,
      status: NotificationDeliveryStatus.FAILED,
      error: result.error ?? "Provider send failed"
    });
    deps.logger.error("notification.channel_failed", {
      eventType: data.eventType,
      dedupeKey: data.dedupeKey,
      recipientId: data.userId,
      channel: channel.channel,
      retryAttempt: attempt,
      failureReason: result.error ?? result.errorType ?? "Provider send failed"
    });
  }

  if (deliveryResults.length > 0) {
    await deps.prisma.notificationDelivery.createMany({
      data: deliveryResults.map((result) => ({
        notificationId: notification.id,
        channel: result.channel,
        status: result.status,
        providerMsgId: result.providerMsgId ?? null,
        errorMessage: result.error ?? null,
        attemptCount: attempt,
        sentAt: result.status === NotificationDeliveryStatus.SENT ? new Date() : null
      }))
    });
  }

  const hasProviderFailure = deliveryResults.some((result) => result.status === NotificationDeliveryStatus.FAILED);
  const hasTemplateFailure = deliveryResults.some(
    (result) => result.status === NotificationDeliveryStatus.FAILED_TEMPLATE
  );
  const sentCount = deliveryResults.filter((result) => result.status === NotificationDeliveryStatus.SENT).length;
  const allSkipped =
    deliveryResults.length > 0 &&
    deliveryResults.every(
      (result) =>
        result.status === NotificationDeliveryStatus.SKIPPED ||
        result.status === NotificationDeliveryStatus.PREFERENCE_DISABLED
    );

  if (hasProviderFailure) {
    const status = sentCount > 0 ? NotificationStatus.PARTIAL_FAILED : NotificationStatus.FAILED_PROVIDER;
    await deps.prisma.notification.update({
      where: { id: notification.id },
      data: {
        status,
        lastError: deliveryErrorSummary(deliveryResults)
      }
    });
    deps.metrics.increment("failed", {
      eventType: data.eventType,
      dedupeKey: data.dedupeKey,
      recipientId: data.userId,
      retryAttempt: attempt,
      failureReason: "FAILED_PROVIDER"
    });
    if (sentCount === 0 && !isFinalAttempt(job)) {
      deps.metrics.increment("retried", {
        eventType: data.eventType,
        dedupeKey: data.dedupeKey,
        recipientId: data.userId,
        retryAttempt: attempt,
        failureReason: "FAILED_PROVIDER"
      });
      throw new Error(
        `Notification delivery failed for channels: ${deliveryResults
          .filter((result) => result.status === NotificationDeliveryStatus.FAILED)
          .map((result) => result.channel)
          .join(", ")}`
      );
    }
    return;
  }

  if (hasTemplateFailure) {
    await deps.prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: sentCount > 0 ? NotificationStatus.PARTIAL_FAILED : NotificationStatus.FAILED_TEMPLATE,
        lastError: deliveryErrorSummary(deliveryResults)
      }
    });
    deps.metrics.increment("failed", {
      eventType: data.eventType,
      dedupeKey: data.dedupeKey,
      recipientId: data.userId,
      retryAttempt: attempt,
      failureReason: "FAILED_TEMPLATE"
    });
    return;
  }

  if (sentCount > 0) {
    await deps.prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: NotificationStatus.SENT,
        sentAt: new Date(),
        lastError: null
      }
    });
    deps.metrics.increment("sent", {
      eventType: data.eventType,
      dedupeKey: data.dedupeKey,
      recipientId: data.userId,
      retryAttempt: attempt
    });
    return;
  }

  if (allSkipped) {
    await deps.prisma.notification.update({
      where: { id: notification.id },
      data: {
        status: NotificationStatus.SKIPPED,
        lastError: deliveryErrorSummary(deliveryResults) || "All enabled channels skipped"
      }
    });
    deps.metrics.increment("skipped", {
      eventType: data.eventType,
      dedupeKey: data.dedupeKey,
      recipientId: data.userId,
      retryAttempt: attempt
    });
  }
}
