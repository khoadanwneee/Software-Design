import { describe, expect, it } from "vitest";
import { payloadFingerprint } from "@unihub/shared-utils";

describe("idempotency payload fingerprint", () => {
  it("is stable for equivalent payloads with different key order", () => {
    expect(payloadFingerprint({ workshopId: "w1", amount: 99000 })).toEqual(
      payloadFingerprint({ amount: 99000, workshopId: "w1" })
    );
  });
});
