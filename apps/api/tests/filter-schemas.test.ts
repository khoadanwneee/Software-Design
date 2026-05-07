import { describe, expect, it } from "vitest";
import { RoomStatus, Role, UserStatus } from "@unihub/shared-types";
import { roomBodySchema, updateRoomStatusSchema } from "../src/modules/rooms/room.schemas";
import { userListQuerySchema } from "../src/modules/users/user.schemas";
import { workshopListQuerySchema } from "../src/modules/workshops/workshop.schemas";
import { offlineCacheQuerySchema } from "../src/modules/checkins/checkin.schemas";
import { notificationListQuerySchema } from "../src/modules/notifications/notification.schemas";
import { studentImportListQuerySchema, studentImportUploadFieldsSchema } from "../src/modules/student-import/student-import.schemas";

describe("query and admin form schemas", () => {
  it("parses workshop filters without coercing false to true", () => {
    expect(
      workshopListQuerySchema.parse({
        keyword: "ai",
        hasSeats: "false",
        priceType: "free",
        page: "2",
        limit: "10"
      })
    ).toMatchObject({
      keyword: "ai",
      hasSeats: false,
      priceType: "free",
      page: 2,
      limit: 10
    });
  });

  it("validates room status and capacity", () => {
    expect(roomBodySchema.parse({ name: "Hall A", capacity: 80, status: RoomStatus.ACTIVE })).toMatchObject({
      name: "Hall A",
      capacity: 80,
      status: RoomStatus.ACTIVE
    });
    expect(() => updateRoomStatusSchema.parse({ status: "DELETED" })).toThrow();
  });

  it("parses admin user filters", () => {
    expect(userListQuerySchema.parse({ role: Role.ADMIN, status: UserStatus.ACTIVE, limit: "25" })).toMatchObject({
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      limit: 25
    });
  });

  it("parses notification list filters with safe pagination", () => {
    expect(notificationListQuerySchema.parse({ status: "UNREAD", page: "2", limit: "10" })).toMatchObject({
      status: "UNREAD",
      page: 2,
      limit: 10
    });
    expect(() => notificationListQuerySchema.parse({ limit: "1000" })).toThrow();
  });

  it("validates offline check-in cache query", () => {
    expect(offlineCacheQuerySchema.parse({ workshopId: "workshop-1" })).toEqual({ workshopId: "workshop-1" });
    expect(() => offlineCacheQuerySchema.parse({})).toThrow();
  });

  it("parses student import upload fields and list filters", () => {
    expect(studentImportUploadFieldsSchema.parse({ importType: "STUDENT_NIGHTLY", dryRun: "true" })).toMatchObject({
      importType: "STUDENT_NIGHTLY",
      dryRun: true
    });
    expect(studentImportListQuerySchema.parse({ page: "2", limit: "10", status: "DONE" })).toMatchObject({
      page: 2,
      limit: 10,
      status: "DONE"
    });
  });
});
