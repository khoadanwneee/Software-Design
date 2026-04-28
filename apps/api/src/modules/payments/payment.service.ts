import { ErrorCodes } from "@unihub/shared-utils";
import { PaymentStatus } from "@unihub/db";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../common/errors/app-error.js";
import { createQrTokenForRegistration } from "../../common/utils/qr-token.js";
import { publishNotificationJob } from "../notifications/queue.js";
import { executePaymentCall } from "./payment-circuit-breaker.js";
import { paymentProvider } from "./payment-provider.js";

export async function createPaymentAttempt(input: {
  registrationId: string;
  amount: number;
  currency: string;
  idempotencyKey: string;
}) {
  const existing = await prisma.payment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) {
    return {
      registrationId: existing.registrationId,
      paymentId: existing.id,
      paymentUrl: existing.paymentUrl ?? "",
      status: existing.status
    };
  }

  try {
    const session = await executePaymentCall(() =>
      paymentProvider.createSession({
        registrationId: input.registrationId,
        amount: input.amount,
        currency: input.currency,
        idempotencyKey: input.idempotencyKey
      })
    );

    const payment = await prisma.payment.create({
      data: {
        registrationId: input.registrationId,
        idempotencyKey: input.idempotencyKey,
        provider: "mock",
        providerOrderId: session.providerOrderId,
        amount: input.amount,
        currency: input.currency,
        paymentUrl: session.paymentUrl,
        status: PaymentStatus.PENDING
      }
    });

    return {
      registrationId: input.registrationId,
      paymentId: payment.id,
      paymentUrl: session.paymentUrl,
      status: payment.status
    };
  } catch {
    await prisma.payment.create({
      data: {
        registrationId: input.registrationId,
        idempotencyKey: input.idempotencyKey,
        provider: "mock",
        amount: input.amount,
        currency: input.currency,
        status: PaymentStatus.INIT_FAILED
      }
    });
    throw new AppError(503, ErrorCodes.PAYMENT_UNAVAILABLE, "Payment gateway is temporarily unavailable");
  }
}

export async function handleMockPaymentWebhook(payload: unknown) {
  const verification = await paymentProvider.verifyWebhook(payload);
  const providerEventId = verification.providerTransactionId || verification.providerOrderId;

  const existingCallback = await prisma.paymentCallback.findUnique({
    where: { provider_providerEventId: { provider: "mock", providerEventId } }
  });
  if (existingCallback) {
    return { ok: true, duplicate: true };
  }

  const paymentForLog = await prisma.payment.findFirst({
    where: { providerOrderId: verification.providerOrderId }
  });

  await prisma.paymentCallback.create({
    data: {
      paymentId: paymentForLog?.id,
      provider: "mock",
      providerEventId,
      providerTransactionId: verification.providerTransactionId || null,
      validSignature: verification.valid,
      payload: payload as object
    }
  });

  if (!verification.valid) {
    throw new AppError(400, "INVALID_PAYMENT_WEBHOOK_SIGNATURE", "Payment webhook signature is invalid");
  }

  const existingTransaction = await prisma.payment.findUnique({
    where: { providerTransactionId: verification.providerTransactionId }
  });
  if (existingTransaction) {
    return { ok: true, duplicate: true };
  }

  const payment = await prisma.payment.findFirst({
    where: { providerOrderId: verification.providerOrderId },
    include: { registration: true }
  });
  if (!payment) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, "Payment not found");
  }

  if (verification.status === "failed") {
    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          providerTransactionId: verification.providerTransactionId
        }
      });
      await tx.registration.update({
        where: { id: payment.registrationId },
        data: { status: "PAYMENT_FAILED" }
      });
      await tx.workshop.update({
        where: { id: payment.registration.workshopId },
        data: { registeredCount: { decrement: 1 } }
      });
    });
    return { ok: true };
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.PAID,
        providerTransactionId: verification.providerTransactionId
      }
    });
    await tx.registration.update({
      where: { id: payment.registrationId },
      data: { status: "CONFIRMED" }
    });

    const existingQr = await tx.qrToken.findUnique({ where: { registrationId: payment.registrationId } });
    if (!existingQr) {
      await createQrTokenForRegistration(tx, payment.registrationId);
    }
  });

  await publishNotificationJob({
    eventType: "registration.confirmed",
    userId: payment.registration.userId,
    workshopId: payment.registration.workshopId,
    dedupeKey: `registration.confirmed:${payment.registrationId}`,
    title: "Registration confirmed",
    body: "Your paid workshop registration has been confirmed."
  });

  return { ok: true };
}
