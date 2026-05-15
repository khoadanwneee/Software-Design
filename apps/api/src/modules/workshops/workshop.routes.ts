import { Router } from "express";
import { Role, type WorkshopListFilters, type WorkshopSeatAvailabilityDto } from "@unihub/shared-types";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { env } from "../../config/env.js";
import { validateBody, validateQuery } from "../../common/middleware/validate.js";
import { readMultipartFormData } from "../../common/utils/multipart.js";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import { createWorkshopSchema, updateWorkshopSchema, workshopListQuerySchema } from "./workshop.schemas.js";
import {
  cancelWorkshop,
  createWorkshop,
  getWorkshopDetail,
  listWorkshops,
  updateWorkshop,
  uploadWorkshopPdfSummary
} from "./workshop.service.js";
import { getWorkshopSeatAvailability, subscribeWorkshopSeatUpdates } from "./workshop-seat-events.js";

export const workshopRouter = Router();

workshopRouter.use(requireAuth);

/**
 * @openapi
 * /api/workshops:
 *   get:
 *     summary: List workshops with search and filters.
 */
workshopRouter.get(
  "/",
  validateQuery(workshopListQuerySchema),
  asyncHandler(async (req, res) => {
    const includeAll = req.user?.roles.some((role) => [Role.ADMIN, Role.ORGANIZER].includes(role)) ?? false;
    res.json(
      await listWorkshops(
        req.query as unknown as WorkshopListFilters,
        includeAll
      )
    );
  })
);

workshopRouter.get(
  "/:id/seats",
  asyncHandler(async (req, res) => {
    const canSeeDraft = req.user?.roles.some((role) => [Role.ADMIN, Role.ORGANIZER].includes(role)) ?? false;
    res.json(await getWorkshopSeatAvailability({ workshopId: String(req.params.id), canSeeDraft }));
  })
);

/**
 * @openapi
 * /api/workshops/{id}/seats/stream:
 *   get:
 *     summary: Stream workshop seat availability using Server-Sent Events.
 */
workshopRouter.get(
  "/:id/seats/stream",
  asyncHandler(async (req, res) => {
    const workshopId = String(req.params.id);
    const canSeeDraft = req.user?.roles.some((role) => [Role.ADMIN, Role.ORGANIZER].includes(role)) ?? false;
    const initial = await getWorkshopSeatAvailability({ workshopId, canSeeDraft });

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });

    const send = (payload: WorkshopSeatAvailabilityDto) => {
      res.write(`event: workshop.seats.updated\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    send(initial);

    const heartbeat = setInterval(() => {
      res.write(": keep-alive\n\n");
    }, 25_000);

    const unsubscribe = await subscribeWorkshopSeatUpdates({
      workshopId,
      onUpdate: send
    }).catch((error) => {
      console.warn("Seat stream Redis subscription unavailable; client can fall back to polling", error);
      return null;
    });

    if (!unsubscribe) {
      clearInterval(heartbeat);
      res.end();
      return;
    }

    req.on("close", () => {
      clearInterval(heartbeat);
      void unsubscribe();
    });
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
  "/:id/pdf",
  requireRole([Role.ORGANIZER, Role.ADMIN]),
  asyncHandler(async (req, res) => {
    const maxBodyBytes = Math.ceil(env.AI_SUMMARY_PDF_MAX_MB * 1024 * 1024) + 1024 * 1024;
    const form = await readMultipartFormData(req, maxBodyBytes);
    const file = form.files.find((candidate) => candidate.fieldName === "file");
    if (!file) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "PDF file is required" } });
    }

    const result = await uploadWorkshopPdfSummary({
      workshopId: String(req.params.id),
      fileName: file.fileName,
      contentType: file.contentType,
      buffer: file.buffer,
      actorId: req.user!.id,
      requestId: req.requestId
    });

    return res.status(202).json(result);
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
