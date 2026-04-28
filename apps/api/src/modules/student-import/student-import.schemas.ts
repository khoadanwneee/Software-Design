import { z } from "zod";

export const createStudentImportSchema = z.object({
  fileName: z.string().min(1).refine((value) => value.toLowerCase().endsWith(".csv"), "File must be CSV"),
  csvText: z.string().min(1)
});
