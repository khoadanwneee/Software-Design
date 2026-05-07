import { Router } from "express";
import { Role } from "@unihub/shared-types";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { validateBody, validateQuery } from "../../common/middleware/validate.js";
import { checkinSyncRateLimit } from "../../common/middleware/rate-limit.js";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import { offlineCacheQuerySchema, offlineSyncSchema, onlineCheckinSchema, validateQrSchema } from "./checkin.schemas.js";
import { createOnlineCheckin, getOfflineCheckinCache, syncOfflineCheckins, validateQr } from "./checkin.service.js";

export const checkinRouter = Router();

checkinRouter.use(requireAuth, requireRole([Role.CHECKIN_STAFF, Role.ORGANIZER, Role.ADMIN]));

/**
 * @openapi
 * /api/checkins/offline-cache:
 *   get:
 *     summary: Preload active QR token hashes for offline check-in validation.
 */
checkinRouter.get(
  "/offline-cache",
  validateQuery(offlineCacheQuerySchema),
  asyncHandler(async (req, res) => {
    res.json(await getOfflineCheckinCache({ workshopId: String(req.query.workshopId) }));
  })
);

checkinRouter.post(
  "/validate",
  validateBody(validateQrSchema),
  asyncHandler(async (req, res) => {
    res.json(await validateQr(req.body));
  })
);

checkinRouter.post(
  "/",
  validateBody(onlineCheckinSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(
      await createOnlineCheckin({
        qrPayload: req.body.qrPayload,
        workshopId: req.body.workshopId,
        staffId: req.user!.id,
        idempotencyKey: req.body.idempotencyKey
      })
    );
  })
);

checkinRouter.post(
  "/offline-sync",
  checkinSyncRateLimit,
  validateBody(offlineSyncSchema),
  asyncHandler(async (req, res) => {
    const events = req.body.events.map((event: { staffId: string }) => ({
      ...event,
      staffId: req.user!.id
    }));
    res.json(await syncOfflineCheckins(events));
  })
);
