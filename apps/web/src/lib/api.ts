import { createApiClient } from "@unihub/api-client";
import { clearSession, getAccessToken } from "../features/auth/session";

export const api = createApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api",
  getAccessToken,
  onUnauthorized: () => {
    clearSession();
    window.dispatchEvent(new Event("session:expired"));
  }
});
