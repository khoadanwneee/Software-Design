import type { NotificationPreferenceDto, UpdateNotificationPreferenceRequest } from "@unihub/shared-types";
import { prisma } from "../../config/prisma.js";

const DEFAULTS: NotificationPreferenceDto = {
  inApp: true,
  email: true,
  telegram: false
};

/**
 * Get the notification preferences for a user.
 * Returns defaults if no preference row exists yet.
 */
export async function getNotificationPreferences(userId: string): Promise<NotificationPreferenceDto> {
  const pref = await prisma.notificationPreference.findUnique({
    where: { userId }
  });

  if (!pref) {
    return { ...DEFAULTS };
  }

  return {
    inApp: pref.inApp,
    email: pref.email,
    telegram: pref.telegram
  };
}

/**
 * Update (upsert) the notification preferences for a user.
 * Spec: "User preference phải được tôn trọng."
 */
export async function updateNotificationPreferences(
  userId: string,
  input: UpdateNotificationPreferenceRequest
): Promise<NotificationPreferenceDto> {
  const pref = await prisma.notificationPreference.upsert({
    where: { userId },
    update: {
      inApp: input.inApp,
      email: input.email,
      telegram: input.telegram
    },
    create: {
      userId,
      inApp: input.inApp ?? DEFAULTS.inApp,
      email: input.email ?? DEFAULTS.email,
      telegram: input.telegram ?? DEFAULTS.telegram
    }
  });

  return {
    inApp: pref.inApp,
    email: pref.email,
    telegram: pref.telegram
  };
}
