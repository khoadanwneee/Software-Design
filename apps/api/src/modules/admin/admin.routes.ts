import { Router } from "express";
import { Role } from "@unihub/shared-types";
import { prisma } from "../../config/prisma.js";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import { getPaymentCircuitState } from "../payments/payment-circuit-breaker.js";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole([Role.ORGANIZER, Role.ADMIN]));

adminRouter.get(
  "/statistics",
  asyncHandler(async (_req, res) => {
    const [workshops, registrations, checkins, paidPayments, importRuns] = await Promise.all([
      prisma.workshop.count(),
      prisma.registration.count({ where: { status: "CONFIRMED" } }),
      prisma.checkin.count(),
      prisma.payment.findMany({ where: { status: "PAID" }, select: { amount: true } }),
      prisma.studentImportRun.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, fileName: true, status: true, totalRows: true, failedRows: true, createdAt: true }
      })
    ]);

    const revenue = paidPayments.reduce((total, payment) => total + Number(payment.amount), 0);
    res.json({
      workshops,
      registrations,
      checkins,
      revenue,
      paymentCircuit: getPaymentCircuitState(),
      recentImports: importRuns
    });
  })
);

adminRouter.get(
  "/audit-logs",
  requireRole([Role.ADMIN]),
  asyncHandler(async (_req, res) => {
    const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
    res.json(logs);
  })
);
