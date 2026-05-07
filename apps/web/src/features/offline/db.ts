import Dexie, { type Table } from "dexie";
import {
  OfflineSyncStatus,
  type OfflineCheckinCacheResponse,
  type OfflineCheckinRecord,
  type OfflineQrCacheEntry
} from "@unihub/shared-types";

class UniHubOfflineDb extends Dexie {
  checkins!: Table<OfflineCheckinRecord, string>;
  qrCache!: Table<OfflineQrCacheEntry, string>;

  constructor() {
    super("unihub-offline-db");
    this.version(1).stores({
      checkins: "clientCheckinId, syncStatus, workshopId, staffId, deviceId, updatedAt"
    });
    this.version(2).stores({
      checkins: "clientCheckinId, syncStatus, workshopId, staffId, deviceId, updatedAt",
      qrCache: "tokenHash, workshopId, registrationId, cacheExpiresAt, localStatus, syncedAt"
    });
  }
}

export const offlineDb = new UniHubOfflineDb();

export async function saveOfflineCheckin(record: OfflineCheckinRecord) {
  await offlineDb.checkins.put(record, record.clientCheckinId);
}

export async function listOfflineCheckins() {
  return offlineDb.checkins.orderBy("updatedAt").reverse().toArray();
}

export async function listPendingCheckins(includeFailed = false) {
  const statuses = includeFailed ? [OfflineSyncStatus.PENDING, OfflineSyncStatus.FAILED] : [OfflineSyncStatus.PENDING];
  const maxRetries = includeFailed ? 5 : 3;
  const all = await offlineDb.checkins.toArray();
  return all.filter((record) => statuses.includes(record.syncStatus) && record.retryCount < maxRetries);
}

export async function updateOfflineCheckin(
  clientCheckinId: string,
  patch: Partial<Omit<OfflineCheckinRecord, "clientCheckinId">>
) {
  await offlineDb.checkins.update(clientCheckinId, {
    ...patch,
    updatedAt: new Date().toISOString()
  });
}

export async function saveOfflineQrCache(response: OfflineCheckinCacheResponse) {
  const syncedAt = response.generatedAt;
  const incomingTokenHashes = new Set(response.items.map((item) => item.tokenHash));

  await offlineDb.transaction("rw", offlineDb.qrCache, async () => {
    const existing = await offlineDb.qrCache.where("workshopId").equals(response.workshopId).toArray();
    const existingByHash = new Map(existing.map((entry) => [entry.tokenHash, entry]));

    await Promise.all(
      existing
        .filter((entry) => !incomingTokenHashes.has(entry.tokenHash))
        .map((entry) => offlineDb.qrCache.delete(entry.tokenHash))
    );

    await Promise.all(
      response.items.map((item) => {
        const existingEntry = existingByHash.get(item.tokenHash);
        const preserveLocalUse = existingEntry?.localStatus === "USED_LOCALLY";
        const entry: OfflineQrCacheEntry = {
          ...item,
          syncedAt,
          localStatus: preserveLocalUse ? "USED_LOCALLY" : "ACTIVE",
          localUsedAt: preserveLocalUse ? existingEntry.localUsedAt ?? null : null
        };
        return offlineDb.qrCache.put(entry, entry.tokenHash);
      })
    );
  });
}

export async function getCachedQrToken(tokenHash: string) {
  return offlineDb.qrCache.get(tokenHash);
}

export async function markCachedQrTokenUsed(tokenHash: string, usedAt: string) {
  await offlineDb.qrCache.update(tokenHash, {
    localStatus: "USED_LOCALLY",
    localUsedAt: usedAt
  });
}

export async function getOfflineQrCacheSummary(workshopId: string) {
  const entries = await offlineDb.qrCache.where("workshopId").equals(workshopId).toArray();
  const active = entries.filter((entry) => entry.localStatus === "ACTIVE").length;
  const usedLocally = entries.filter((entry) => entry.localStatus === "USED_LOCALLY").length;
  const latestSyncedAt = entries
    .map((entry) => entry.syncedAt)
    .sort()
    .at(-1) ?? null;
  const cacheExpiresAt = entries
    .map((entry) => entry.cacheExpiresAt)
    .sort()
    .at(0) ?? null;

  return {
    total: entries.length,
    active,
    usedLocally,
    latestSyncedAt,
    cacheExpiresAt
  };
}
