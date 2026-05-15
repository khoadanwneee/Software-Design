import { Worker } from "bullmq";
import { StudentImportStatus } from "@unihub/shared-types";
import { localObjectStorage, prisma } from "@unihub/db";
import { logRedisUnavailable, redisConnection } from "../../config/redis.js";

type StudentImportJob = {
  runId: string;
  csvText?: string;
};

type ParsedRow = {
  rowNumber: number;
  data: Record<string, string>;
};

function normalizeHeader(value: string) {
  const key = value.trim().toLowerCase();
  if (["studentcode", "student_code", "mssv", "studentid"].includes(key)) {
    return "studentCode";
  }
  if (["email", "mail"].includes(key)) {
    return "email";
  }
  if (["fullname", "full_name", "name", "hoten"].includes(key)) {
    return "fullName";
  }
  if (["major", "khoa"].includes(key)) {
    return "major";
  }
  if (["classname", "class_name", "class", "lop"].includes(key)) {
    return "className";
  }
  return key;
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuote = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === "\"") {
      if (inQuote && line[i + 1] === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuote = !inQuote;
      }
      continue;
    }
    if (char === "," && !inQuote) {
      values.push(current);
      current = "";
      continue;
    }
    current += char;
  }

  values.push(current);
  return values.map((value) => value.trim());
}

function parseCsv(text: string): ParsedRow[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    throw new Error("CSV must include header and at least one data row");
  }

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cells = parseCsvLine(lines[i]);
    const data: Record<string, string> = {};
    headers.forEach((header, idx) => {
      data[header] = cells[idx] ?? "";
    });
    rows.push({ rowNumber: i + 1, data });
  }

  return rows;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function processStudentImport(jobData: StudentImportJob) {
  const run = await prisma.studentImportRun.findUnique({
    where: { id: jobData.runId },
    include: { file: true }
  });

  if (!run) {
    return;
  }

  if (
    run.status === StudentImportStatus.DONE ||
    run.status === StudentImportStatus.DONE_WITH_ERRORS
  ) {
    return;
  }

  await prisma.studentImportRun.update({
    where: { id: run.id },
    data: {
      status: StudentImportStatus.RUNNING,
      startedAt: new Date(),
      errorMessage: null
    }
  });

  try {
    const csvText =
      jobData.csvText ??
      (run.file?.storageKey
        ? await localObjectStorage.readText(run.file.storageKey)
        : "");

    if (!csvText) {
      throw new Error("CSV content not found for this import run");
    }

    const parsedRows = parseCsv(csvText);
    const errors: Array<{
      runId: string;
      rowNumber: number;
      studentCode?: string;
      email?: string;
      errorCode: string;
      errorMessage: string;
      rawRow: object;
    }> = [];

    const validRows: Array<{
      rowNumber: number;
      studentCode: string;
      email: string;
      fullName: string;
      major: string | null;
      className: string | null;
      rawRow: object;
    }> = [];

    const seenStudentCode = new Set<string>();
    const seenEmail = new Set<string>();

    for (const row of parsedRows) {
      const studentCode = (row.data.studentCode || "").trim();
      const email = (row.data.email || "").trim().toLowerCase();
      const fullName = (row.data.fullName || "").trim();
      const major = (row.data.major || "").trim() || null;
      const className = (row.data.className || "").trim() || null;

      if (!studentCode || !email || !fullName) {
        errors.push({
          runId: run.id,
          rowNumber: row.rowNumber,
          studentCode,
          email,
          errorCode: "MISSING_REQUIRED_FIELD",
          errorMessage: "studentCode, email, fullName are required",
          rawRow: row.data
        });
        continue;
      }

      if (!isValidEmail(email)) {
        errors.push({
          runId: run.id,
          rowNumber: row.rowNumber,
          studentCode,
          email,
          errorCode: "INVALID_EMAIL",
          errorMessage: "Email format is invalid",
          rawRow: row.data
        });
        continue;
      }

      if (seenStudentCode.has(studentCode) || seenEmail.has(email)) {
        errors.push({
          runId: run.id,
          rowNumber: row.rowNumber,
          studentCode,
          email,
          errorCode: "DUPLICATE_IN_FILE",
          errorMessage: "Duplicate studentCode or email in CSV file",
          rawRow: row.data
        });
        continue;
      }

      seenStudentCode.add(studentCode);
      seenEmail.add(email);

      validRows.push({
        rowNumber: row.rowNumber,
        studentCode,
        email,
        fullName,
        major,
        className,
        rawRow: row.data
      });
    }

    if (!run.dryRun) {
      for (const row of validRows) {
        try {
          const user = await prisma.user.findUnique({
            where: { email: row.email },
            select: { id: true }
          });

          await prisma.studentProfile.upsert({
            where: { studentCode: row.studentCode },
            update: {
              email: row.email,
              fullName: row.fullName,
              major: row.major,
              className: row.className,
              importedAt: new Date(),
              verifiedAt: new Date(),
              userId: user?.id ?? null
            },
            create: {
              studentCode: row.studentCode,
              email: row.email,
              fullName: row.fullName,
              major: row.major,
              className: row.className,
              importedAt: new Date(),
              verifiedAt: new Date(),
              userId: user?.id ?? null
            }
          });
        } catch (error) {
          errors.push({
            runId: run.id,
            rowNumber: row.rowNumber,
            studentCode: row.studentCode,
            email: row.email,
            errorCode: "UPSERT_FAILED",
            errorMessage: error instanceof Error ? error.message : "Failed to upsert student profile",
            rawRow: row.rawRow
          });
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.studentImportError.deleteMany({ where: { runId: run.id } });
      if (errors.length > 0) {
        await tx.studentImportError.createMany({
          data: errors.map((error) => ({
            runId: error.runId,
            rowNumber: error.rowNumber,
            studentCode: error.studentCode,
            email: error.email,
            errorCode: error.errorCode,
            errorMessage: error.errorMessage,
            rawRow: error.rawRow
          }))
        });
      }

      const totalRows = parsedRows.length;
      const failedRows = errors.length;
      const successRows = Math.max(totalRows - failedRows, 0);
      await tx.studentImportRun.update({
        where: { id: run.id },
        data: {
          totalRows,
          successRows,
          failedRows,
          status: failedRows > 0 ? StudentImportStatus.DONE_WITH_ERRORS : StudentImportStatus.DONE,
          finishedAt: new Date(),
          errorMessage: null
        }
      });
    });
  } catch (error) {
    await prisma.studentImportRun.update({
      where: { id: run.id },
      data: {
        status: StudentImportStatus.FAILED,
        errorMessage: error instanceof Error ? error.message : "Student import failed",
        finishedAt: new Date()
      }
    });
    throw error;
  }
}

export function startStudentImportWorker() {
  try {
    const worker = new Worker<StudentImportJob>(
      "student-import",
      async (job) => {
        await processStudentImport(job.data);
      },
      { connection: redisConnection, concurrency: 1 }
    );

    worker.on("error", (error) => {
      logRedisUnavailable("Student import worker", error);
    });

    return worker;
  } catch (error) {
    logRedisUnavailable("Student import worker bootstrap", error);
    return null;
  }
}

