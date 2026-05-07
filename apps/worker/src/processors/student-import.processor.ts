import type { Job } from "bullmq";
import { Role, StudentImportStatus } from "@unihub/shared-types";
import { localObjectStorage, prisma } from "@unihub/db";
import { notificationQueue } from "../queues.js";
import { parseCsv } from "./csv-parser.js";

interface StudentImportJobData {
  runId: string;
  csvText?: string;
}

const requiredHeaders = ["student_code", "email", "full_name"];

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
        className: row.class || row.class_name || existing.className,
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
