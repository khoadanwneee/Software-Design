import { Router } from "express";
import { Role } from "@unihub/shared-types";
import { AppError } from "../../common/errors/app-error.js";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { prisma } from "../../config/prisma.js";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";

export const aiSummaryRouter = Router();

aiSummaryRouter.use(requireAuth, requireRole([Role.ORGANIZER, Role.ADMIN]));

aiSummaryRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const summary = await prisma.aiSummary.findUnique({
      where: { id: String(req.params.id) }
    });

    if (!summary) {
      throw new AppError(404, "AI_SUMMARY_NOT_FOUND", "AI summary not found");
    }

    res.json({
      id: summary.id,
      workshopId: summary.workshopId,
      uploadedFileId: summary.uploadedFileId,
      status: summary.status,
      summary: summary.summary,
      errorMessage: summary.errorMessage,
      model: summary.model,
      attemptCount: summary.attemptCount,
      createdAt: summary.createdAt.toISOString(),
      updatedAt: summary.updatedAt.toISOString(),
      completedAt: summary.completedAt?.toISOString() ?? null
    });
  })
);

aiSummaryRouter.post(
  "/documents",
  asyncHandler(async () => {
    throw new AppError(410, "AI_SUMMARY_UPLOAD_DEPRECATED", "Use POST /api/workshops/:workshopId/pdf with multipart PDF upload");
  })
);
