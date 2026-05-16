import type { Job } from "bullmq";
import { prisma } from "@unihub/db";
import { workerPaymentProvider } from "../providers/payment.provider.js";

const PAYMENT_TIMEOUT_MINUTES = Number(process.env.PAYMENT_TIMEOUT_MINUTES ?? 15);
const PAYMENT_TIMEOUT_MS = PAYMENT_TIMEOUT_MINUTES * 60 * 1000;

export async function processPayment(job: Job<{ providerOrderId?: string }>) {
  if (job.name !== "payment.reconcile") {
    return;
  }

  const stalePayments = await prisma.payment.findMany({
    where: {
      status: "PENDING",
      createdAt: { lt: new Date(Date.now() - PAYMENT_TIMEOUT_MS) },
      registration: { status: "PENDING_PAYMENT" },
      providerOrderId: job.data.providerOrderId ? job.data.providerOrderId : undefined
    },
    include: { registration: { select: { id: true, workshopId: true } } },
    take: 50
  });

  for (const payment of stalePayments) {
    if (payment.providerOrderId) {
      await workerPaymentProvider.reconcile(payment.providerOrderId);
    }

    await prisma.$transaction(async (tx) => {
      const paymentUpdate = await tx.payment.updateMany({
        where: { id: payment.id, status: "PENDING" },
        data: { status: "EXPIRED" }
      });

      if (!paymentUpdate.count) {
        return;
      }

      const registrationUpdate = await tx.registration.updateMany({
        where: { id: payment.registrationId, status: "PENDING_PAYMENT" },
        data: { status: "PAYMENT_FAILED" }
      });

      if (registrationUpdate.count) {
        await tx.workshop.update({
          where: { id: payment.registration.workshopId },
          data: { registeredCount: { decrement: 1 } }
        });
      }
    });
  }
}
