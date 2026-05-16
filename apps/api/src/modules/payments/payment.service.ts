import { ErrorCodes } from "@unihub/shared-utils";
import { PaymentStatus, RegistrationStatus } from "@unihub/db";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../common/errors/app-error.js";
import { createQrTokenForRegistration } from "../../common/utils/qr-token.js";
import { publishNotificationJob } from "../notifications/publish-notification-job.js";
import { executePaymentCall } from "./payment-circuit-breaker.js";
import { paymentProvider } from "./payment-provider.js";
import { publishWorkshopSeatUpdate } from "../workshops/workshop-seat-events.js";

const VNP_RETURN_URL = process.env.VNP_RETURN_URL?.trim() ?? "";

function isPaymentUrlValid(paymentUrl: string) {
  if (!paymentUrl) {
    return false;
  }
  if (!paymentUrl.startsWith("http")) {
    return false;
  }
  if (paymentUrl.includes(" ")) {
    return false;
  }
  if (!paymentUrl.includes("vnp_SecureHashType=")) {
    return false;
  }
  if (VNP_RETURN_URL && !paymentUrl.includes(encodeURIComponent(VNP_RETURN_URL))) {
    return false;
  }
  return true;
}

async function createPaymentSession(input: {
  registrationId: string;
  amount: number;
  currency: string;
  idempotencyKey: string;
}) {
  // 1. ONLY VNPay call is inside CB
  const session = await executePaymentCall(() =>
    paymentProvider.createSession({
      registrationId: input.registrationId,
      amount: input.amount,
      currency: input.currency,
      idempotencyKey: input.idempotencyKey
    })
  );

  // 2. validation OUTSIDE CB
  if (!isPaymentUrlValid(session.paymentUrl)) {
    console.error("[PAYMENT] Invalid URL:", session.paymentUrl);
    throw new Error("Invalid payment URL (BUG or misconfig)");
  }

  return session;
}

//
// =====================================
// 1. CREATE PAYMENT (VNPay session)
// =====================================
//
export async function createPaymentAttempt(input: {
  registrationId: string;
  amount: number;
  currency: string;
  idempotencyKey: string;
}) {
  const existing = await prisma.payment.findUnique({
    where: { idempotencyKey: input.idempotencyKey }
  });

  if (existing) {
    return {
      registrationId: existing.registrationId,
      paymentId: existing.id,
      paymentUrl: existing.paymentUrl ?? "",
      status: existing.status
    };
  }

  try {
    const session = await createPaymentSession(input);

    const payment = await prisma.payment.create({
      data: {
        registrationId: input.registrationId,
        idempotencyKey: input.idempotencyKey,

        provider: "vnpay",

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

        provider: "vnpay",

        amount: input.amount,
        currency: input.currency,
        status: PaymentStatus.INIT_FAILED
      }
    });

    throw new AppError(
      503,
      ErrorCodes.PAYMENT_UNAVAILABLE,
      "Payment gateway is down"
    );
  }
}

export async function createOrRefreshPaymentAttempt(input: {
  registrationId: string;
  amount: number;
  currency: string;
  idempotencyKey: string;
}) {
  const existing = await prisma.payment.findUnique({
    where: { registrationId: input.registrationId }
  });

  if (!existing) {
    return createPaymentAttempt(input);
  }

  const shouldRefresh =
    !existing.paymentUrl ||
    existing.paymentUrl.includes(" ") ||
    existing.status === PaymentStatus.FAILED ||
    existing.status === PaymentStatus.EXPIRED ||
    existing.status === PaymentStatus.INIT_FAILED ||
    !existing.paymentUrl.includes("vnp_SecureHashType=") ||
    (VNP_RETURN_URL
      ? !existing.paymentUrl.includes(encodeURIComponent(VNP_RETURN_URL))
      : false);

  if (!shouldRefresh) {
    return {
      registrationId: existing.registrationId,
      paymentId: existing.id,
      paymentUrl: existing.paymentUrl,
      status: existing.status
    };
  }

  try {
    const session = await createPaymentSession(input);

    const payment = await prisma.payment.update({
      where: { id: existing.id },
      data: {
        provider: "vnpay",
        providerOrderId: session.providerOrderId,
        providerTransactionId: null,
        amount: input.amount,
        currency: input.currency,
        paymentUrl: session.paymentUrl,
        status: PaymentStatus.PENDING
      }
    });

    return {
      registrationId: payment.registrationId,
      paymentId: payment.id,
      paymentUrl: session.paymentUrl,
      status: payment.status
    };
  } catch (err: any) {
    await prisma.payment
      .update({
        where: { id: existing.id },
        data: { status: PaymentStatus.INIT_FAILED }
      })
      .catch(() => undefined);
    

    if (err instanceof AppError) {
      throw err; 
    }


    throw new AppError(
      503,
      ErrorCodes.PAYMENT_UNAVAILABLE,
      "Payment gateway is failed"
    );
  }
}

//
// =====================================
// 2. VNPay IPN HANDLER (REAL)
// =====================================
//
export async function handleVNPayIPN(query: any) {
  const verification = await paymentProvider.verifyWebhook(query);

  const providerEventId =
    verification.providerTransactionId || verification.providerOrderId;

  if (!verification.valid) {
    throw new AppError(
      400,
      "INVALID_PAYMENT_WEBHOOK_SIGNATURE",
      "Payment webhook signature is invalid"
    );
  }

  const existingCallback = await prisma.paymentCallback.findUnique({
    where: {
      provider_providerEventId: {
        provider: "vnpay",
        providerEventId
      }
    }
  });

  if (existingCallback) {
    if (existingCallback.validSignature) {
      return { ok: true, duplicate: true };
    }
  }

  const existingTransaction = await prisma.payment.findUnique({
    where: {
      providerTransactionId: verification.providerTransactionId
    }
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

  if (existingCallback) {
    await prisma.paymentCallback.update({
      where: {
        provider_providerEventId: {
          provider: "vnpay",
          providerEventId
        }
      },
      data: {
        paymentId: payment.id,
        providerTransactionId:
          verification.providerTransactionId || null,
        validSignature: true,
        payload: query as object
      }
    });
  } else {
    await prisma.paymentCallback.create({
      data: {
        paymentId: payment.id,
        provider: "vnpay",
        providerEventId,
        providerTransactionId:
          verification.providerTransactionId || null,
        validSignature: true,
        payload: query as object
      }
    });
  }

  if (
    payment.status === PaymentStatus.EXPIRED ||
    payment.registration.status !== RegistrationStatus.PENDING_PAYMENT
  ) {
    if (verification.status === "success") {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.NEEDS_MANUAL_REVIEW,
          providerTransactionId: verification.providerTransactionId
        }
      });
    }

    return { ok: true, ignored: true };
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
        data: {
          registeredCount: { decrement: 1 }
        }
      });
    });

    await publishWorkshopSeatUpdate(
      payment.registration.workshopId
    );

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

    const existingQr = await tx.qrToken.findUnique({
      where: { registrationId: payment.registrationId }
    });

    if (!existingQr) {
      await createQrTokenForRegistration(
        tx,
        payment.registrationId
      );
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

  await publishWorkshopSeatUpdate(
    payment.registration.workshopId
  );

  return { ok: true };
}
