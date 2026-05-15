import { Router } from "express";
import { Role } from "@unihub/shared-types";
import { AppError } from "../../common/errors/app-error.js";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";

export const aiSummaryRouter = Router();

aiSummaryRouter.use(requireAuth, requireRole([Role.ORGANIZER, Role.ADMIN]));

aiSummaryRouter.post(
  "/documents",
  asyncHandler(async () => {
    throw new AppError(410, "AI_SUMMARY_UPLOAD_DEPRECATED", "Use POST /api/workshops/:workshopId/pdf with multipart PDF upload");
  })
);
