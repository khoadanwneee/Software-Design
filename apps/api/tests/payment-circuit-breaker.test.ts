import { describe, expect, it } from "vitest";
import { executePaymentCall } from "../src/modules/payments/payment-circuit-breaker";

describe("payment circuit breaker", () => {
  it("opens after repeated gateway failures", async () => {
    await expect(executePaymentCall(async () => Promise.reject(new Error("gateway down")))).rejects.toThrow("gateway down");
    await expect(executePaymentCall(async () => Promise.reject(new Error("gateway down")))).rejects.toThrow("gateway down");
    await expect(executePaymentCall(async () => Promise.reject(new Error("gateway down")))).rejects.toThrow("gateway down");
    await expect(executePaymentCall(async () => "ok")).rejects.toMatchObject({ statusCode: 503 });
  });
});
