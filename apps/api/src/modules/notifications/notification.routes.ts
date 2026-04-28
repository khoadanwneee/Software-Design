import { Router } from "express";
import { prisma } from "../../config/prisma.js";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { requireAuth } from "../auth/auth.middleware.js";

export const notificationRouter = Router();

notificationRouter.use(requireAuth);

notificationRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
      take: 50
    });
    res.json(notifications);
  })
);
