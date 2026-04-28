import { z } from "zod";
import { WorkshopStatus } from "@unihub/shared-types";

const workshopBodySchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  category: z.string().min(2),
  roomId: z.string().min(1),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  capacity: z.number().int().positive(),
  priceAmount: z.number().min(0),
  currency: z.string().default("VND"),
  speakerIds: z.array(z.string()).default([]),
  status: z.nativeEnum(WorkshopStatus).default(WorkshopStatus.DRAFT)
});

export const createWorkshopSchema = workshopBodySchema
  .refine((value) => new Date(value.startTime) < new Date(value.endTime), {
    message: "startTime must be before endTime",
    path: ["endTime"]
  });

export const updateWorkshopSchema = workshopBodySchema.partial().refine(
  (value) => {
    if (!value.startTime || !value.endTime) {
      return true;
    }
    return new Date(value.startTime) < new Date(value.endTime);
  },
  { message: "startTime must be before endTime", path: ["endTime"] }
);
