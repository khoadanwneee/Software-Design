import type { OfflineQrCacheEntry } from "@unihub/shared-types";
import { parseQrPayload } from "@unihub/shared-utils";
import { getCachedQrToken } from "./db";

export type OfflineQrValidationResult =
  | { valid: true; entry: OfflineQrCacheEntry; tokenHash: string; message: string }
  | { valid: false; reason: string; message: string };

async function sha256Hex(value: string) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto is not available");
  }

  const data = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function isExpired(value?: string | null) {
  return Boolean(value && new Date(value).getTime() <= Date.now());
}

export async function validateQrPayloadWithOfflineCache(
  qrPayload: string,
  workshopId: string
): Promise<OfflineQrValidationResult> {
  let parsed;
  try {
    parsed = parseQrPayload(qrPayload);
  } catch {
    return { valid: false, reason: "INVALID_FORMAT", message: "QR payload format is invalid." };
  }

  if (parsed.workshopId && parsed.workshopId !== workshopId) {
    return { valid: false, reason: "WRONG_WORKSHOP", message: "QR belongs to another workshop." };
  }

  let tokenHash: string;
  try {
    tokenHash = await sha256Hex(parsed.token);
  } catch {
    return {
      valid: false,
      reason: "CRYPTO_UNAVAILABLE",
      message: "Offline QR validation is not supported by this browser."
    };
  }

  const entry = await getCachedQrToken(tokenHash);
  if (!entry || entry.workshopId !== workshopId) {
    return {
      valid: false,
      reason: "CACHE_MISS",
      message: "QR is not in the offline cache. Go online and sync the QR cache for this workshop."
    };
  }

  if (isExpired(entry.cacheExpiresAt)) {
    return {
      valid: false,
      reason: "CACHE_EXPIRED",
      message: "Offline QR cache has expired. Go online and sync the cache again."
    };
  }

  if (isExpired(entry.qrExpiresAt)) {
    return { valid: false, reason: "QR_EXPIRED", message: "QR token has expired." };
  }

  if (entry.localStatus === "USED_LOCALLY") {
    return {
      valid: false,
      reason: "USED_LOCALLY",
      message: "QR was already scanned on this device and is waiting for sync."
    };
  }

  return {
    valid: true,
    entry,
    tokenHash,
    message: entry.studentName ? `Offline cache matched ${entry.studentName}.` : "Offline cache matched this QR."
  };
}
