import Dexie, { type Table } from "dexie";
import { OfflineSyncStatus, type OfflineCheckinRecord } from "@unihub/shared-types";

class UniHubOfflineDb extends Dexie {
  checkins!: Table<OfflineCheckinRecord, string>;

  constructor() {
    super("unihub-offline-db");
    this.version(1).stores({
      checkins: "clientCheckinId, syncStatus, workshopId, staffId, deviceId, updatedAt"
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
