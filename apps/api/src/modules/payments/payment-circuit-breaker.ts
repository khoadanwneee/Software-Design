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
  console.log("[CB] CHECK STATE:", {
    current: state.current,
    failures: state.failures,
    openedAt: state.openedAt
  });

  if (
    state.current === "OPEN" &&
    Date.now() - state.openedAt > state.recoveryAfterMs
  ) {
    console.log("[CB] OPEN → HALF_OPEN");
    state.current = "HALF_OPEN";
  }

  return {
    state: state.current,
    failures: state.failures,
    openedAt: state.openedAt || null
  };
}

export async function executePaymentCall<T>(
  operation: () => Promise<T>
): Promise<T> {

  const circuit = getPaymentCircuitState();

  console.log("[CB] ENTER executePaymentCall:", {
    state: circuit.state
  });

  if (circuit.state === "OPEN") {
    console.log("[CB] BLOCKED REQUEST (OPEN STATE)");

    throw new AppError(
      503,
      ErrorCodes.PAYMENT_UNAVAILABLE,
      "Payment gateway is temporarily unavailable"
    );
  }

  try {
    console.log("[CB] EXECUTING OPERATION");

    const result = await operation();

    console.log("[CB] SUCCESS");

    state.current = "CLOSED";
    state.failures = 0;
    state.openedAt = 0;

    console.log("[CB] RESET → CLOSED");

    return result;

  } catch (error) {

    state.failures += 1;

    console.log("[CB] FAILURE OCCURRED:", {
      failures: state.failures
    });

    if (state.failures >= state.failureThreshold) {
      state.current = "OPEN";
      state.openedAt = Date.now();

      console.log("[CB] TRANSITION → OPEN");
    }

    throw error;
  }
}