import { z } from "zod";

export const mockWebhookSchema = z.object({
  signature: z.string(),
  providerOrderId: z.string().min(1),
  providerTransactionId: z.string().min(1),
  status: z.enum(["success", "failed"])
});
