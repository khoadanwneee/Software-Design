import { AiSummaryStatus, type WorkshopDto, type WorkshopListFilters } from "@unihub/shared-types";
import { ErrorCodes } from "@unihub/shared-utils";
import { buildStorageKey, localObjectStorage, Prisma, WorkshopStatus as PrismaWorkshopStatus } from "@unihub/db";
import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../common/errors/app-error.js";
import { sha256Buffer } from "../../common/utils/crypto.js";
import { aiSummaryQueue, publishNotificationJob } from "../notifications/queue.js";
import { publishWorkshopSeatUpdate } from "./workshop-seat-events.js";

const workshopInclude = {
  room: true,
  speakerLinks: { include: { speaker: true } },
  aiSummaries: { orderBy: { createdAt: "desc" as const } }
};

type WorkshopWithRelations = Prisma.WorkshopGetPayload<{ include: typeof workshopInclude }>;

interface WorkshopInput {
  title: string;
  description: string;
  category: string;
  roomId: string;
  startTime: Date;
  endTime: Date;
  capacity: number;
  priceAmount: number;
  currency?: string;
  status: string;
  speakerIds?: string[];
}

interface WorkshopPdfUploadInput {
  workshopId: string;
  fileName: string;
  contentType: string;
  buffer: Buffer;
  actorId: string;
  requestId?: string;
}

export function toWorkshopDto(workshop: WorkshopWithRelations): WorkshopDto {
  const aiSummary =
    workshop.aiSummaries.find((summary) => summary.status === AiSummaryStatus.DONE) ?? workshop.aiSummaries[0];
  return {
    id: workshop.id,
    slug: workshop.slug,
    title: workshop.title,
    description: workshop.description,
    category: workshop.category,
    status: workshop.status as WorkshopDto["status"],
    startTime: workshop.startTime.toISOString(),
    endTime: workshop.endTime.toISOString(),
    priceAmount: Number(workshop.priceAmount),
    currency: workshop.currency,
    capacity: workshop.capacity,
    registeredCount: workshop.registeredCount,
    remainingSeats: Math.max(workshop.capacity - workshop.registeredCount, 0),
    room: {
      id: workshop.room.id,
      name: workshop.room.name,
      capacity: workshop.room.capacity,
      status: workshop.room.status as WorkshopDto["room"]["status"],
      layoutUrl: workshop.room.layoutUrl
    },
    speakers: workshop.speakerLinks.map((link) => ({
      id: link.speaker.id,
      fullName: link.speaker.fullName,
      title: link.speaker.title,
      bio: link.speaker.bio
    })),
    aiSummary: aiSummary
      ? {
          id: aiSummary.id,
          status: aiSummary.status as AiSummaryStatus,
          summary: aiSummary.status === AiSummaryStatus.DONE ? aiSummary.summary : null,
          updatedAt: aiSummary.updatedAt?.toISOString() ?? null
        }
      : null
  };
}

function maxPdfBytes() {
  return Math.floor(env.AI_SUMMARY_PDF_MAX_MB * 1024 * 1024);
}

function normalizedContentType(value: string) {
  return value.split(";")[0].trim().toLowerCase();
}

function assertPdfUpload(input: { fileName: string; contentType: string; buffer: Buffer }) {
  if (input.buffer.byteLength <= 0) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, "PDF file is empty");
  }

  if (input.buffer.byteLength > maxPdfBytes()) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, `PDF exceeds ${env.AI_SUMMARY_PDF_MAX_MB}MB limit`);
  }

  if (!input.fileName.toLowerCase().endsWith(".pdf")) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, "File must use .pdf extension");
  }

  if (normalizedContentType(input.contentType) !== "application/pdf") {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, "Unsupported PDF content type");
  }

  if (input.buffer.subarray(0, 4).toString("latin1") !== "%PDF") {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, "File content is not a valid PDF");
  }
}

function slugify(title: string) {
  const slug = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug}-${Math.random().toString(36).slice(2, 7)}`;
}

async function assertRoomAvailable(input: {
  roomId: string;
  startTime: Date;
  endTime: Date;
  capacity: number;
  excludeWorkshopId?: string;
}) {
  const room = await prisma.room.findUnique({ where: { id: input.roomId } });
  if (!room) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, "Room not found");
  }
  if (input.capacity > room.capacity) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, "Workshop capacity exceeds room capacity");
  }

  const conflict = await prisma.workshop.findFirst({
    where: {
      id: input.excludeWorkshopId ? { not: input.excludeWorkshopId } : undefined,
      roomId: input.roomId,
      status: { not: PrismaWorkshopStatus.CANCELLED },
      startTime: { lt: input.endTime },
      endTime: { gt: input.startTime }
    }
  });

  if (conflict) {
    throw new AppError(409, "ROOM_TIME_CONFLICT", "Room already has an overlapping workshop", {
      conflictWorkshopId: conflict.id,
      conflictTitle: conflict.title
    });
  }
}

function dateStart(date: string) {
  return new Date(`${date}T00:00:00.000`);
}

function nextDateStart(date: string) {
  const next = dateStart(date);
  next.setDate(next.getDate() + 1);
  return next;
}

export async function listWorkshops(filters: WorkshopListFilters, includeAllStatuses = false) {
  const startTime: Prisma.DateTimeFilter<"Workshop"> = {};
  if (filters.date) {
    startTime.gte = dateStart(filters.date);
    startTime.lt = nextDateStart(filters.date);
  } else {
    if (filters.fromDate) {
      startTime.gte = dateStart(filters.fromDate);
    }
    if (filters.toDate) {
      startTime.lt = nextDateStart(filters.toDate);
    }
  }

  const workshops = await prisma.workshop.findMany({
    where: {
      status: includeAllStatuses ? undefined : PrismaWorkshopStatus.PUBLISHED,
      category: filters.category,
      roomId: filters.roomId,
      startTime: Object.keys(startTime).length > 0 ? startTime : undefined,
      priceAmount:
        filters.priceType === "free"
          ? { equals: 0 }
          : filters.priceType === "paid"
            ? { gt: 0 }
            : undefined,
      OR: filters.keyword
        ? [
            { title: { contains: filters.keyword, mode: "insensitive" } },
            { description: { contains: filters.keyword, mode: "insensitive" } }
          ]
        : undefined
    },
    include: workshopInclude,
    orderBy: { startTime: "asc" }
  });
  const mapped = workshops.map(toWorkshopDto);
  const filtered = filters.hasSeats ? mapped.filter((workshop) => workshop.remainingSeats > 0) : mapped;
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 50;
  return filtered.slice((page - 1) * limit, page * limit);
}

export async function getWorkshopDetail(id: string, canSeeDraft = false) {
  const workshop = await prisma.workshop.findUnique({ where: { id }, include: workshopInclude });
  if (!workshop || (!canSeeDraft && workshop.status === PrismaWorkshopStatus.DRAFT)) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, "Workshop not found");
  }
  return toWorkshopDto(workshop);
}

export async function uploadWorkshopPdfSummary(input: WorkshopPdfUploadInput) {
  assertPdfUpload(input);

  const workshop = await prisma.workshop.findUnique({ where: { id: input.workshopId } });
  if (!workshop) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, "Workshop not found");
  }

  const checksumSha256 = sha256Buffer(input.buffer);
  const storageKey = buildStorageKey(`workshop-pdfs/${input.workshopId}`, input.fileName);
  await localObjectStorage.putObject({ key: storageKey, body: input.buffer });

  const result = await prisma.$transaction(async (tx) => {
    const uploadedFile = await tx.uploadedFile.create({
      data: {
        fileType: "PDF",
        fileName: input.fileName,
        contentType: "application/pdf",
        sizeBytes: input.buffer.byteLength,
        storageKey,
        checksumSha256,
        uploadedById: input.actorId
      }
    });

    const summary = await tx.aiSummary.create({
      data: {
        workshopId: input.workshopId,
        uploadedFileId: uploadedFile.id,
        status: AiSummaryStatus.PENDING,
        summary: null,
        errorMessage: null,
        attemptCount: 0,
        promptVersion: "summary-vi-v1"
      }
    });

    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        action: "AI_SUMMARY_REQUESTED",
        entityType: "AiSummary",
        entityId: summary.id,
        newValue: {
          workshopId: input.workshopId,
          uploadedFileId: uploadedFile.id,
          fileName: input.fileName,
          checksumSha256
        },
        requestId: input.requestId
      }
    });

    return { uploadedFile, summary };
  });

  await aiSummaryQueue.add(
    "ai_summary.requested",
    {
      workshopId: input.workshopId,
      uploadedFileId: result.uploadedFile.id,
      aiSummaryId: result.summary.id,
      requestedBy: input.actorId
    },
    { jobId: result.summary.id }
  );

  return {
    uploadedFileId: result.uploadedFile.id,
    aiSummaryId: result.summary.id,
    status: result.summary.status
  };
}

export async function createWorkshop(actorId: string, input: WorkshopInput) {
  const startTime = new Date(input.startTime);
  const endTime = new Date(input.endTime);

  await assertRoomAvailable({
    roomId: input.roomId,
    startTime,
    endTime,
    capacity: input.capacity
  });

  const workshop = await prisma.workshop.create({
    data: {
      slug: slugify(input.title),
      title: input.title,
      description: input.description,
      category: input.category,
      startTime,
      endTime,
      capacity: input.capacity,
      priceAmount: input.priceAmount as Prisma.Decimal | string | number,
      currency: input.currency ?? "VND",
      status: input.status as PrismaWorkshopStatus,
      room: { connect: { id: input.roomId } },
      createdBy: { connect: { id: actorId } },
      speakerLinks: input.speakerIds?.length
        ? {
            create: input.speakerIds.map((speakerId) => ({
              speaker: { connect: { id: speakerId } }
            }))
          }
        : undefined
    },
    include: workshopInclude
  });

  await prisma.auditLog.create({
    data: {
      actorId,
      action: "WORKSHOP_CREATED",
      entityType: "Workshop",
      entityId: workshop.id,
      newValue: { title: workshop.title, status: workshop.status }
    }
  });

  return toWorkshopDto(workshop);
}

export async function updateWorkshop(actorId: string, id: string, input: Record<string, unknown>) {
  const existing = await prisma.workshop.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, "Workshop not found");
  }

  const nextStart = input.startTime ? new Date(input.startTime as string) : existing.startTime;
  const nextEnd = input.endTime ? new Date(input.endTime as string) : existing.endTime;
  const nextRoomId = (input.roomId as string | undefined) ?? existing.roomId;
  const nextCapacity = Number(input.capacity ?? existing.capacity);

  if (nextCapacity < existing.registeredCount) {
    throw new AppError(409, "CAPACITY_BELOW_REGISTERED_COUNT", "Capacity cannot be below current registrations");
  }

  await assertRoomAvailable({
    roomId: nextRoomId,
    startTime: nextStart,
    endTime: nextEnd,
    capacity: nextCapacity,
    excludeWorkshopId: id
  });

  const workshop = await prisma.workshop.update({
    where: { id },
    data: {
      title: input.title as string | undefined,
      description: input.description as string | undefined,
      category: input.category as string | undefined,
      roomId: input.roomId as string | undefined,
      startTime: input.startTime ? nextStart : undefined,
      endTime: input.endTime ? nextEnd : undefined,
      capacity: input.capacity as number | undefined,
      priceAmount: input.priceAmount as Prisma.Decimal | string | number | undefined,
      currency: input.currency as string | undefined,
      status: input.status as PrismaWorkshopStatus | undefined
    },
    include: workshopInclude
  });

  await prisma.auditLog.create({
    data: {
      actorId,
      action: "WORKSHOP_UPDATED",
      entityType: "Workshop",
      entityId: id,
      oldValue: {
        title: existing.title,
        roomId: existing.roomId,
        startTime: existing.startTime.toISOString(),
        endTime: existing.endTime.toISOString(),
        capacity: existing.capacity,
        status: existing.status
      },
      newValue: JSON.parse(JSON.stringify(input)) as Prisma.InputJsonValue
    }
  });

  if (input.roomId || input.startTime || input.endTime || input.status) {
    await notifyRegisteredUsers(id, "workshop.changed", "Workshop updated", `${workshop.title} has schedule or room updates.`);
  }

  await publishWorkshopSeatUpdate(id);
  return toWorkshopDto(workshop);
}

export async function cancelWorkshop(actorId: string, id: string) {
  const existing = await prisma.workshop.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, "Workshop not found");
  }

  const workshop = await prisma.workshop.update({
    where: { id },
    data: { status: PrismaWorkshopStatus.CANCELLED, cancelledAt: new Date() },
    include: workshopInclude
  });

  await prisma.auditLog.create({
    data: {
      actorId,
      action: "WORKSHOP_CANCELLED",
      entityType: "Workshop",
      entityId: id,
      oldValue: { status: existing.status },
      newValue: { status: workshop.status }
    }
  });

  await notifyRegisteredUsers(id, "workshop.cancelled", "Workshop cancelled", `${workshop.title} has been cancelled.`);
  await publishWorkshopSeatUpdate(id);
  return toWorkshopDto(workshop);
}

async function notifyRegisteredUsers(workshopId: string, eventType: string, title: string, body: string) {
  const registrations = await prisma.registration.findMany({
    where: { workshopId, status: "CONFIRMED" },
    select: { userId: true }
  });

  await Promise.all(
    registrations.map((registration) =>
      publishNotificationJob({
        eventType,
        userId: registration.userId,
        workshopId,
        dedupeKey: `${eventType}:${workshopId}:${registration.userId}:${Date.now()}`,
        title,
        body
      })
    )
  );
}
