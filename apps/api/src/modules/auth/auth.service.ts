import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { ErrorCodes } from "@unihub/shared-utils";
import type { AuthUser, LoginRequest, LoginResponse } from "@unihub/shared-types";
import { env } from "../../config/env.js";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../common/errors/app-error.js";

interface JwtPayload {
  sub: string;
  roles: string[];
}

export function toAuthUser(user: {
  id: string;
  email: string;
  fullName: string;
  roles: string[];
  status: string;
}): AuthUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    roles: user.roles as AuthUser["roles"],
    status: user.status as AuthUser["status"]
  };
}

export async function login(input: LoginRequest): Promise<LoginResponse> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  if (!user) {
    throw new AppError(401, ErrorCodes.UNAUTHORIZED, "Invalid email or password");
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, ErrorCodes.UNAUTHORIZED, "Invalid email or password");
  }

  if (user.status !== "ACTIVE") {
    throw new AppError(403, ErrorCodes.FORBIDDEN, "User account is not active");
  }

  const signOptions: jwt.SignOptions = {
    subject: user.id,
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"]
  };
  const accessToken = jwt.sign({ roles: user.roles } satisfies Omit<JwtPayload, "sub">, env.JWT_SECRET, signOptions);

  return { accessToken, user: toAuthUser(user) };
}

export function verifyToken(token: string): JwtPayload {
  const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload & { sub?: string };
  if (!payload.sub) {
    throw new AppError(401, ErrorCodes.UNAUTHORIZED, "Invalid token");
  }
  return { sub: payload.sub, roles: payload.roles ?? [] };
}
