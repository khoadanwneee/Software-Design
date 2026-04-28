import { ErrorCodes } from "@unihub/shared-utils";
import { AppError } from "../../common/errors/app-error.js";

type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

const state = {
  current: "CLOSED" as CircuitState,
  failures: 0,
  openedAt: 0,
  failureThreshold: 3,
  recoveryAfterMs: 30_000
};

export function getPaymentCircuitState() {
  if (state.current === "OPEN" && Date.now() - state.openedAt > state.recoveryAfterMs) {
    state.current = "HALF_OPEN";
  }
  return { state: state.current, failures: state.failures, openedAt: state.openedAt || null };
}

export async function executePaymentCall<T>(operation: () => Promise<T>): Promise<T> {
  const circuit = getPaymentCircuitState();
  if (circuit.state === "OPEN") {
    throw new AppError(503, ErrorCodes.PAYMENT_UNAVAILABLE, "Payment gateway is temporarily unavailable");
  }

  try {
    const result = await operation();
    state.current = "CLOSED";
    state.failures = 0;
    state.openedAt = 0;
    return result;
  } catch (error) {
    state.failures += 1;
    if (state.failures >= state.failureThreshold) {
      state.current = "OPEN";
      state.openedAt = Date.now();
    }
    throw error;
  }
}
