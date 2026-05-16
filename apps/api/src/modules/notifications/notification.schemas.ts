import { z } from "zod";

export const notificationListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(["UNREAD", "READ", "ALL"]).default("ALL")
});

export const updateNotificationPreferenceSchema = z.object({
  inApp: z.boolean().optional(),
  email: z.boolean().optional(),
  telegram: z.boolean().optional()
});
