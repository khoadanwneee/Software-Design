import type { NextFunction, Request, Response } from "express";
import { ErrorCodes } from "@unihub/shared-utils";
import { Role } from "@unihub/shared-types";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../common/errors/app-error.js";
import { toAuthUser, verifyToken } from "./auth.service.js";

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.header("authorization");
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
    if (!token) {
      throw new AppError(401, ErrorCodes.UNAUTHORIZED, "Missing access token");
    }

    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new AppError(401, ErrorCodes.UNAUTHORIZED, "User no longer exists");
    }
    if (user.status !== "ACTIVE") {
      throw new AppError(403, ErrorCodes.FORBIDDEN, "User account is not active");
    }

    req.user = toAuthUser(user);
    return next();
  } catch (error) {
    return next(error);
  }
}

export function requireRole(allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, ErrorCodes.UNAUTHORIZED, "Authentication required"));
    }

    const allowed = req.user.roles.some((role) => allowedRoles.includes(role));
    if (!allowed) {
      return next(new AppError(403, ErrorCodes.FORBIDDEN, "You do not have permission for this action"));
    }

    return next();
  };
}
