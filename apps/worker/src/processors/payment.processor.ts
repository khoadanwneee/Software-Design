import type { Job } from "bullmq";
import { prisma } from "@unihub/db";
import { workerPaymentProvider } from "../providers/payment.provider.js";

const PAYMENT_TIMEOUT_MINUTES = Number(
  process.env.PAYMENT_TIMEOUT_MINUTES ?? 15
);
const PAYMENT_TIMEOUT_MS = PAYMENT_TIMEOUT_MINUTES * 60 * 1000;

export async function processPayment(
  job: Job<{ providerOrderId?: string }>
) {
  if (job.name !== "payment.reconcile") return;

  const stalePayments = await prisma.payment.findMany({
    where: {
      status: "PENDING",
      createdAt: {
        lt: new Date(Date.now() - PAYMENT_TIMEOUT_MS)
      },
      registration: {
        status: "PENDING_PAYMENT"
      },
      ...(job.data.providerOrderId
        ? { providerOrderId: job.data.providerOrderId }
        : {})
    },
    include: {
      registration: {
        include: {
          workshop: true
        }
      }
    },
    take: 50
  });

  for (const payment of stalePayments) {
    try {
      // ================================
      // 1. RECONCILE WITH PROVIDER
      // ================================
      let reconcileResult: any = null;

      if (payment.providerOrderId) {
        reconcileResult =
          await workerPaymentProvider.reconcile(
            payment.providerOrderId
          );
      }

      // ================================
      // 2. IF ALREADY PAID → DO NOTHING
      // ================================
      if (
        reconcileResult?.status === "PAID" ||
        payment.status === "PAID"
      ) {
        continue;
      }

      // ================================
      // 3. ATOMIC STATE TRANSITION
      // ================================
      await prisma.$transaction(async (tx) => {
        const updatedPayment = await tx.payment.updateMany({
          where: {
            id: payment.id,
            status: "PENDING"
          },
          data: {
            status: "EXPIRED"
          }
        });

        if (!updatedPayment.count) return;

        const updatedRegistration =
          await tx.registration.updateMany({
            where: {
              id: payment.registrationId,
              status: "PENDING_PAYMENT"
            },
            data: {
              status: "PAYMENT_FAILED"
            }
          });

        if (!updatedRegistration.count) return;

        // ================================
        // 4. SAFE SEAT RELEASE (GUARDED)
        // ================================
        await tx.workshop.update({
          where: {
            id: payment.registration.workshopId,
            registeredCount: {
              gt: 0
            }
          },
          data: {
            registeredCount: {
              decrement: 1
            }
          }
        });

        // ================================
        // 5. MARK RELEASE FLAG (IDEMPOTENT GUARD)
        // ================================
        await tx.registration.update({
          where: {
            id: payment.registrationId
          },
          data: {
            status: "PAYMENT_FAILED"
            // OPTIONAL nếu bạn thêm field:
            // seatReleasedAt: new Date()
          }
        });
      });
    } catch (err) {
      console.error(
        "[payment.reconcile] failed:",
        payment.id,
        err
      );
      // không throw để tránh retry storm
      continue;
    }
  }
}