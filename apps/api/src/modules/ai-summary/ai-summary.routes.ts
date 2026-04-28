import { Router } from "express";
import { Role } from "@unihub/shared-types";
import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../common/errors/app-error.js";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { validateBody } from "../../common/middleware/validate.js";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import { aiSummaryQueue } from "../notifications/queue.js";
import { aiDocumentMetadataSchema } from "./ai-summary.schemas.js";

export const aiSummaryRouter = Router();

aiSummaryRouter.use(requireAuth, requireRole([Role.ORGANIZER, Role.ADMIN]));

aiSummaryRouter.post(
  "/documents",
  validateBody(aiDocumentMetadataSchema),
  asyncHandler(async (req, res) => {
    if (req.body.size > env.MAX_UPLOAD_BYTES) {
      throw new AppError(400, "FILE_TOO_LARGE", "PDF exceeds configured size limit");
    }

    const workshop = await prisma.workshop.findUnique({ where: { id: req.body.workshopId } });
    if (!workshop) {
      throw new AppError(404, "WORKSHOP_NOT_FOUND", "Workshop not found");
    }

    const document = await prisma.aiDocument.create({
      data: {
        workshopId: req.body.workshopId,
        uploadedById: req.user!.id,
        fileName: req.body.fileName,
        contentType: req.body.contentType,
        sizeBytes: req.body.size,
        storageKey: `local/${req.body.workshopId}/${Date.now()}-${req.body.fileName}`
      }
    });

    const summary = await prisma.aiSummary.create({
      data: {
        workshopId: req.body.workshopId,
        documentId: document.id,
        status: "PENDING",
        promptVersion: "summary-vi-v1"
      }
    });

    await aiSummaryQueue.add("ai_summary.requested", { documentId: document.id, summaryId: summary.id }, { jobId: summary.id });

    res.status(202).json({ aiDocumentId: document.id, aiSummaryId: summary.id, status: summary.status });
  })
);
