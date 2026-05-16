import { describe, expect, it } from "vitest";
import { resolveNotificationRecipients } from "../src/modules/notifications/recipient-resolver";

describe("blueprint flow helpers", () => {
  it("resolves notification recipients from confirmed workshop registrations only", async () => {
    const client = {
      registration: {
        findMany: async ({ where }: any) => {
          expect(where).toMatchObject({ workshopId: "workshop-1", status: "CONFIRMED" });
          return [{ userId: "student-1" }, { userId: "student-2" }];
        }
      }
    };

    await expect(
      resolveNotificationRecipients("workshop.changed", { workshopId: "workshop-1" }, client as any)
    ).resolves.toEqual(["student-1", "student-2"]);
  });

  it("keeps direct notification recipients when userId is already known", async () => {
    const client = {
      registration: {
        findMany: async () => {
          throw new Error("registration lookup should not be called");
        }
      }
    };

    await expect(
      resolveNotificationRecipients("registration.confirmed", { userId: "student-1" }, client as any)
    ).resolves.toEqual(["student-1"]);
  });
});
