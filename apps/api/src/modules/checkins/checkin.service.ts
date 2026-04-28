import type {
  OfflineCheckinRecord,
  OfflineCheckinSyncResponse,
  OfflineCheckinSyncResult
} from "@unihub/shared-types";
import { OfflineSyncStatus } from "@unihub/shared-types";
import { ErrorCodes, parseQrPayload, payloadFingerprint } from "@unihub/shared-utils";
import type { Prisma } from "@unihub/db";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../common/errors/app-error.js";
import { sha256 } from "../../common/utils/crypto.js";

async function findQr(qrPayload: string) {
  const parsed = parseQrPayload(qrPayload);
  return prisma.qrToken.findUnique({
    where: { tokenHash: sha256(parsed.token) },
    include: { registration: { include: { workshop: true, user: true } }, checkin: true }
  });
}

export async function validateQr(input: { qrPayload: string; workshopId: string }) {
  const qr = await findQr(input.qrPayload);
  if (!qr) {
    throw new AppError(400, ErrorCodes.INVALID_QR, "QR token is invalid");
  }
  if (qr.registration.workshopId !== input.workshopId) {
    throw new AppError(409, ErrorCodes.WRONG_WORKSHOP, "QR belongs to another workshop");
  }
  if (qr.registration.status !== "CONFIRMED" || qr.status !== "ACTIVE") {
    throw new AppError(409, ErrorCodes.ALREADY_CHECKED_IN, "QR is not active for check-in");
  }
  if (qr.registration.workshop.status !== "PUBLISHED") {
    throw new AppError(409, "WORKSHOP_NOT_OPEN", "Workshop is not open for check-in");
  }

  return { valid: true, message: `Valid QR for ${qr.registration.user.fullName}` };
}

export async function createOnlineCheckin(input: {
  qrPayload: string;
  workshopId: string;
  staffId: string;
  idempotencyKey: string;
}) {
  const existing = await prisma.checkin.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) {
    return { checkinId: existing.id, status: "DUPLICATE" };
  }

  const parsed = parseQrPayload(input.qrPayload);
  const tokenHash = sha256(parsed.token);

  const checkin = await prisma.$transaction(async (tx) => {
    const qr = await tx.qrToken.findUnique({
      where: { tokenHash },
      include: { registration: { include: { workshop: true } } }
    });

    if (!qr) {
      throw new AppError(400, ErrorCodes.INVALID_QR, "QR token is invalid");
    }
    if (qr.registration.workshopId !== input.workshopId) {
      throw new AppError(409, ErrorCodes.WRONG_WORKSHOP, "QR belongs to another workshop");
    }
    if (qr.status !== "ACTIVE" || qr.registration.status !== "CONFIRMED") {
      throw new AppError(409, ErrorCodes.ALREADY_CHECKED_IN, "QR already used or registration is not confirmed");
    }
    if (qr.registration.workshop.status !== "PUBLISHED") {
      throw new AppError(409, "WORKSHOP_NOT_OPEN", "Workshop is not open for check-in");
    }

    const created = await tx.checkin.create({
      data: {
        qrTokenId: qr.id,
        workshopId: input.workshopId,
        staffId: input.staffId,
        idempotencyKey: input.idempotencyKey,
        checkedInAt: new Date()
      }
    });
    await tx.qrToken.update({
      where: { id: qr.id },
      data: { status: "USED", usedAt: created.checkedInAt }
    });
    return created;
  });

  return { checkinId: checkin.id, status: "SYNCED" };
}

export async function syncOfflineCheckins(events: OfflineCheckinRecord[]): Promise<OfflineCheckinSyncResponse> {
  const results: OfflineCheckinSyncResult[] = [];

  for (const event of events) {
    results.push(await syncSingleEvent(event));
  }

  return { results };
}

async function syncSingleEvent(event: OfflineCheckinRecord): Promise<OfflineCheckinSyncResult> {
  const existingLog = await prisma.offlineCheckinSyncLog.findUnique({
    where: { deviceId_clientCheckinId: { deviceId: event.deviceId, clientCheckinId: event.clientCheckinId } }
  });

  if (existingLog) {
    return {
      clientCheckinId: event.clientCheckinId,
      status: existingLog.syncStatus as OfflineSyncStatus,
      checkinId: existingLog.checkinId ?? undefined,
      errorCode: existingLog.errorCode ?? undefined,
      message: existingLog.errorMessage ?? "Duplicate sync request returned previous result"
    };
  }

  try {
    const parsed = parseQrPayload(event.qrPayload);
    const tokenHash = sha256(parsed.token);
    const qrPayloadHash = payloadFingerprint(event.qrPayload);

    const result = await prisma.$transaction(async (tx) => {
      const qr = await tx.qrToken.findUnique({
        where: { tokenHash },
        include: { registration: { include: { workshop: true } } }
      });

      if (!qr) {
        return createConflictLog(tx, event, qrPayloadHash, OfflineSyncStatus.CONFLICT, ErrorCodes.INVALID_QR, "QR token is invalid");
      }

      if (qr.registration.workshopId !== event.workshopId) {
        return createConflictLog(tx, event, qrPayloadHash, OfflineSyncStatus.CONFLICT, ErrorCodes.WRONG_WORKSHOP, "QR belongs to another workshop");
      }

      if (qr.status !== "ACTIVE" || qr.registration.status !== "CONFIRMED") {
        return createConflictLog(
          tx,
          event,
          qrPayloadHash,
          OfflineSyncStatus.DUPLICATE,
          ErrorCodes.ALREADY_CHECKED_IN,
          "QR already used or registration is not confirmed"
        );
      }

      const checkin = await tx.checkin.create({
        data: {
          qrTokenId: qr.id,
          workshopId: event.workshopId,
          staffId: event.staffId,
          clientCheckinId: event.clientCheckinId,
          deviceId: event.deviceId,
          idempotencyKey: `${event.deviceId}:${event.clientCheckinId}`,
          checkedInAt: new Date(event.checkedInAt)
        }
      });
      await tx.qrToken.update({
        where: { id: qr.id },
        data: { status: "USED", usedAt: checkin.checkedInAt }
      });
      await tx.offlineCheckinSyncLog.create({
        data: {
          clientCheckinId: event.clientCheckinId,
          deviceId: event.deviceId,
          workshopId: event.workshopId,
          staffId: event.staffId,
          qrPayloadHash,
          syncStatus: OfflineSyncStatus.SYNCED,
          checkinId: checkin.id,
          syncedAt: new Date()
        }
      });

      return {
        clientCheckinId: event.clientCheckinId,
        status: OfflineSyncStatus.SYNCED,
        checkinId: checkin.id
      } satisfies OfflineCheckinSyncResult;
    });

    return result;
  } catch (error) {
    await prisma.offlineCheckinSyncLog.create({
      data: {
        clientCheckinId: event.clientCheckinId,
        deviceId: event.deviceId,
        workshopId: event.workshopId,
        staffId: event.staffId,
        qrPayloadHash: payloadFingerprint(event.qrPayload),
        syncStatus: OfflineSyncStatus.FAILED,
        errorCode: "SYNC_FAILED",
        errorMessage: error instanceof Error ? error.message : "Unknown sync failure",
        syncedAt: new Date()
      }
    });

    return {
      clientCheckinId: event.clientCheckinId,
      status: OfflineSyncStatus.FAILED,
      errorCode: "SYNC_FAILED",
      message: error instanceof Error ? error.message : "Unknown sync failure"
    };
  }
}

async function createConflictLog(
  tx: Prisma.TransactionClient,
  event: OfflineCheckinRecord,
  qrPayloadHash: string,
  status: OfflineSyncStatus,
  errorCode: string,
  errorMessage: string
): Promise<OfflineCheckinSyncResult> {
  await tx.offlineCheckinSyncLog.create({
    data: {
      clientCheckinId: event.clientCheckinId,
      deviceId: event.deviceId,
      workshopId: event.workshopId,
      staffId: event.staffId,
      qrPayloadHash,
      syncStatus: status,
      errorCode,
      errorMessage,
      syncedAt: new Date()
    }
  });

  return {
    clientCheckinId: event.clientCheckinId,
    status,
    errorCode,
    message: errorMessage
  };
}
