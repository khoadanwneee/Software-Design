import { StudentImportStatus } from "@unihub/shared-types";
import { buildStorageKey, localObjectStorage, prisma } from "@unihub/db";
import { ErrorCodes } from "@unihub/shared-utils";
import { AppError } from "../../common/errors/app-error.js";
import { sha256, sha256Buffer } from "../../common/utils/crypto.js";
import { studentImportQueue } from "../notifications/queue.js";

const csvContentTypes = new Set(["text/csv", "application/csv", "application/vnd.ms-excel", "text/plain", ""]);

export interface StudentImportUploadInput {
  fileName: string;
  contentType: string;
  buffer: Buffer;
  importType: string;
  description?: string;
  dryRun?: boolean;
  actorId: string;
  requestId?: string;
}

export interface StudentImportListFilters {
  page: number;
  limit: number;
  status?: StudentImportStatus;
}

function assertCsvFile(input: { fileName: string; contentType: string; size: number }) {
  if (!input.fileName.toLowerCase().endsWith(".csv")) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, "File must be CSV");
  }
  if (input.size <= 0) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, "CSV file is empty");
  }
  if (!csvContentTypes.has(input.contentType.toLowerCase())) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, "Unsupported CSV content type");
  }
}

function studentImportSelect() {
  return {
    id: true,
    fileName: true,
    fileHash: true,
    fileId: true,
    importType: true,
    description: true,
    dryRun: true,
    status: true,
    totalRows: true,
    successRows: true,
    failedRows: true,
    errorMessage: true,
    createdById: true,
    startedAt: true,
    finishedAt: true,
    createdAt: true,
    file: { select: { id: true, fileName: true, contentType: true, sizeBytes: true, storageKey: true, createdAt: true } }
  } as const;
}

export async function createStudentImportFromUpload(input: StudentImportUploadInput) {
  assertCsvFile({ fileName: input.fileName, contentType: input.contentType, size: input.buffer.byteLength });

  const fileHash = sha256Buffer(input.buffer);
  const existing = await prisma.studentImportRun.findUnique({
    where: { fileHash_importType: { fileHash, importType: input.importType } },
    select: studentImportSelect()
  });
  if (existing) {
    return { run: existing, created: false };
  }

  const storageKey = buildStorageKey("student-imports", input.fileName);
  await localObjectStorage.putObject({ key: storageKey, body: input.buffer });

  const run = await prisma.$transaction(async (tx) => {
    const uploadedFile = await tx.uploadedFile.create({
      data: {
        fileName: input.fileName,
        contentType: input.contentType || "text/csv",
        sizeBytes: input.buffer.byteLength,
        storageKey,
        checksumSha256: fileHash,
        uploadedById: input.actorId
      }
    });

    const createdRun = await tx.studentImportRun.create({
      data: {
        fileName: input.fileName,
        fileHash,
        fileId: uploadedFile.id,
        importType: input.importType,
        description: input.description,
        dryRun: input.dryRun ?? false,
        status: StudentImportStatus.PENDING,
        createdById: input.actorId
      },
      select: studentImportSelect()
    });

    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        action: "STUDENT_IMPORT_REQUESTED",
        entityType: "StudentImportRun",
        entityId: createdRun.id,
        newValue: {
          fileName: input.fileName,
          importType: input.importType,
          fileHash,
          fileId: uploadedFile.id,
          dryRun: input.dryRun ?? false
        },
        requestId: input.requestId
      }
    });

    return createdRun;
  });

  await studentImportQueue.add("student_import.requested", { runId: run.id }, { jobId: run.id });
  return { run, created: true };
}

export async function createStudentImportFromText(input: {
  fileName: string;
  csvText: string;
  actorId: string;
  requestId?: string;
}) {
  const fileHash = sha256(input.csvText);
  const existing = await prisma.studentImportRun.findUnique({
    where: { fileHash_importType: { fileHash, importType: "LEGACY_STUDENT_CSV" } },
    select: studentImportSelect()
  });
  if (existing) {
    return { run: existing, created: false };
  }

  const run = await prisma.studentImportRun.create({
    data: {
      fileName: input.fileName,
      fileHash,
      importType: "LEGACY_STUDENT_CSV",
      status: StudentImportStatus.PENDING,
      createdById: input.actorId
    },
    select: studentImportSelect()
  });

  await prisma.auditLog.create({
    data: {
      actorId: input.actorId,
      action: "STUDENT_IMPORT_REQUESTED",
      entityType: "StudentImportRun",
      entityId: run.id,
      newValue: { fileName: input.fileName, importType: "LEGACY_STUDENT_CSV", fileHash, source: "csvText" },
      requestId: input.requestId
    }
  });

  await studentImportQueue.add("student_import.requested", { runId: run.id, csvText: input.csvText }, { jobId: run.id });
  return { run, created: true };
}

export async function listStudentImports(filters: StudentImportListFilters) {
  const where = filters.status ? { status: filters.status } : {};
  const [items, total] = await Promise.all([
    prisma.studentImportRun.findMany({
      where,
      select: studentImportSelect(),
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit
    }),
    prisma.studentImportRun.count({ where })
  ]);

  return {
    items,
    page: filters.page,
    limit: filters.limit,
    total,
    totalPages: Math.max(Math.ceil(total / filters.limit), 1)
  };
}

export async function getStudentImportDetail(id: string) {
  const run = await prisma.studentImportRun.findUnique({
    where: { id },
    select: {
      ...studentImportSelect(),
      errors: { orderBy: { rowNumber: "asc" } }
    }
  });

  if (!run) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, "Student import not found");
  }

  return run;
}
