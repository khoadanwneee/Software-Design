import { describe, expect, it } from "vitest";
import { parseCsv } from "../src/processors/csv-parser";

describe("CSV parser", () => {
  it("supports quoted commas and newlines", () => {
    const csv = 'student_code,email,full_name,major\r\nS001,s1@example.com,"Nguyen, An","Computer\nScience"\r\n';
    expect(parseCsv(csv).rows).toEqual([
      ["student_code", "email", "full_name", "major"],
      ["S001", "s1@example.com", "Nguyen, An", "Computer\nScience"]
    ]);
  });

  it("supports escaped quotes", () => {
    const csv = 'student_code,email,full_name\nS002,s2@example.com,"Tran ""B"""\n';
    expect(parseCsv(csv).rows[1]).toEqual(["S002", "s2@example.com", 'Tran "B"']);
  });
});

describe.skip("worker processors", () => {
  it("notification processor is idempotent by dedupeKey", async () => {
    // Requires a test database and mocked email provider.
  });

  it("student import processor logs duplicate and invalid rows", async () => {
    // Requires a test database transaction wrapper.
  });
});
