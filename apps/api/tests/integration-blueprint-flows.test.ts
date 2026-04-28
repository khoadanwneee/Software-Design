import { describe, it } from "vitest";

describe.skip("database-backed blueprint flows", () => {
  it("does not overbook when two registrations race for one remaining seat", async () => {
    // Requires Postgres + Prisma seed. See README test flow.
  });

  it("returns previous result for a repeated payment idempotency key", async () => {
    // Requires Postgres + Redis.
  });

  it("marks repeated offline check-in sync as duplicate/synced", async () => {
    // Requires Postgres + seeded QR token.
  });

  it("imports valid CSV rows and logs duplicate/error rows", async () => {
    // Requires worker + Postgres.
  });
});
