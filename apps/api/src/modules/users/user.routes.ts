import { Router } from "express";
import { Role, type UserListFilters } from "@unihub/shared-types";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { validateBody, validateQuery } from "../../common/middleware/validate.js";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import { updateRolesSchema, updateUserStatusSchema, userListQuerySchema } from "./user.schemas.js";
import { listUsers, updateUserRoles, updateUserStatus } from "./user.service.js";

export const userRouter = Router();

userRouter.use(requireAuth);

/**
 * @openapi
 * /api/users:
 *   get:
 *     summary: List users for ADMIN role management.
 */
userRouter.get(
  "/",
  requireRole([Role.ADMIN]),
  validateQuery(userListQuerySchema),
  asyncHandler(async (_req, res) => {
    res.json(await listUsers(_req.query as unknown as UserListFilters));
  })
);

/**
 * @openapi
 * /api/users/{id}/roles:
 *   patch:
 *     summary: Update a user's roles.
 */
userRouter.patch(
  "/:id/roles",
  requireRole([Role.ADMIN]),
  validateBody(updateRolesSchema),
  asyncHandler(async (req, res) => {
    res.json(await updateUserRoles(req.user!.id, String(req.params.id), req.body.roles));
  })
);

userRouter.patch(
  "/:id/status",
  requireRole([Role.ADMIN]),
  validateBody(updateUserStatusSchema),
  asyncHandler(async (req, res) => {
    res.json(await updateUserStatus(req.user!.id, String(req.params.id), req.body.status));
  })
);
