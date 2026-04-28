import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { AuthUser, LoginRequest } from "@unihub/shared-types";
import { api } from "../../lib/api";
import { clearSession, getStoredUser, setSession } from "./session";

interface AuthContextValue {
  user: AuthUser | null;
  login: (input: LoginRequest) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());

  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener("session:expired", onExpired);
    return () => window.removeEventListener("session:expired", onExpired);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      login: async (input) => {
        const result = await api.authApi.login(input);
        setSession(result.accessToken, result.user);
        setUser(result.user);
      },
      logout: () => {
        clearSession();
        setUser(null);
      }
    }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return value;
}
