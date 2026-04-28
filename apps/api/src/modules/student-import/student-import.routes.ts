import { Router } from "express";
import { Role } from "@unihub/shared-types";
import { prisma } from "../../config/prisma.js";
import { sha256 } from "../../common/utils/crypto.js";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { validateBody } from "../../common/middleware/validate.js";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import { studentImportQueue } from "../notifications/queue.js";
import { createStudentImportSchema } from "./student-import.schemas.js";

export const studentImportRouter = Router();

studentImportRouter.use(requireAuth, requireRole([Role.ADMIN, Role.ORGANIZER]));

studentImportRouter.post(
  "/jobs",
  validateBody(createStudentImportSchema),
  asyncHandler(async (req, res) => {
    const fileHash = sha256(req.body.csvText);
    const existing = await prisma.studentImportRun.findUnique({
      where: { fileHash_importType: { fileHash, importType: "LEGACY_STUDENT_CSV" } }
    });
    if (existing) {
      return res.status(200).json(existing);
    }

    const run = await prisma.studentImportRun.create({
      data: {
        fileName: req.body.fileName,
        fileHash,
        importType: "LEGACY_STUDENT_CSV",
        status: "PENDING",
        createdById: req.user!.id
      }
    });

    await studentImportQueue.add("student_import.requested", { runId: run.id, csvText: req.body.csvText }, { jobId: run.id });
    return res.status(202).json(run);
  })
);

studentImportRouter.get(
  "/jobs/:id",
  asyncHandler(async (req, res) => {
    const run = await prisma.studentImportRun.findUnique({
      where: { id: String(req.params.id) },
      include: { errors: { orderBy: { rowNumber: "asc" } } }
    });
    res.json(run);
  })
);
