import type { RegistrationDto } from "@unihub/shared-types";
import { ErrorCodes, buildQrPayload } from "@unihub/shared-utils";
import { Prisma, RegistrationStatus } from "@unihub/db";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../common/errors/app-error.js";
import { createQrTokenForRegistration } from "../../common/utils/qr-token.js";
import { withIdempotency } from "../../common/utils/idempotency.js";
import { publishNotificationJob } from "../notifications/queue.js";
import { createPaymentAttempt } from "../payments/payment.service.js";

async function assertVerifiedStudent(userId: string) {
  const studentProfile = await prisma.studentProfile.findUnique({ where: { userId } });
  if (!studentProfile?.verifiedAt) {
    throw new AppError(403, ErrorCodes.FORBIDDEN, "Student profile is not verified by CSV import");
  }
}

async function dtoForRegistration(registrationId: string): Promise<RegistrationDto> {
  const registration = await prisma.registration.findUniqueOrThrow({
    where: { id: registrationId },
    include: { qrToken: true }
  });

  return {
    id: registration.id,
    userId: registration.userId,
    workshopId: registration.workshopId,
    status: registration.status as RegistrationDto["status"],
    qrToken: registration.qrToken
      ? buildQrPayload({
          token: registration.qrToken.tokenPreview,
          registrationId: registration.id,
          workshopId: registration.workshopId
        })
      : null
  };
}

async function reserveSeat(tx: Prisma.TransactionClient, workshopId: string) {
  const affectedRows = await tx.$executeRaw`
    UPDATE "workshops"
    SET "registered_count" = "registered_count" + 1,
        "updated_at" = NOW()
    WHERE "id" = ${workshopId}
      AND "status" = 'PUBLISHED'
      AND "end_time" > NOW()
      AND "registered_count" < "capacity"
  `;

  if (affectedRows !== 1) {
    throw new AppError(409, ErrorCodes.WORKSHOP_FULL, "Workshop is full or unavailable");
  }
}

export async function createFreeRegistration(input: {
  userId: string;
  workshopId: string;
  idempotencyKey: string;
}): Promise<RegistrationDto> {
  await assertVerifiedStudent(input.userId);

  return withIdempotency({
    scope: "registration.free",
    key: input.idempotencyKey,
    payload: { userId: input.userId, workshopId: input.workshopId },
    operation: async () => {
      const existing = await prisma.registration.findUnique({
        where: { userId_workshopId: { userId: input.userId, workshopId: input.workshopId } }
      });
      if (existing) {
        return dtoForRegistration(existing.id);
      }

      const result = await prisma.$transaction(async (tx) => {
        const workshop = await tx.workshop.findUnique({ where: { id: input.workshopId } });
        if (!workshop || workshop.status !== "PUBLISHED") {
          throw new AppError(404, ErrorCodes.NOT_FOUND, "Workshop not found");
        }
        if (Number(workshop.priceAmount) > 0) {
          throw new AppError(400, ErrorCodes.VALIDATION_ERROR, "Use paid registration for paid workshops");
        }

        await reserveSeat(tx, input.workshopId);
        const registration = await tx.registration.create({
          data: {
            userId: input.userId,
            workshopId: input.workshopId,
            status: RegistrationStatus.CONFIRMED,
            idempotencyKey: input.idempotencyKey
          }
        });
        const qr = await createQrTokenForRegistration(tx, registration.id);
        return {
          id: registration.id,
          userId: registration.userId,
          workshopId: registration.workshopId,
          status: registration.status as RegistrationDto["status"],
          qrToken: qr.qrPayload
        } satisfies RegistrationDto;
      });

      await publishNotificationJob({
        eventType: "registration.confirmed",
        userId: input.userId,
        workshopId: input.workshopId,
        dedupeKey: `registration.confirmed:${result.id}`,
        title: "Registration confirmed",
        body: "Your workshop registration is confirmed."
      });

      return result;
    }
  });
}

export async function createPaidRegistration(input: {
  userId: string;
  workshopId: string;
  idempotencyKey: string;
}): Promise<RegistrationDto> {
  await assertVerifiedStudent(input.userId);

  return withIdempotency({
    scope: "registration.paid",
    key: input.idempotencyKey,
    payload: { userId: input.userId, workshopId: input.workshopId },
    operation: async () => {
      const existing = await prisma.registration.findUnique({
        where: { userId_workshopId: { userId: input.userId, workshopId: input.workshopId } },
        include: { payment: true }
      });
      if (existing) {
        return {
          ...(await dtoForRegistration(existing.id)),
          paymentUrl: existing.payment?.paymentUrl ?? null
        };
      }

      const registration = await prisma.$transaction(async (tx) => {
        const workshop = await tx.workshop.findUnique({ where: { id: input.workshopId } });
        if (!workshop || workshop.status !== "PUBLISHED") {
          throw new AppError(404, ErrorCodes.NOT_FOUND, "Workshop not found");
        }
        if (Number(workshop.priceAmount) <= 0) {
          throw new AppError(400, ErrorCodes.VALIDATION_ERROR, "Use free registration for free workshops");
        }

        await reserveSeat(tx, input.workshopId);
        return tx.registration.create({
          data: {
            userId: input.userId,
            workshopId: input.workshopId,
            status: RegistrationStatus.PENDING_PAYMENT,
            idempotencyKey: input.idempotencyKey
          },
          include: { workshop: true }
        });
      });

      const payment = await createPaymentAttempt({
        registrationId: registration.id,
        amount: Number(registration.workshop.priceAmount),
        currency: registration.workshop.currency,
        idempotencyKey: input.idempotencyKey
      });

      return {
        id: registration.id,
        userId: registration.userId,
        workshopId: registration.workshopId,
        status: registration.status as RegistrationDto["status"],
        qrToken: null,
        paymentUrl: payment.paymentUrl
      };
    }
  });
}

export async function getRegistrationQr(input: { registrationId: string; requesterId: string; isAdmin: boolean }) {
  const registration = await prisma.registration.findUnique({
    where: { id: input.registrationId },
    include: { qrToken: true }
  });

  if (!registration || (!input.isAdmin && registration.userId !== input.requesterId)) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, "Registration not found");
  }
  if (!registration.qrToken || registration.status !== "CONFIRMED") {
    throw new AppError(409, "QR_NOT_READY", "QR token is not ready");
  }

  return {
    registrationId: registration.id,
    qrPayload: buildQrPayload({
      token: registration.qrToken.tokenPreview,
      registrationId: registration.id,
      workshopId: registration.workshopId
    })
  };
}
