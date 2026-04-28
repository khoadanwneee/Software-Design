import { Router } from "express";
import { Role } from "@unihub/shared-types";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { validateBody } from "../../common/middleware/validate.js";
import { paymentRateLimit } from "../../common/middleware/rate-limit.js";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import { mockWebhookSchema } from "./payment.schemas.js";
import { getPaymentCircuitState } from "./payment-circuit-breaker.js";
import { handleMockPaymentWebhook } from "./payment.service.js";

export const paymentRouter = Router();

paymentRouter.get(
  "/circuit",
  requireAuth,
  requireRole([Role.ADMIN, Role.ORGANIZER]),
  (_req, res) => {
    res.json(getPaymentCircuitState());
  }
);

paymentRouter.post(
  "/webhook/mock",
  paymentRateLimit,
  validateBody(mockWebhookSchema),
  asyncHandler(async (req, res) => {
    res.json(await handleMockPaymentWebhook(req.body));
  })
);
