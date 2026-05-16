import { prisma } from "../../config/prisma.js";

export interface NotificationRecipientPayload {
  userId?: string;
  workshopId?: string;
}

export async function resolveNotificationRecipients(
  eventType: string,
  payload: NotificationRecipientPayload,
  client: Pick<typeof prisma, "registration"> = prisma
) {
  if (payload.userId) {
    return [payload.userId];
  }

  if (payload.workshopId && eventType.startsWith("workshop.")) {
    const registrations = await client.registration.findMany({
      where: { workshopId: payload.workshopId, status: "CONFIRMED" },
      select: { userId: true }
    });
    return registrations.map((registration) => registration.userId);
  }

  return [];
}
