import IORedis from "ioredis";
import { env } from "./env.js";

function parseRedisUrl(redisUrl: string) {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined
  };
}

export const redisConnection = parseRedisUrl(env.REDIS_URL);

export const redis = new IORedis(env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 2
});
