import { AiSummaryStatus, type WorkshopDto } from "@unihub/shared-types";
import { ErrorCodes } from "@unihub/shared-utils";
import { Prisma, WorkshopStatus as PrismaWorkshopStatus } from "@unihub/db";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../common/errors/app-error.js";
import { publishNotificationJob } from "../notifications/queue.js";

const workshopInclude = {
  room: true,
  speakerLinks: { include: { speaker: true } },
  aiSummaries: { orderBy: { createdAt: "desc" as const }, take: 1 }
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

export function toWorkshopDto(workshop: WorkshopWithRelations): WorkshopDto {
  const aiSummary = workshop.aiSummaries[0];
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
          status: aiSummary.status as AiSummaryStatus,
          summaryText: aiSummary.summaryText
        }
      : null
  };
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

export async function listWorkshops(filters: { keyword?: string; category?: string }, includeAllStatuses = false) {
  const workshops = await prisma.workshop.findMany({
    where: {
      status: includeAllStatuses ? undefined : PrismaWorkshopStatus.PUBLISHED,
      category: filters.category,
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
  return workshops.map(toWorkshopDto);
}

export async function getWorkshopDetail(id: string, canSeeDraft = false) {
  const workshop = await prisma.workshop.findUnique({ where: { id }, include: workshopInclude });
  if (!workshop || (!canSeeDraft && workshop.status === PrismaWorkshopStatus.DRAFT)) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, "Workshop not found");
  }
  return toWorkshopDto(workshop);
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
