import { Router } from "express";
import { Role } from "@unihub/shared-types";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { paymentRateLimit } from "../../common/middleware/rate-limit.js";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";

import { handleVNPayIPN } from "./payment.service.js";
import { getPaymentCircuitState } from "./payment-circuit-breaker.js";

export const paymentRouter = Router();

/**
 * Circuit breaker monitoring (giữ lại để debug hệ thống payment)
 */
paymentRouter.get(
  "/circuit",
  requireAuth,
  requireRole([Role.ADMIN, Role.ORGANIZER]),
  (_req, res) => {
    res.json(getPaymentCircuitState());
  }
);

/**
 * VNPay IPN (IMPORTANT - source of truth)
 * ❗ KHÔNG dùng auth middleware vì VNPay server gọi vào
 */
paymentRouter.get(
  "/vnpay/ipn",
  paymentRateLimit,
  asyncHandler(async (req, res) => {
    const result = await handleVNPayIPN(req.query);
    res.json(result);
  })
);

/**
 * VNPay return URL (frontend redirect UI)
 * Chỉ dùng để hiển thị kết quả, KHÔNG update DB ở đây
 */
paymentRouter.get(
  "/vnpay/return",
  asyncHandler(async (req, res) => {
    try {
      // Ensure DB is updated even if IPN arrives late or is not reachable.
      const result = await handleVNPayIPN(req.query);
      const responseCode = String(req.query.vnp_ResponseCode || "");

      if (result?.ok && responseCode === "00") {
        return res.redirect(`${process.env.APP_ORIGIN}/payment-success`);
      }
    } catch {
      // Do not expose internal verification errors on browser redirect.
    }

    return res.redirect(`${process.env.APP_ORIGIN}/payment-failed`);
  })
);
