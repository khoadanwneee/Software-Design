import { buildQrPayload } from "@unihub/shared-utils";
import type { Prisma } from "@unihub/db";
import { randomToken, sha256 } from "./crypto.js";

type Tx = Prisma.TransactionClient;

export async function createQrTokenForRegistration(tx: Tx, registrationId: string) {
  const token = randomToken("qr");
  const qr = await tx.qrToken.create({
    data: {
      registrationId,
      tokenHash: sha256(token),
      tokenPreview: token,
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    }
  });

  const registration = await tx.registration.findUniqueOrThrow({
    where: { id: registrationId },
    select: { workshopId: true }
  });

  return {
    qr,
    rawToken: token,
    qrPayload: buildQrPayload({ token, registrationId, workshopId: registration.workshopId })
  };
}
