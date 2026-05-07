import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { OfflineSyncStatus, type OfflineCheckinRecord } from "@unihub/shared-types";
import {
  getOfflineQrCacheSummary,
  listOfflineCheckins,
  markCachedQrTokenUsed,
  saveOfflineCheckin,
  saveOfflineQrCache,
  updateOfflineCheckin
} from "../src/features/offline/db";
import { validateQrPayloadWithOfflineCache } from "../src/features/offline/qr-cache";

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

describe("PWA offline check-in queue", () => {
  it("persists a pending check-in in IndexedDB and updates sync status", async () => {
    const now = new Date().toISOString();
    const record: OfflineCheckinRecord = {
      clientCheckinId: "client-test-1",
      qrPayload: "qr_payload",
      workshopId: "workshop-1",
      staffId: "staff-1",
      deviceId: "device-1",
      checkedInAt: now,
      syncStatus: OfflineSyncStatus.PENDING,
      retryCount: 0,
      lastError: null,
      createdAt: now,
      updatedAt: now
    };

    await saveOfflineCheckin(record);
    expect(await listOfflineCheckins()).toEqual([record]);

    await updateOfflineCheckin(record.clientCheckinId, { syncStatus: OfflineSyncStatus.SYNCED });
    expect((await listOfflineCheckins())[0].syncStatus).toBe(OfflineSyncStatus.SYNCED);
  });

  it("preloads QR cache and validates a QR payload offline", async () => {
    const token = "qr_test_token_123456789";
    const tokenHash = sha256(token);
    const now = new Date().toISOString();
    const cacheExpiresAt = new Date(Date.now() + 60_000).toISOString();

    await saveOfflineQrCache({
      workshopId: "workshop-cache-1",
      generatedAt: now,
      expiresAt: cacheExpiresAt,
      items: [
        {
          tokenHash,
          registrationId: "registration-1",
          workshopId: "workshop-cache-1",
          studentName: "Student One",
          studentCode: "S001",
          qrExpiresAt: null,
          cacheExpiresAt
        }
      ]
    });

    await expect(
      validateQrPayloadWithOfflineCache(
        JSON.stringify({ token, registrationId: "registration-1", workshopId: "workshop-cache-1" }),
        "workshop-cache-1"
      )
    ).resolves.toMatchObject({ valid: true, tokenHash });

    await markCachedQrTokenUsed(tokenHash, now);
    await expect(
      validateQrPayloadWithOfflineCache(
        JSON.stringify({ token, registrationId: "registration-1", workshopId: "workshop-cache-1" }),
        "workshop-cache-1"
      )
    ).resolves.toMatchObject({ valid: false, reason: "USED_LOCALLY" });

    await expect(getOfflineQrCacheSummary("workshop-cache-1")).resolves.toMatchObject({
      total: 1,
      active: 0,
      usedLocally: 1
    });
  });
});
