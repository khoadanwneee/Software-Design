import type { NotificationJobData } from "../processors/notification.processor.js";

export interface NotificationRecipientResolver {
  resolve(data: NotificationJobData): Promise<string[]>;
}

export function createNotificationRecipientResolver(prisma: any): NotificationRecipientResolver {
  return {
    async resolve(data: NotificationJobData) {
      if (data.userId) {
        return [data.userId];
      }

      if (data.workshopId && data.eventType.startsWith("workshop.")) {
        const registrations = await prisma.registration.findMany({
          where: { workshopId: data.workshopId, status: "CONFIRMED" },
          select: { userId: true }
        });
        return registrations.map((registration: { userId: string }) => registration.userId);
      }

      return [];
    }
  };
}
