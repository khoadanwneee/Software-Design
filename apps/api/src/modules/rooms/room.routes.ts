import { Router } from "express";
import { Role } from "@unihub/shared-types";
import { prisma } from "../../config/prisma.js";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";

export const roomRouter = Router();

roomRouter.use(requireAuth);

roomRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const rooms = await prisma.room.findMany({ orderBy: { name: "asc" } });
    res.json(rooms);
  })
);

roomRouter.post(
  "/",
  requireRole([Role.ORGANIZER, Role.ADMIN]),
  asyncHandler(async (req, res) => {
    const room = await prisma.room.create({
      data: {
        name: req.body.name,
        capacity: Number(req.body.capacity),
        layoutUrl: req.body.layoutUrl ?? null
      }
    });
    res.status(201).json(room);
  })
);
