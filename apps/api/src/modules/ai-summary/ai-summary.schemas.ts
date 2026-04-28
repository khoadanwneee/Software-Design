import { z } from "zod";

export const aiDocumentMetadataSchema = z.object({
  workshopId: z.string().min(1),
  fileName: z.string().min(1).refine((value) => value.toLowerCase().endsWith(".pdf"), "File must be a PDF"),
  contentType: z.literal("application/pdf"),
  size: z.number().int().positive()
});
