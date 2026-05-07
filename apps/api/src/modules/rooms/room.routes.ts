import { Router } from "express";
import { Role } from "@unihub/shared-types";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { validateBody } from "../../common/middleware/validate.js";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import { roomBodySchema, roomLayoutMetadataSchema, updateRoomSchema, updateRoomStatusSchema } from "./room.schemas.js";
import { archiveRoom, createRoom, getRoom, listRooms, updateRoom, updateRoomLayout, updateRoomStatus } from "./room.service.js";

export const roomRouter = Router();

roomRouter.use(requireAuth);

/**
 * @openapi
 * /api/rooms:
 *   get:
 *     summary: List rooms.
 */
roomRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const includeArchived =
      _req.user?.roles.some((role) => [Role.ADMIN, Role.ORGANIZER].includes(role)) ?? false;
    res.json(await listRooms(includeArchived));
  })
);

roomRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json(await getRoom(String(req.params.id)));
  })
);

/**
 * @openapi
 * /api/rooms:
 *   post:
 *     summary: Create room.
 */
roomRouter.post(
  "/",
  requireRole([Role.ORGANIZER, Role.ADMIN]),
  validateBody(roomBodySchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(await createRoom(req.user!.id, req.body));
  })
);

roomRouter.patch(
  "/:id",
  requireRole([Role.ORGANIZER, Role.ADMIN]),
  validateBody(updateRoomSchema),
  asyncHandler(async (req, res) => {
    res.json(await updateRoom(req.user!.id, String(req.params.id), req.body));
  })
);

roomRouter.patch(
  "/:id/status",
  requireRole([Role.ORGANIZER, Role.ADMIN]),
  validateBody(updateRoomStatusSchema),
  asyncHandler(async (req, res) => {
    res.json(await updateRoomStatus(req.user!.id, String(req.params.id), req.body.status));
  })
);

roomRouter.post(
  "/:id/layout",
  requireRole([Role.ORGANIZER, Role.ADMIN]),
  validateBody(roomLayoutMetadataSchema),
  asyncHandler(async (req, res) => {
    res.status(202).json(await updateRoomLayout(req.user!.id, String(req.params.id), req.body));
  })
);

roomRouter.delete(
  "/:id",
  requireRole([Role.ORGANIZER, Role.ADMIN]),
  asyncHandler(async (req, res) => {
    res.json(await archiveRoom(req.user!.id, String(req.params.id)));
  })
);
