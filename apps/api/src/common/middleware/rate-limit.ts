import type { NextFunction, Request, Response } from "express";
import { ErrorCodes } from "@unihub/shared-utils";
import { env } from "../../config/env.js";
import { redis } from "../../config/redis.js";

interface RateLimitOptions {
  prefix: string;
  points: number;
  durationSeconds?: number;
}

export function redisRateLimit(options: RateLimitOptions) {
  const duration = options.durationSeconds ?? env.RATE_LIMIT_DEFAULT_DURATION_SECONDS;

  return async (req: Request, res: Response, next: NextFunction) => {
    const identity = req.user?.id ? `user:${req.user.id}` : `ip:${req.ip}`;
    const key = `rl:${options.prefix}:${identity}`;

    try {
      if (redis.status === "wait") {
        await redis.connect();
      }
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, duration);
      }
      const ttl = await redis.ttl(key);
      res.setHeader("x-ratelimit-limit", String(options.points));
      res.setHeader("x-ratelimit-remaining", String(Math.max(options.points - count, 0)));
      res.setHeader("retry-after", String(Math.max(ttl, 1)));

      if (count > options.points) {
        return res.status(429).json({
          error: {
            code: ErrorCodes.RATE_LIMITED,
            message: "Too many requests. Please retry later."
          }
        });
      }
    } catch (error) {
      console.warn("Redis rate limiter degraded, allowing request", error);
    }

    return next();
  };
}

export const defaultRateLimit = redisRateLimit({
  prefix: "default",
  points: env.RATE_LIMIT_DEFAULT_POINTS
});

export const registrationRateLimit = redisRateLimit({
  prefix: "registration",
  points: env.RATE_LIMIT_REGISTRATION_POINTS
});

export const paymentRateLimit = redisRateLimit({
  prefix: "payment",
  points: env.RATE_LIMIT_PAYMENT_POINTS
});

export const checkinSyncRateLimit = redisRateLimit({
  prefix: "checkin-sync",
  points: env.RATE_LIMIT_CHECKIN_SYNC_POINTS
});
