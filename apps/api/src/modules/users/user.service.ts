import { Role, UserStatus, type AdminUserDto, type UserListFilters } from "@unihub/shared-types";
import { ErrorCodes } from "@unihub/shared-utils";
import { Role as PrismaRole, UserStatus as PrismaUserStatus } from "@unihub/db";
import { prisma } from "../../config/prisma.js";
import { AppError } from "../../common/errors/app-error.js";

type AdminUserRecord = {
  id: string;
  email: string;
  fullName: string;
  roles: Role[];
  status: UserStatus;
  createdAt: Date;
};

function toAdminUserDto(user: AdminUserRecord): AdminUserDto {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    roles: user.roles,
    status: user.status,
    createdAt: user.createdAt.toISOString()
  };
}

async function findUserOrThrow(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, "User not found");
  }
  return user;
}

async function assertNotRemovingLastActiveAdmin(userId: string, nextRoles: Role[], nextStatus?: UserStatus) {
  const existing = await findUserOrThrow(userId);
  const keepsActiveAdmin = nextRoles.includes(Role.ADMIN) && (nextStatus ?? existing.status) === UserStatus.ACTIVE;
  const currentlyActiveAdmin = existing.roles.includes(Role.ADMIN) && existing.status === UserStatus.ACTIVE;

  if (!currentlyActiveAdmin || keepsActiveAdmin) {
    return existing;
  }

  const activeAdminCount = await prisma.user.count({
    where: { roles: { has: PrismaRole.ADMIN }, status: PrismaUserStatus.ACTIVE }
  });
  if (activeAdminCount <= 1) {
    throw new AppError(409, "LAST_ADMIN_LOCKOUT", "Cannot remove or lock the last active ADMIN user");
  }

  return existing;
}

export async function listUsers(filters: UserListFilters) {
  const users = await prisma.user.findMany({
    where: {
      status: filters.status as PrismaUserStatus | undefined,
      roles: filters.role ? { has: filters.role as PrismaRole } : undefined,
      OR: filters.keyword
        ? [
            { fullName: { contains: filters.keyword, mode: "insensitive" } },
            { email: { contains: filters.keyword, mode: "insensitive" } }
          ]
        : undefined
    },
    orderBy: { createdAt: "asc" },
    skip: ((filters.page ?? 1) - 1) * (filters.limit ?? 50),
    take: filters.limit ?? 50,
    select: { id: true, email: true, fullName: true, roles: true, status: true, createdAt: true }
  });
  return users.map((user) =>
    toAdminUserDto({
      ...user,
      roles: user.roles as Role[],
      status: user.status as UserStatus
    })
  );
}

export async function updateUserRoles(actorId: string, userId: string, roles: Role[]) {
  const existing = await assertNotRemovingLastActiveAdmin(userId, roles);
  const user = await prisma.user.update({
    where: { id: userId },
    data: { roles: roles as PrismaRole[] },
    select: { id: true, email: true, fullName: true, roles: true, status: true, createdAt: true }
  });

  await prisma.auditLog.create({
    data: {
      actorId,
      action: "USER_ROLES_UPDATED",
      entityType: "User",
      entityId: user.id,
      oldValue: { roles: existing.roles },
      newValue: { roles: user.roles }
    }
  });

  return toAdminUserDto({
    ...user,
    roles: user.roles as Role[],
    status: user.status as UserStatus
  });
}

export async function updateUserStatus(actorId: string, userId: string, status: UserStatus) {
  if (actorId === userId && status !== UserStatus.ACTIVE) {
    throw new AppError(409, "SELF_LOCKOUT", "Cannot lock your own active session user");
  }

  const existing = await findUserOrThrow(userId);
  await assertNotRemovingLastActiveAdmin(userId, existing.roles as Role[], status);

  const user = await prisma.user.update({
    where: { id: userId },
    data: { status: status as PrismaUserStatus },
    select: { id: true, email: true, fullName: true, roles: true, status: true, createdAt: true }
  });

  await prisma.auditLog.create({
    data: {
      actorId,
      action: "USER_STATUS_UPDATED",
      entityType: "User",
      entityId: user.id,
      oldValue: { status: existing.status },
      newValue: { status: user.status }
    }
  });

  return toAdminUserDto({
    ...user,
    roles: user.roles as Role[],
    status: user.status as UserStatus
  });
}
