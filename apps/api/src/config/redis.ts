import IORedis from "ioredis";
import type { RedisOptions } from "ioredis";
import { env } from "./env.js";

let redisWarningLogged = false;
let redisConnectPromise: Promise<void> | null = null;

export function logRedisUnavailable(context: string, error: unknown) {
  if (redisWarningLogged) {
    return;
  }
  redisWarningLogged = true;
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`${context} unavailable; Redis-backed features are degraded until Redis starts. ${message}`);
}

function parseRedisUrl(redisUrl: string): RedisOptions {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    retryStrategy: (attempt) => (attempt > 2 ? null : Math.min(attempt * 200, 1000))
  };
}

export const redisConnection = parseRedisUrl(env.REDIS_URL);

export const redis = new IORedis(env.REDIS_URL, {
  lazyConnect: true,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  retryStrategy: (attempt) => (attempt > 2 ? null : Math.min(attempt * 200, 1000))
});

redis.on("error", (error) => logRedisUnavailable("Redis client", error));

export async function ensureRedisReady() {
  if (redis.status === "ready") {
    return;
  }

  if (!redisConnectPromise) {
    redisConnectPromise =
      redis.status === "wait" || redis.status === "close" || redis.status === "end"
        ? redis.connect().then(() => undefined)
        : waitForRedisReady();
    redisConnectPromise = redisConnectPromise.finally(() => {
      redisConnectPromise = null;
    });
  }

  await redisConnectPromise;
}

function waitForRedisReady() {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Redis connection timed out while status is ${redis.status}`));
    }, 3_000);

    const cleanup = () => {
      clearTimeout(timeout);
      redis.off("ready", onReady);
      redis.off("error", onError);
      redis.off("end", onEnd);
    };

    const onReady = () => {
      cleanup();
      resolve();
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const onEnd = () => {
      cleanup();
      reject(new Error("Redis connection ended before becoming ready"));
    };

    redis.once("ready", onReady);
    redis.once("error", onError);
    redis.once("end", onEnd);
  });
}
