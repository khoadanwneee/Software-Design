import { z } from "zod";
import { OfflineSyncStatus } from "@unihub/shared-types";

export const validateQrSchema = z.object({
  qrPayload: z.string().min(1),
  workshopId: z.string().min(1)
});

export const onlineCheckinSchema = validateQrSchema.extend({
  idempotencyKey: z.string().min(8).max(120)
});

export const offlineCheckinRecordSchema = z.object({
  clientCheckinId: z.string().min(1),
  qrPayload: z.string().min(1),
  workshopId: z.string().min(1),
  staffId: z.string().min(1),
  deviceId: z.string().min(1),
  checkedInAt: z.string().datetime(),
  syncStatus: z.nativeEnum(OfflineSyncStatus),
  retryCount: z.number().int().min(0).max(5),
  lastError: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const offlineSyncSchema = z.object({
  events: z.array(offlineCheckinRecordSchema).max(100)
});
