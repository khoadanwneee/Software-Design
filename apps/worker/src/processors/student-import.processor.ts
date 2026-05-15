import type { Job } from "bullmq";
import { Role, StudentImportStatus } from "@unihub/shared-types";
import { localObjectStorage, prisma } from "@unihub/db";
import bcrypt from "bcryptjs";
import { notificationQueue } from "../queues.js";
import { parseCsv } from "./csv-parser.js";

interface StudentImportJobData {
  runId: string;
  csvText?: string;
}

const requiredHeaders = ["student_code", "email", "full_name"];
const STUDENT_CODE_PATTERN = /^SV\d{6}$/;
const PASSWORD_PREFIX = "KHTN@";
const PASSWORD_ROUNDS = 10;

export async function processStudentImport(job: Job<StudentImportJobData>) {
  const run = await prisma.studentImportRun.findUnique({
    where: { id: job.data.runId },
    include: { file: true }
  });
  if (!run || [StudentImportStatus.DONE, StudentImportStatus.DONE_WITH_ERRORS].includes(run.status as StudentImportStatus)) {
    return;
  }

  await prisma.studentImportRun.update({
    where: { id: job.data.runId },
    data: { status: StudentImportStatus.RUNNING, startedAt: new Date(), errorMessage: null }
  });
  await prisma.studentImportError.deleteMany({ where: { runId: job.data.runId } });

  try {
    const csvText = await getCsvText(job.data.csvText, run.file?.storageKey);
    const parsed = parseCsv(csvText);
    const headers = parsed.rows[0]?.map((value) => value.trim()) ?? [];
    const missing = requiredHeaders.filter((header) => !headers.includes(header));

    if (missing.length > 0) {
      await markRunFailed(run.id, run.createdById, `Missing headers: ${missing.join(", ")}`);
      return;
    }

    let successRows = 0;
    let failedRows = 0;
    const seenStudentCodes = new Set<string>();
    const dataRows = parsed.rows.slice(1);

    for (let index = 0; index < dataRows.length; index += 1) {
      const rowNumber = index + 2;
      const row = Object.fromEntries(headers.map((header, valueIndex) => [header, dataRows[index][valueIndex]?.trim() ?? ""]));
      const error = validateRow(row, seenStudentCodes);

      if (error) {
        failedRows += 1;
        await prisma.studentImportError.create({
          data: {
            runId: run.id,
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
      if (!run.dryRun) {
        await upsertStudent(row);
      }
      successRows += 1;
    }

    const status = failedRows > 0 ? StudentImportStatus.DONE_WITH_ERRORS : StudentImportStatus.DONE;
    await prisma.studentImportRun.update({
      where: { id: run.id },
      data: {
        status,
        totalRows: dataRows.length,
        successRows,
        failedRows,
        finishedAt: new Date()
      }
    });
    await writeCompletionAudit(run.id, run.createdById, status, { totalRows: dataRows.length, successRows, failedRows });
    await notifyImportFinished(run.id, run.createdById, status, successRows, failedRows);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown student import failure";
    await markRunFailed(run.id, run.createdById, message);
  }
}

async function getCsvText(csvText?: string, storageKey?: string | null) {
  if (storageKey) {
    return localObjectStorage.readText(storageKey);
  }
  if (csvText) {
    return csvText;
  }
  throw new Error("Import run has no CSV source");
}

async function markRunFailed(runId: string, actorId: string | null, message: string) {
  await prisma.studentImportRun.update({
    where: { id: runId },
    data: {
      status: StudentImportStatus.FAILED,
      errorMessage: message,
      finishedAt: new Date()
    }
  });
  await writeCompletionAudit(runId, actorId, StudentImportStatus.FAILED, { errorMessage: message });
  await notifyImportFinished(runId, actorId, StudentImportStatus.FAILED, 0, 0, message);
}

function validateRow(row: Record<string, string>, seenStudentCodes: Set<string>) {
  if (!row.student_code) {
    return { code: "MISSING_STUDENT_CODE", message: "student_code is required" };
  }
  if (!STUDENT_CODE_PATTERN.test(row.student_code)) {
    return { code: "INVALID_STUDENT_CODE", message: "student_code must match format SV + 6 digits (e.g. SV202610)" };
  }
  const expectedEmail = `${row.student_code.toLowerCase()}@unihub.local`;
  if (!row.email || row.email.toLowerCase() !== expectedEmail) {
    return { code: "INVALID_EMAIL", message: `email must match ${expectedEmail}` };
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
  const studentCode = row.student_code.toUpperCase();
  const email = row.email.toLowerCase();
  const passwordSuffix = studentCode.slice(-2);
  const plainPassword = `${PASSWORD_PREFIX}${passwordSuffix}`;
  const passwordHash = await bcrypt.hash(plainPassword, PASSWORD_ROUNDS);

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, roles: true }
  });

  let userId: string;
  if (existingUser) {
    const roles = existingUser.roles.includes(Role.STUDENT)
      ? existingUser.roles
      : [...existingUser.roles, Role.STUDENT];

    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        fullName: row.full_name,
        passwordHash,
        roles,
        status: "ACTIVE"
      }
    });
    userId = existingUser.id;
  } else {
    const createdUser = await prisma.user.create({
      data: {
        email,
        fullName: row.full_name,
        passwordHash,
        roles: [Role.STUDENT],
        status: "ACTIVE"
      },
      select: { id: true }
    });
    userId = createdUser.id;
  }

  const existing = await prisma.studentProfile.findFirst({
    where: {
      OR: [{ studentCode }, { email }]
    }
  });

  if (existing) {
    await prisma.studentProfile.update({
      where: { id: existing.id },
      data: {
        userId,
        studentCode,
        email,
        fullName: row.full_name,
        major: row.major || existing.major,
        className: row.class || row.class_name || existing.className,
        verifiedAt: existing.verifiedAt ?? new Date(),
        importedAt: new Date()
      }
    });
    return;
  }

  await prisma.studentProfile.create({
    data: {
      userId,
      studentCode,
      email,
      fullName: row.full_name,
      major: row.major || null,
      className: row.class || row.class_name || null,
      verifiedAt: new Date(),
      importedAt: new Date()
    }
  });
}

async function writeCompletionAudit(
  runId: string,
  actorId: string | null,
  status: StudentImportStatus,
  payload: Record<string, unknown>
) {
  await prisma.auditLog.create({
    data: {
      actorId,
      action: status === StudentImportStatus.FAILED ? "STUDENT_IMPORT_FAILED" : "STUDENT_IMPORT_COMPLETED",
      entityType: "StudentImportRun",
      entityId: runId,
      newValue: { status, ...payload }
    }
  });
}

async function notifyImportFinished(
  runId: string,
  creatorId: string | null,
  status: StudentImportStatus,
  successRows: number,
  failedRows: number,
  errorMessage?: string
) {
  const admins = await prisma.user.findMany({
    where: { roles: { has: Role.ADMIN }, status: "ACTIVE" },
    select: { id: true }
  });
  const userIds = new Set(admins.map((admin) => admin.id));
  if (creatorId) {
    userIds.add(creatorId);
  }

  const title = status === StudentImportStatus.FAILED ? "Student import failed" : "Student import completed";
  const body =
    status === StudentImportStatus.FAILED
      ? errorMessage ?? "Student import failed."
      : `Imported ${successRows} row(s), ${failedRows} row(s) failed.`;

  await Promise.allSettled(
    Array.from(userIds).map((userId) =>
      notificationQueue.add(
        "student_import.finished",
        {
          eventType: "student_import.finished",
          userId,
          dedupeKey: `student-import:${runId}:${userId}:${status}`,
          title,
          body
        },
        { jobId: `student-import:${runId}:${userId}:${status}` }
      )
    )
  );
}
