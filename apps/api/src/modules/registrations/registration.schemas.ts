import { z } from "zod";

export const createRegistrationSchema = z.object({
  workshopId: z.string().min(1),
  idempotencyKey: z.string().min(8).max(120)
});
