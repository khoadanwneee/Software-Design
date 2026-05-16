import { Router } from "express";
import type { NotificationListParams, UpdateNotificationPreferenceRequest } from "@unihub/shared-types";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { validateBody, validateQuery } from "../../common/middleware/validate.js";
import { requireAuth } from "../auth/auth.middleware.js";
import { notificationListQuerySchema, updateNotificationPreferenceSchema } from "./notification.schemas.js";
import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead
} from "./notification.service.js";
import {
  getNotificationPreferences,
  updateNotificationPreferences
} from "./preference.service.js";

export const notificationRouter = Router();

notificationRouter.use(requireAuth);

/**
 * @openapi
 * /api/notifications:
 *   get:
 *     summary: List current user's in-app notifications.
 */
notificationRouter.get(
  "/",
  validateQuery(notificationListQuerySchema),
  asyncHandler(async (req, res) => {
    res.json(await listNotifications(req.user!.id, req.query as unknown as NotificationListParams));
  })
);

/**
 * @openapi
 * /api/notifications/unread-count:
 *   get:
 *     summary: Count unread notifications for the current user.
 */
notificationRouter.get(
  "/unread-count",
  asyncHandler(async (req, res) => {
    res.json(await getUnreadNotificationCount(req.user!.id));
  })
);

/**
 * @openapi
 * /api/notifications/preferences:
 *   get:
 *     summary: Get current user's notification channel preferences.
 */
notificationRouter.get(
  "/preferences",
  asyncHandler(async (req, res) => {
    res.json(await getNotificationPreferences(req.user!.id));
  })
);

/**
 * @openapi
 * /api/notifications/preferences:
 *   put:
 *     summary: Update current user's notification channel preferences.
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               inApp:
 *                 type: boolean
 *               email:
 *                 type: boolean
 *               telegram:
 *                 type: boolean
 */
notificationRouter.put(
  "/preferences",
  validateBody(updateNotificationPreferenceSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as UpdateNotificationPreferenceRequest;
    res.json(await updateNotificationPreferences(req.user!.id, input));
  })
);

/**
 * @openapi
 * /api/notifications/read-all:
 *   patch:
 *     summary: Mark all current user's notifications as read.
 */
notificationRouter.patch(
  "/read-all",
  asyncHandler(async (req, res) => {
    res.json(await markAllNotificationsRead(req.user!.id));
  })
);

/**
 * @openapi
 * /api/notifications/{id}/read:
 *   patch:
 *     summary: Mark one current user's notification as read.
 */
notificationRouter.patch(
  "/:id/read",
  asyncHandler(async (req, res) => {
    res.json(await markNotificationRead(req.user!.id, String(req.params.id)));
  })
);
