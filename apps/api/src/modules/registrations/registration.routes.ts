import { Router } from "express";
import { Role } from "@unihub/shared-types";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { validateBody } from "../../common/middleware/validate.js";
import { paymentRateLimit, registrationRateLimit } from "../../common/middleware/rate-limit.js";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import { createRegistrationSchema } from "./registration.schemas.js";
import { createFreeRegistration, createPaidRegistration, getRegistrationQr } from "./registration.service.js";

export const registrationRouter = Router();

registrationRouter.use(requireAuth);

registrationRouter.post(
  "/",
  requireRole([Role.STUDENT]),
  registrationRateLimit,
  validateBody(createRegistrationSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(
      await createFreeRegistration({
        userId: req.user!.id,
        workshopId: req.body.workshopId,
        idempotencyKey: req.body.idempotencyKey
      })
    );
  })
);

registrationRouter.post(
  "/paid",
  requireRole([Role.STUDENT]),
  registrationRateLimit,
  paymentRateLimit,
  validateBody(createRegistrationSchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(
      await createPaidRegistration({
        userId: req.user!.id,
        workshopId: req.body.workshopId,
        idempotencyKey: req.body.idempotencyKey
      })
    );
  })
);

registrationRouter.get(
  "/:id/qr",
  asyncHandler(async (req, res) => {
    const isAdmin = req.user!.roles.some((role) => [Role.ADMIN, Role.ORGANIZER].includes(role));
    res.json(await getRegistrationQr({ registrationId: String(req.params.id), requesterId: req.user!.id, isAdmin }));
  })
);
