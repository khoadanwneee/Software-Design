import { describe, it } from "vitest";

describe.skip("worker processors", () => {
  it("notification processor is idempotent by dedupeKey", async () => {
    // Requires a test database and mocked email provider.
  });

  it("student import processor logs duplicate and invalid rows", async () => {
    // Requires a test database transaction wrapper.
  });
});
