import { Router } from "express";
import { prisma } from "../../config/prisma.js";
import { redis } from "../../config/redis.js";
import { asyncHandler } from "../../common/utils/async-handler.js";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json({ status: "ok", service: "unihub-api" });
});

healthRouter.get(
  "/db",
  asyncHandler(async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", component: "postgres" });
  })
);

healthRouter.get(
  "/redis",
  asyncHandler(async (_req, res) => {
    if (redis.status === "wait") {
      await redis.connect();
    }
    await redis.ping();
    res.json({ status: "ok", component: "redis" });
  })
);
