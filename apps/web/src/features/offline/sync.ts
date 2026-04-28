import { ApiClientError } from "@unihub/api-client";
import { OfflineSyncStatus } from "@unihub/shared-types";
import { api } from "../../lib/api";
import { listPendingCheckins, updateOfflineCheckin } from "./db";

export async function syncPendingCheckins(options: { includeFailed?: boolean } = {}) {
  const pending = await listPendingCheckins(options.includeFailed);
  if (pending.length === 0) {
    return { synced: 0, failed: 0 };
  }

  try {
    const response = await api.checkinApi.syncOffline({ events: pending });
    let synced = 0;
    let failed = 0;

    await Promise.all(
      response.results.map(async (result) => {
        if ([OfflineSyncStatus.SYNCED, OfflineSyncStatus.DUPLICATE].includes(result.status)) {
          synced += 1;
        }
        if ([OfflineSyncStatus.FAILED, OfflineSyncStatus.CONFLICT].includes(result.status)) {
          failed += 1;
        }
        await updateOfflineCheckin(result.clientCheckinId, {
          syncStatus: result.status,
          lastError: result.message ?? result.errorCode ?? null
        });
      })
    );

    return { synced, failed };
  } catch (error) {
    await Promise.all(
      pending.map((record) =>
        updateOfflineCheckin(record.clientCheckinId, {
          retryCount: record.retryCount + 1,
          syncStatus: record.retryCount + 1 >= 3 ? OfflineSyncStatus.FAILED : OfflineSyncStatus.PENDING,
          lastError: error instanceof ApiClientError ? error.message : "Network or sync failure"
        })
      )
    );
    return { synced: 0, failed: pending.length };
  }
}

export function getOrCreateDeviceId() {
  const key = "unihub.deviceId";
  const existing = localStorage.getItem(key);
  if (existing) {
    return existing;
  }
  const next = crypto.randomUUID();
  localStorage.setItem(key, next);
  return next;
}
