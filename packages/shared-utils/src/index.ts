import type { QrPayload } from "@unihub/shared-types";

export const ErrorCodes = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  RATE_LIMITED: "RATE_LIMITED",
  NOT_FOUND: "NOT_FOUND",
  WORKSHOP_FULL: "WORKSHOP_FULL",
  DUPLICATE_REGISTRATION: "DUPLICATE_REGISTRATION",
  IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT",
  PAYMENT_UNAVAILABLE: "PAYMENT_UNAVAILABLE",
  INVALID_QR: "INVALID_QR",
  ALREADY_CHECKED_IN: "ALREADY_CHECKED_IN",
  WRONG_WORKSHOP: "WRONG_WORKSHOP",
  CSV_IMPORT_FAILED: "CSV_IMPORT_FAILED"
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export function nowIso(): string {
  return new Date().toISOString();
}

export function isPastIso(value: string): boolean {
  return new Date(value).getTime() < Date.now();
}

export function minutesBetween(startIso: string, endIso: string): number {
  return Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000);
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

export function payloadFingerprint(value: unknown): string {
  const input = stableStringify(value);
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33) ^ input.charCodeAt(index);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function createClientId(prefix = "client"): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${prefix}_${random}`;
}

export function buildQrPayload(payload: QrPayload): string {
  return JSON.stringify({
    token: payload.token,
    registrationId: payload.registrationId,
    workshopId: payload.workshopId,
    issuedAt: payload.issuedAt ?? nowIso()
  });
}

export function parseQrPayload(raw: string): QrPayload {
  try {
    const parsed = JSON.parse(raw) as Partial<QrPayload>;
    if (!parsed.token || typeof parsed.token !== "string") {
      throw new Error("QR token is missing");
    }
    return parsed as QrPayload;
  } catch {
    if (raw.trim().length < 12) {
      throw new Error("QR payload is invalid");
    }
    return { token: raw.trim() };
  }
}
