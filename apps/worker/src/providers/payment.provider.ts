export class MockWorkerPaymentProvider {
  async reconcile(providerOrderId: string) {
    console.log(`[mock-payment-reconcile] providerOrderId=${providerOrderId}`);
    return { status: "PENDING" as const };
  }
}

export const workerPaymentProvider = new MockWorkerPaymentProvider();
