import { describe, expect, it } from "vitest";
import { OfflineSyncStatus, type OfflineCheckinRecord } from "@unihub/shared-types";
import { listOfflineCheckins, saveOfflineCheckin, updateOfflineCheckin } from "../src/features/offline/db";

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
});
