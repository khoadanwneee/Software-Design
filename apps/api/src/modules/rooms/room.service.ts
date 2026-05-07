import { RoomStatus, type RoomDto, type RoomLayoutMetadataRequest } from "@unihub/shared-types";
import { ErrorCodes } from "@unihub/shared-utils";
import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { AppError } from "../../common/errors/app-error.js";

type RoomWithCount = {
  id: string;
  name: string;
  capacity: number;
  layoutUrl: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  _count?: { workshops: number };
};

function toRoomDto(room: RoomWithCount): RoomDto {
  return {
    id: room.id,
    name: room.name,
    capacity: room.capacity,
    status: room.status as RoomStatus,
    layoutUrl: room.layoutUrl,
    workshopCount: room._count?.workshops,
    createdAt: room.createdAt.toISOString(),
    updatedAt: room.updatedAt.toISOString()
  };
}

async function assertUniqueRoomName(name: string, excludeRoomId?: string) {
  const existing = await prisma.room.findUnique({ where: { name } });
  if (existing && existing.id !== excludeRoomId) {
    throw new AppError(409, "ROOM_NAME_EXISTS", "Room name already exists");
  }
}

async function findRoomOrThrow(id: string) {
  const room = await prisma.room.findUnique({
    where: { id },
    include: { _count: { select: { workshops: true } } }
  });
  if (!room) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, "Room not found");
  }
  return room;
}

export async function listRooms(includeArchived = false) {
  const rooms = await prisma.room.findMany({
    where: includeArchived ? undefined : { status: { not: RoomStatus.ARCHIVED } },
    include: { _count: { select: { workshops: true } } },
    orderBy: { name: "asc" }
  });
  return rooms.map(toRoomDto);
}

export async function getRoom(id: string) {
  return toRoomDto(await findRoomOrThrow(id));
}

export async function createRoom(actorId: string, input: { name: string; capacity: number; status: RoomStatus; layoutUrl?: string | null }) {
  await assertUniqueRoomName(input.name);

  const room = await prisma.room.create({
    data: {
      name: input.name,
      capacity: input.capacity,
      status: input.status,
      layoutUrl: input.layoutUrl ?? null
    },
    include: { _count: { select: { workshops: true } } }
  });

  await prisma.auditLog.create({
    data: {
      actorId,
      action: "ROOM_CREATED",
      entityType: "Room",
      entityId: room.id,
      newValue: { name: room.name, capacity: room.capacity, status: room.status }
    }
  });

  return toRoomDto(room);
}

export async function updateRoom(
  actorId: string,
  id: string,
  input: Partial<{ name: string; capacity: number; status: RoomStatus; layoutUrl: string | null }>
) {
  const existing = await findRoomOrThrow(id);
  if (input.name) {
    await assertUniqueRoomName(input.name, id);
  }

  const room = await prisma.room.update({
    where: { id },
    data: {
      name: input.name,
      capacity: input.capacity,
      status: input.status,
      layoutUrl: input.layoutUrl
    },
    include: { _count: { select: { workshops: true } } }
  });

  await prisma.auditLog.create({
    data: {
      actorId,
      action: "ROOM_UPDATED",
      entityType: "Room",
      entityId: id,
      oldValue: {
        name: existing.name,
        capacity: existing.capacity,
        status: existing.status,
        layoutUrl: existing.layoutUrl
      },
      newValue: {
        name: room.name,
        capacity: room.capacity,
        status: room.status,
        layoutUrl: room.layoutUrl
      }
    }
  });

  return toRoomDto(room);
}

export async function updateRoomStatus(actorId: string, id: string, status: RoomStatus) {
  const existing = await findRoomOrThrow(id);
  const room = await prisma.room.update({
    where: { id },
    data: { status },
    include: { _count: { select: { workshops: true } } }
  });

  await prisma.auditLog.create({
    data: {
      actorId,
      action: "ROOM_STATUS_UPDATED",
      entityType: "Room",
      entityId: id,
      oldValue: { status: existing.status },
      newValue: { status: room.status }
    }
  });

  return toRoomDto(room);
}

export async function archiveRoom(actorId: string, id: string) {
  const existing = await findRoomOrThrow(id);
  const room = await prisma.room.update({
    where: { id },
    data: { status: RoomStatus.ARCHIVED },
    include: { _count: { select: { workshops: true } } }
  });

  await prisma.auditLog.create({
    data: {
      actorId,
      action: "ROOM_ARCHIVED",
      entityType: "Room",
      entityId: id,
      oldValue: { status: existing.status },
      newValue: { status: room.status, workshopCount: room._count.workshops }
    }
  });

  return toRoomDto(room);
}

export async function updateRoomLayout(actorId: string, id: string, input: RoomLayoutMetadataRequest) {
  if (input.size > env.MAX_UPLOAD_BYTES) {
    throw new AppError(400, "FILE_TOO_LARGE", "Layout file exceeds configured size limit");
  }

  const existing = await findRoomOrThrow(id);
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const layoutUrl = `/rooms/layouts/${id}/${Date.now()}-${safeName}`;
  const room = await prisma.room.update({
    where: { id },
    data: { layoutUrl },
    include: { _count: { select: { workshops: true } } }
  });

  await prisma.auditLog.create({
    data: {
      actorId,
      action: "ROOM_LAYOUT_UPDATED",
      entityType: "Room",
      entityId: id,
      oldValue: { layoutUrl: existing.layoutUrl },
      newValue: {
        layoutUrl,
        fileName: input.fileName,
        contentType: input.contentType,
        size: input.size
      }
    }
  });

  return toRoomDto(room);
}
