import type {
  NotificationItem,
  NotificationListParams,
  NotificationsResponse,
  UnreadCountResponse
} from "@unihub/shared-types";
import { NotificationChannel, NotificationStatus } from "@unihub/shared-types";
import { ErrorCodes } from "@unihub/shared-utils";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../common/errors/app-error.js";

type NotificationWithWorkshop = Awaited<ReturnType<typeof findNotificationForUser>>;

function toNotificationItem(notification: NonNullable<NotificationWithWorkshop>): NotificationItem {
  return {
    id: notification.id,
    title: notification.title,
    message: notification.body,
    type: notification.eventType,
    status: notification.readAt ? "READ" : "UNREAD",
    createdAt: notification.createdAt.toISOString(),
    readAt: notification.readAt?.toISOString() ?? null,
    workshopId: notification.workshopId,
    workshopTitle: notification.workshop?.title ?? null,
    actionUrl: notification.workshopId ? `/workshops/${notification.workshopId}` : null
  };
}

async function findNotificationForUser(userId: string, notificationId: string) {
  return prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId,
      channel: NotificationChannel.IN_APP,
      status: { in: [NotificationStatus.SENT, NotificationStatus.PARTIAL_FAILED] }
    },
    include: { workshop: { select: { id: true, title: true } } }
  });
}

export async function listNotifications(userId: string, params: NotificationListParams): Promise<NotificationsResponse> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const where = {
    userId,
    channel: NotificationChannel.IN_APP,
    status: { in: [NotificationStatus.SENT, NotificationStatus.PARTIAL_FAILED] },
    readAt: params.status === "UNREAD" ? null : params.status === "READ" ? { not: null } : undefined
  };

  const [items, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      include: { workshop: { select: { id: true, title: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.notification.count({ where })
  ]);

  return {
    items: items.map(toNotificationItem),
    page,
    limit,
    total,
    totalPages: Math.max(Math.ceil(total / limit), 1)
  };
}

export async function getUnreadNotificationCount(userId: string): Promise<UnreadCountResponse> {
  const count = await prisma.notification.count({
    where: {
      userId,
      channel: NotificationChannel.IN_APP,
      status: { in: [NotificationStatus.SENT, NotificationStatus.PARTIAL_FAILED] },
      readAt: null
    }
  });
  return { count };
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<NotificationItem> {
  const existing = await findNotificationForUser(userId, notificationId);
  if (!existing) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, "Notification not found");
  }

  const notification = await prisma.notification.update({
    where: { id: notificationId },
    data: { readAt: existing.readAt ?? new Date() },
    include: { workshop: { select: { id: true, title: true } } }
  });

  return toNotificationItem(notification);
}

export async function markAllNotificationsRead(userId: string): Promise<{ updated: number }> {
  const now = new Date();
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      channel: NotificationChannel.IN_APP,
      status: { in: [NotificationStatus.SENT, NotificationStatus.PARTIAL_FAILED] },
      readAt: null
    },
    data: { readAt: now }
  });

  return { updated: result.count };
}
