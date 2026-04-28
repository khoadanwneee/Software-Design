import { Router } from "express";
import { Role } from "@unihub/shared-types";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { validateBody } from "../../common/middleware/validate.js";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import { createWorkshopSchema, updateWorkshopSchema } from "./workshop.schemas.js";
import {
  cancelWorkshop,
  createWorkshop,
  getWorkshopDetail,
  listWorkshops,
  updateWorkshop
} from "./workshop.service.js";

export const workshopRouter = Router();

workshopRouter.use(requireAuth);

workshopRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const includeAll = req.user?.roles.some((role) => [Role.ADMIN, Role.ORGANIZER].includes(role)) ?? false;
    res.json(
      await listWorkshops(
        {
          keyword: req.query.keyword as string | undefined,
          category: req.query.category as string | undefined
        },
        includeAll
      )
    );
  })
);

workshopRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const canSeeDraft = req.user?.roles.some((role) => [Role.ADMIN, Role.ORGANIZER].includes(role)) ?? false;
    res.json(await getWorkshopDetail(String(req.params.id), canSeeDraft));
  })
);

workshopRouter.post(
  "/",
  requireRole([Role.ORGANIZER, Role.ADMIN]),
  validateBody(createWorkshopSchema),
  asyncHandler(async (req, res) => {
    const body = req.body;
    const result = await createWorkshop(req.user!.id, {
      title: body.title,
      description: body.description,
      category: body.category,
      roomId: body.roomId,
      startTime: new Date(body.startTime),
      endTime: new Date(body.endTime),
      capacity: body.capacity,
      priceAmount: body.priceAmount,
      currency: body.currency,
      status: body.status,
      speakerIds: body.speakerIds
    });
    res.status(201).json(result);
  })
);

workshopRouter.patch(
  "/:id",
  requireRole([Role.ORGANIZER, Role.ADMIN]),
  validateBody(updateWorkshopSchema),
  asyncHandler(async (req, res) => {
    res.json(await updateWorkshop(req.user!.id, String(req.params.id), req.body));
  })
);

workshopRouter.post(
  "/:id/cancel",
  requireRole([Role.ORGANIZER, Role.ADMIN]),
  asyncHandler(async (req, res) => {
    res.json(await cancelWorkshop(req.user!.id, String(req.params.id)));
  })
);

workshopRouter.get(
  "/:id/seats",
  asyncHandler(async (req, res) => {
    const workshop = await getWorkshopDetail(String(req.params.id));
    res.json({ workshopId: workshop.id, remainingSeats: workshop.remainingSeats });
  })
);
