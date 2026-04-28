import { ErrorCodes, payloadFingerprint } from "@unihub/shared-utils";
import { prisma } from "../../config/prisma.js";
import { redis } from "../../config/redis.js";
import { AppError } from "../errors/app-error.js";

export async function withIdempotency<T>(input: {
  scope: string;
  key: string;
  payload: unknown;
  operation: () => Promise<T>;
}): Promise<T> {
  const requestHash = payloadFingerprint(input.payload);
  const cacheKey = `idempotency:${input.scope}:${input.key}`;

  try {
    if (redis.status === "wait") {
      await redis.connect();
    }
    const cached = await redis.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached) as { requestHash: string; responseJson: T };
      if (parsed.requestHash !== requestHash) {
        throw new AppError(409, ErrorCodes.IDEMPOTENCY_CONFLICT, "Idempotency key was reused with a different payload");
      }
      return parsed.responseJson;
    }
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.warn("Redis idempotency cache degraded, falling back to PostgreSQL", error);
  }

  const existing = await prisma.idempotencyKey.findUnique({
    where: { scope_key: { scope: input.scope, key: input.key } }
  });

  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new AppError(409, ErrorCodes.IDEMPOTENCY_CONFLICT, "Idempotency key was reused with a different payload");
    }
    const responseJson = existing.responseJson as T;
    await redis.set(cacheKey, JSON.stringify({ requestHash, responseJson }), "EX", 24 * 60 * 60).catch(() => undefined);
    return responseJson;
  }

  const result = await input.operation();
  await prisma.idempotencyKey.create({
    data: {
      scope: input.scope,
      key: input.key,
      requestHash,
      responseJson: result as object,
      statusCode: 200,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }
  });
  await redis.set(cacheKey, JSON.stringify({ requestHash, responseJson: result }), "EX", 24 * 60 * 60).catch(() => undefined);

  return result;
}
