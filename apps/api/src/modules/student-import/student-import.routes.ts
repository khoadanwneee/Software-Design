import { Router } from "express";
import { Role } from "@unihub/shared-types";
import { env } from "../../config/env.js";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { validateBody, validateQuery } from "../../common/middleware/validate.js";
import { readMultipartFormData } from "../../common/utils/multipart.js";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import {
  createStudentImportSchema,
  studentImportListQuerySchema,
  studentImportUploadFieldsSchema
} from "./student-import.schemas.js";
import {
  createStudentImportFromText,
  createStudentImportFromUpload,
  getStudentImportDetail,
  listStudentImports,
  type StudentImportListFilters
} from "./student-import.service.js";

export const studentImportRouter = Router();

studentImportRouter.use(requireAuth, requireRole([Role.ADMIN]));

/**
 * @openapi
 * /api/admin/student-imports:
 *   post:
 *     summary: Upload a CSV file and enqueue an async student import.
 */
studentImportRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const form = await readMultipartFormData(req, env.MAX_UPLOAD_BYTES);
    const file = form.files.find((candidate) => candidate.fieldName === "file");
    if (!file) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "CSV file is required" } });
    }

    const fields = studentImportUploadFieldsSchema.parse(form.fields);
    const result = await createStudentImportFromUpload({
      fileName: file.fileName,
      contentType: file.contentType,
      buffer: file.buffer,
      importType: fields.importType,
      description: fields.description,
      dryRun: fields.dryRun,
      actorId: req.user!.id,
      requestId: req.requestId
    });

    return res.status(result.created ? 202 : 200).json({
      jobId: result.run.id,
      fileId: result.run.fileId,
      status: result.run.status,
      totalRows: result.run.totalRows,
      message: result.created ? "Student import queued" : "Student import file was already queued or processed",
      run: result.run
    });
  })
);

studentImportRouter.get(
  "/",
  validateQuery(studentImportListQuerySchema),
  asyncHandler(async (req, res) => {
    res.json(await listStudentImports(req.query as unknown as StudentImportListFilters));
  })
);

studentImportRouter.get(
  "/jobs/:id",
  asyncHandler(async (req, res) => {
    res.json(await getStudentImportDetail(String(req.params.id)));
  })
);

studentImportRouter.post(
  "/jobs",
  validateBody(createStudentImportSchema),
  asyncHandler(async (req, res) => {
    const result = await createStudentImportFromText({
      fileName: req.body.fileName,
      csvText: req.body.csvText,
      actorId: req.user!.id,
      requestId: req.requestId
    });
    return res.status(result.created ? 202 : 200).json(result.run);
  })
);

studentImportRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json(await getStudentImportDetail(String(req.params.id)));
  })
);
