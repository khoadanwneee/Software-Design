import type { Job } from "bullmq";
import { StudentImportStatus } from "@unihub/shared-types";
import { prisma } from "@unihub/db";

interface StudentImportJobData {
  runId: string;
  csvText: string;
}

const requiredHeaders = ["student_code", "email", "full_name"];

export async function processStudentImport(job: Job<StudentImportJobData>) {
  const run = await prisma.studentImportRun.findUnique({ where: { id: job.data.runId } });
  if (!run || [StudentImportStatus.DONE, StudentImportStatus.DONE_WITH_ERRORS].includes(run.status as StudentImportStatus)) {
    return;
  }

  await prisma.studentImportRun.update({
    where: { id: job.data.runId },
    data: { status: StudentImportStatus.RUNNING, startedAt: new Date() }
  });

  const lines = job.data.csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const headers = lines[0]?.split(",").map((value) => value.trim()) ?? [];
  const missing = requiredHeaders.filter((header) => !headers.includes(header));

  if (missing.length > 0) {
    await prisma.studentImportRun.update({
      where: { id: job.data.runId },
      data: {
        status: StudentImportStatus.FAILED,
        errorMessage: `Missing headers: ${missing.join(", ")}`,
        finishedAt: new Date()
      }
    });
    return;
  }

  let successRows = 0;
  let failedRows = 0;
  const seenStudentCodes = new Set<string>();

  for (let index = 1; index < lines.length; index += 1) {
    const rowNumber = index + 1;
    const values = lines[index].split(",").map((value) => value.trim());
    const row = Object.fromEntries(headers.map((header, valueIndex) => [header, values[valueIndex] ?? ""]));
    const error = validateRow(row, seenStudentCodes);

    if (error) {
      failedRows += 1;
      await prisma.studentImportError.create({
        data: {
          runId: job.data.runId,
          rowNumber,
          studentCode: row.student_code || null,
          email: row.email || null,
          errorCode: error.code,
          errorMessage: error.message,
          rawRow: row
        }
      });
      continue;
    }

    seenStudentCodes.add(row.student_code);
    await upsertStudent(row);
    successRows += 1;
  }

  await prisma.studentImportRun.update({
    where: { id: job.data.runId },
    data: {
      status: failedRows > 0 ? StudentImportStatus.DONE_WITH_ERRORS : StudentImportStatus.DONE,
      totalRows: Math.max(lines.length - 1, 0),
      successRows,
      failedRows,
      finishedAt: new Date()
    }
  });
}

function validateRow(row: Record<string, string>, seenStudentCodes: Set<string>) {
  if (!row.student_code) {
    return { code: "MISSING_STUDENT_CODE", message: "student_code is required" };
  }
  if (!/^[A-Za-z0-9_-]{4,30}$/.test(row.student_code)) {
    return { code: "INVALID_STUDENT_CODE", message: "student_code format is invalid" };
  }
  if (!row.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
    return { code: "INVALID_EMAIL", message: "email is invalid" };
  }
  if (!row.full_name) {
    return { code: "MISSING_FULL_NAME", message: "full_name is required" };
  }
  if (seenStudentCodes.has(row.student_code)) {
    return { code: "DUPLICATE_ROW", message: "student_code appears more than once in this file" };
  }
  return null;
}

async function upsertStudent(row: Record<string, string>) {
  const existing = await prisma.studentProfile.findFirst({
    where: {
      OR: [{ studentCode: row.student_code }, { email: row.email }]
    }
  });

  if (existing) {
    await prisma.studentProfile.update({
      where: { id: existing.id },
      data: {
        studentCode: row.student_code,
        email: row.email,
        fullName: row.full_name,
        major: row.major || existing.major,
        className: row.class || existing.className,
        verifiedAt: existing.verifiedAt ?? new Date(),
        importedAt: new Date()
      }
    });
    return;
  }

  await prisma.studentProfile.create({
    data: {
      studentCode: row.student_code,
      email: row.email,
      fullName: row.full_name,
      major: row.major || null,
      className: row.class || null,
      verifiedAt: new Date(),
      importedAt: new Date()
    }
  });
}
