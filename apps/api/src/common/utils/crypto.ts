import { createHash, randomBytes } from "node:crypto";

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function randomToken(prefix: string): string {
  return `${prefix}_${randomBytes(24).toString("base64url")}`;
}
