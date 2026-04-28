import type { Job } from "bullmq";
import { prisma } from "@unihub/db";
import { workerPaymentProvider } from "../providers/payment.provider.js";

export async function processPayment(job: Job<{ providerOrderId?: string }>) {
  if (job.name !== "payment.reconcile") {
    return;
  }

  const stalePayments = await prisma.payment.findMany({
    where: {
      status: "PENDING",
      createdAt: { lt: new Date(Date.now() - 30 * 60 * 1000) },
      providerOrderId: job.data.providerOrderId ? job.data.providerOrderId : undefined
    },
    take: 50
  });

  for (const payment of stalePayments) {
    if (payment.providerOrderId) {
      await workerPaymentProvider.reconcile(payment.providerOrderId);
    }
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "EXPIRED" }
    });
  }
}
