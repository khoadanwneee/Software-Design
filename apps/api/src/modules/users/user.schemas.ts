import { z } from "zod";
import { Role, UserStatus } from "@unihub/shared-types";

const optionalNonEmptyString = z
  .string()
  .trim()
  .min(1)
  .optional()
  .or(z.literal("").transform(() => undefined));

export const userListQuerySchema = z.object({
  keyword: optionalNonEmptyString,
  role: z.nativeEnum(Role).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50)
});

export const updateRolesSchema = z.object({
  roles: z.array(z.nativeEnum(Role)).min(1)
});

export const updateUserStatusSchema = z.object({
  status: z.nativeEnum(UserStatus)
});
