import IORedis from "ioredis";
import { type WorkshopSeatAvailabilityDto, WorkshopStatus } from "@unihub/shared-types";
import { ErrorCodes } from "@unihub/shared-utils";
import { prisma } from "../../config/prisma.js";
import { logRedisUnavailable, redis } from "../../config/redis.js";
import { env } from "../../config/env.js";
import { AppError } from "../../common/errors/app-error.js";

const seatCacheTtlSeconds = 15;
const seatCachePrefix = "workshop:seats";
const seatChannelPrefix = "workshop:seats";

function cacheKey(workshopId: string) {
  return `${seatCachePrefix}:${workshopId}`;
}

function channelName(workshopId: string) {
  return `${seatChannelPrefix}:${workshopId}`;
}

async function getWorkshopSeatPayloadFromDatabase(
  workshopId: string,
  canSeeDraft = false
): Promise<WorkshopSeatAvailabilityDto> {
  const workshop = await prisma.workshop.findUnique({
    where: { id: workshopId },
    select: {
      id: true,
      capacity: true,
      registeredCount: true,
      status: true,
      updatedAt: true
    }
  });

  if (!workshop || (!canSeeDraft && workshop.status === "DRAFT")) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, "Workshop not found");
  }

  return {
    workshopId: workshop.id,
    capacity: workshop.capacity,
    registeredCount: workshop.registeredCount,
    remainingSeats: Math.max(workshop.capacity - workshop.registeredCount, 0),
    status: workshop.status as WorkshopStatus,
    updatedAt: workshop.updatedAt.toISOString()
  };
}

export async function getWorkshopSeatAvailability(input: {
  workshopId: string;
  canSeeDraft?: boolean;
  bypassCache?: boolean;
}): Promise<WorkshopSeatAvailabilityDto> {
  if (!input.bypassCache) {
    try {
      if (redis.status === "wait") {
        await redis.connect();
      }
      const cached = await redis.get(cacheKey(input.workshopId));
      if (cached) {
        const payload = JSON.parse(cached) as WorkshopSeatAvailabilityDto;
        if (input.canSeeDraft || payload.status !== WorkshopStatus.DRAFT) {
          return payload;
        }
      }
    } catch (error) {
      console.warn("Seat availability cache degraded, reading PostgreSQL", error);
    }
  }

  const payload = await getWorkshopSeatPayloadFromDatabase(input.workshopId, input.canSeeDraft ?? false);
  await redis
    .set(cacheKey(input.workshopId), JSON.stringify(payload), "EX", seatCacheTtlSeconds)
    .catch(() => undefined);
  return payload;
}

export async function publishWorkshopSeatUpdate(workshopId: string): Promise<WorkshopSeatAvailabilityDto | null> {
  try {
    const payload = await getWorkshopSeatAvailability({ workshopId, canSeeDraft: true, bypassCache: true });
    if (redis.status === "wait") {
      await redis.connect();
    }
    await redis.set(cacheKey(workshopId), JSON.stringify(payload), "EX", seatCacheTtlSeconds);
    await redis.publish(channelName(workshopId), JSON.stringify(payload));
    return payload;
  } catch (error) {
    console.warn("Seat availability publish failed", error);
    return null;
  }
}

export async function subscribeWorkshopSeatUpdates(input: {
  workshopId: string;
  onUpdate: (payload: WorkshopSeatAvailabilityDto) => void;
}) {
  const subscriber = new IORedis(env.REDIS_URL, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    retryStrategy: (attempt) => (attempt > 2 ? null : Math.min(attempt * 200, 1000))
  });
  const channel = channelName(input.workshopId);

  subscriber.on("error", (error) => logRedisUnavailable("Seat stream subscription", error));

  subscriber.on("message", (_channel, message) => {
    try {
      input.onUpdate(JSON.parse(message) as WorkshopSeatAvailabilityDto);
    } catch (error) {
      console.warn("Invalid seat availability event payload", error);
    }
  });

  await subscriber.connect();
  await subscriber.subscribe(channel);

  return async () => {
    await subscriber.unsubscribe(channel).catch(() => undefined);
    subscriber.disconnect();
  };
}
