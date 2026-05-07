import { z } from "zod";
import { RoomStatus } from "@unihub/shared-types";

export const roomBodySchema = z.object({
  name: z.string().trim().min(2).max(120),
  capacity: z.number().int().positive(),
  status: z.nativeEnum(RoomStatus).default(RoomStatus.ACTIVE),
  layoutUrl: z.string().trim().min(1).optional().nullable()
});

export const updateRoomSchema = roomBodySchema.partial();

export const updateRoomStatusSchema = z.object({
  status: z.nativeEnum(RoomStatus)
});

export const roomLayoutMetadataSchema = z.object({
  fileName: z.string().trim().min(1).max(240),
  contentType: z.enum(["image/png", "image/jpeg", "image/webp", "image/svg+xml", "application/pdf"]),
  size: z.number().int().positive()
});
