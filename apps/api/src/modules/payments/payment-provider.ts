export interface PaymentSession {
  providerOrderId: string;
  paymentUrl: string;
}

export interface PaymentProvider {
  createSession(input: {
    registrationId: string;
    amount: number;
    currency: string;
    idempotencyKey: string;
  }): Promise<PaymentSession>;

  verifyWebhook(input: unknown): Promise<{
    valid: boolean;
    providerOrderId: string;
    providerTransactionId: string;
    status: "success" | "failed";
  }>;
}

export class MockPaymentProvider implements PaymentProvider {
  async createSession(input: {
    registrationId: string;
    amount: number;
    currency: string;
    idempotencyKey: string;
  }): Promise<PaymentSession> {
    if (input.idempotencyKey.includes("force-gateway-fail")) {
      throw new Error("Mock gateway failure");
    }

    const providerOrderId = `mock_order_${input.registrationId}`;
    return {
      providerOrderId,
      paymentUrl: `https://mock-payments.local/pay/${providerOrderId}?amount=${input.amount}&currency=${input.currency}`
    };
  }

  async verifyWebhook(input: unknown) {
    const payload = input as {
      signature?: string;
      providerOrderId?: string;
      providerTransactionId?: string;
      status?: "success" | "failed";
    };

    return {
      valid: payload.signature === "unihub-dev-signature",
      providerOrderId: payload.providerOrderId ?? "",
      providerTransactionId: payload.providerTransactionId ?? "",
      status: payload.status ?? "failed"
    };
  }
}

export const paymentProvider = new MockPaymentProvider();
