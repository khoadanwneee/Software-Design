import { Router } from "express";
import { validateBody } from "../../common/middleware/validate.js";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { loginSchema } from "./auth.schemas.js";
import { requireAuth } from "./auth.middleware.js";
import { login } from "./auth.service.js";

export const authRouter = Router();

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Demo login with email/password.
 */
authRouter.post(
  "/login",
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    res.json(await login(req.body));
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(req.user);
  })
);
