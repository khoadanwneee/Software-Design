import type { Role, UserStatus } from "@unihub/shared-types";

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      fullName: string;
      roles: Role[];
      status: UserStatus;
    }

    interface Request {
      user?: User;
      requestId?: string;
    }
  }
}

export {};
