import { z } from "zod";
import { WorkshopCategory, WorkshopStatus } from "@unihub/shared-types";

const optionalNonEmptyString = z
  .string()
  .trim()
  .min(1)
  .optional()
  .or(z.literal("").transform(() => undefined));

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
  .optional()
  .or(z.literal("").transform(() => undefined));

const booleanQuery = z
  .enum(["true", "false"])
  .transform((value) => value === "true")
  .optional();

const optionalCategory = z
  .nativeEnum(WorkshopCategory)
  .optional()
  .or(z.literal("").transform(() => undefined));

const workshopBodySchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  category: z.nativeEnum(WorkshopCategory),
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

export const workshopListQuerySchema = z
  .object({
    keyword: optionalNonEmptyString,
    category: optionalCategory,
    roomId: optionalNonEmptyString,
    date: dateOnly,
    fromDate: dateOnly,
    toDate: dateOnly,
    hasSeats: booleanQuery,
    priceType: z.enum(["all", "free", "paid"]).default("all"),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50)
  })
  .refine(
    (value) => {
      if (!value.fromDate || !value.toDate) {
        return true;
      }
      return value.fromDate <= value.toDate;
    },
    { message: "fromDate must be before or equal to toDate", path: ["toDate"] }
  );
