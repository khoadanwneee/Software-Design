import type { Job } from "bullmq";
import { Role, StudentImportStatus } from "@unihub/shared-types";
import { Prisma, localObjectStorage, prisma } from "@unihub/db";
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
    const seenEmails = new Set<string>();
    const dataRows = parsed.rows.slice(1);

    for (let index = 0; index < dataRows.length; index += 1) {
      const rowNumber = index + 2;
      const rawRow = Object.fromEntries(headers.map((header, valueIndex) => [header, dataRows[index][valueIndex]?.trim() ?? ""]));
      const normalized = normalizeRow(rawRow);
      const error = validateRow(normalized, seenStudentCodes, seenEmails);

      if (error) {
        failedRows += 1;
        await prisma.studentImportError.create({
          data: {
            runId: run.id,
            rowNumber,
            studentCode: normalized.studentCode || null,
            email: normalized.email || null,
            errorCode: error.code,
            errorMessage: error.message,
            rawRow
          }
        });
        continue;
      }

      seenStudentCodes.add(normalized.studentCode);
      seenEmails.add(normalized.email);
      if (!run.dryRun) {
        try {
          const result = await importStudent(normalized);
          if (result?.error) {
            failedRows += 1;
            await prisma.studentImportError.create({
              data: {
                runId: run.id,
                rowNumber,
                studentCode: normalized.studentCode,
                email: normalized.email,
                errorCode: result.error.code,
                errorMessage: result.error.message,
                rawRow
              }
            });
            continue;
          }
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            failedRows += 1;
            await prisma.studentImportError.create({
              data: {
                runId: run.id,
                rowNumber,
                studentCode: normalized.studentCode,
                email: normalized.email,
                errorCode: "UNIQUE_CONSTRAINT",
                errorMessage: "unique constraint violation while importing row",
                rawRow
              }
            });
            continue;
          }
          throw error;
        }
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

interface NormalizedRow {
  studentCode: string;
  email: string;
  fullName: string;
  major?: string;
  className?: string;
}

function normalizeRow(row: Record<string, string>): NormalizedRow {
  return {
    studentCode: (row.student_code ?? "").trim().toUpperCase(),
    email: (row.email ?? "").trim().toLowerCase(),
    fullName: (row.full_name ?? "").trim(),
    major: (row.major ?? "").trim() || undefined,
    className: (row.class ?? row.class_name ?? "").trim() || undefined
  };
}

function validateRow(row: NormalizedRow, seenStudentCodes: Set<string>, seenEmails: Set<string>) {
  if (!row.studentCode) {
    return { code: "MISSING_STUDENT_CODE", message: "student_code is required" };
  }
  if (!STUDENT_CODE_PATTERN.test(row.studentCode)) {
    return { code: "INVALID_STUDENT_CODE", message: "student_code must match format SV + 6 digits (e.g. SV202610)" };
  }
  const expectedEmail = `${row.studentCode.toLowerCase()}@unihub.local`;
  if (!row.email || row.email !== expectedEmail) {
    return { code: "INVALID_EMAIL", message: `email must match ${expectedEmail}` };
  }
  if (!row.fullName) {
    return { code: "MISSING_FULL_NAME", message: "full_name is required" };
  }
  if (seenStudentCodes.has(row.studentCode)) {
    return { code: "DUPLICATE_ROW", message: "student_code appears more than once in this file" };
  }
  if (seenEmails.has(row.email)) {
    return { code: "DUPLICATE_EMAIL", message: "email appears more than once in this file" };
  }
  return null;
}

async function importStudent(row: NormalizedRow) {
  const studentCode = row.studentCode;
  const email = row.email;
  const passwordSuffix = studentCode.slice(-2);
  const plainPassword = `${PASSWORD_PREFIX}${passwordSuffix}`;
  const passwordHash = await bcrypt.hash(plainPassword, PASSWORD_ROUNDS);

  return prisma.$transaction(async (tx) => {
    const existingByCode = await tx.studentProfile.findUnique({
      where: { studentCode }
    });
    if (existingByCode && existingByCode.email !== email) {
      return {
        error: {
          code: "STUDENT_CODE_EMAIL_CONFLICT",
          message: "student_code already exists with a different email"
        }
      };
    }

    const existingByEmail = existingByCode
      ? null
      : await tx.studentProfile.findUnique({
          where: { email }
        });
    if (existingByEmail && existingByEmail.studentCode !== studentCode) {
      return {
        error: {
          code: "EMAIL_STUDENT_CODE_CONFLICT",
          message: "email already exists with a different student_code"
        }
      };
    }

    const existingUser = await tx.user.findUnique({
      where: { email },
      select: { id: true, roles: true }
    });

    let userId: string | null = null;
    if (existingUser) {
      userId = existingUser.id;
      if (!existingUser.roles.includes(Role.STUDENT)) {
        await tx.user.update({
          where: { id: existingUser.id },
          data: { roles: [...existingUser.roles, Role.STUDENT] }
        });
      }
    } else {
      const createdUser = await tx.user.create({
        data: {
          email,
          fullName: row.fullName,
          passwordHash,
          roles: [Role.STUDENT],
          status: "ACTIVE"
        },
        select: { id: true }
      });
      userId = createdUser.id;
    }

    const existingProfile = existingByCode ?? existingByEmail;
    if (existingProfile) {
      if (existingProfile.userId && userId && existingProfile.userId !== userId) {
        return {
          error: {
            code: "USER_PROFILE_MISMATCH",
            message: "student profile is linked to a different user"
          }
        };
      }

      await tx.studentProfile.update({
        where: { id: existingProfile.id },
        data: {
          userId: existingProfile.userId ?? userId,
          major: existingProfile.major ?? row.major ?? null,
          className: existingProfile.className ?? row.className ?? null,
          verifiedAt: existingProfile.verifiedAt ?? new Date(),
          importedAt: new Date()
        }
      });
      return { error: null };
    }

    await tx.studentProfile.create({
      data: {
        userId,
        studentCode,
        email,
        fullName: row.fullName,
        major: row.major ?? null,
        className: row.className ?? null,
        verifiedAt: new Date(),
        importedAt: new Date()
      }
    });

    return { error: null };
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
  const userIds = new Set(admins.map((admin: { id: string }) => admin.id));
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
