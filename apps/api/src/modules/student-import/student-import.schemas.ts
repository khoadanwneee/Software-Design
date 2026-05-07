import { z } from "zod";
import { StudentImportStatus } from "@unihub/shared-types";

export const createStudentImportSchema = z.object({
  fileName: z.string().min(1).refine((value) => value.toLowerCase().endsWith(".csv"), "File must be CSV"),
  csvText: z.string().min(1)
});

export const studentImportListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.nativeEnum(StudentImportStatus).optional()
});

export const studentImportUploadFieldsSchema = z.object({
  importType: z.string().min(1).max(80).default("STUDENT_NIGHTLY"),
  description: z.string().max(500).optional(),
  dryRun: z
    .enum(["true", "false", "1", "0"])
    .optional()
    .transform((value) => value === "true" || value === "1")
});
