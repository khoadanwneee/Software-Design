import type {
  CreateRegistrationRequest,
  CreateWorkshopRequest,
  LoginRequest,
  LoginResponse,
  OfflineCheckinSyncRequest,
  OfflineCheckinSyncResponse,
  RegistrationDto,
  WorkshopDto
} from "@unihub/shared-types";

export interface ApiClientOptions {
  baseUrl: string;
  getAccessToken?: () => string | null;
  onUnauthorized?: () => void;
}

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
  }
}

export class ApiClient {
  constructor(private readonly options: ApiClientOptions) {}

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = this.options.getAccessToken?.();
    const headers = new Headers(init.headers);

    if (!headers.has("Content-Type") && init.body && !(init.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(`${this.options.baseUrl}${path}`, {
      ...init,
      headers,
      cache: "no-store"
    });

    if (response.status === 401) {
      this.options.onUnauthorized?.();
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as
        | { error?: { code?: string; message?: string; details?: unknown } }
        | null;
      throw new ApiClientError(
        response.status,
        body?.error?.code ?? "HTTP_ERROR",
        body?.error?.message ?? response.statusText,
        body?.error?.details
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }
}

export function createApiClient(options: ApiClientOptions) {
  const client = new ApiClient(options);

  return {
    raw: client,
    authApi: {
      login: (body: LoginRequest) =>
        client.request<LoginResponse>("/auth/login", {
          method: "POST",
          body: JSON.stringify(body)
        }),
      me: () => client.request<LoginResponse["user"]>("/auth/me")
    },
    workshopApi: {
      list: () => client.request<WorkshopDto[]>("/workshops"),
      detail: (id: string) => client.request<WorkshopDto>(`/workshops/${id}`),
      create: (body: CreateWorkshopRequest) =>
        client.request<WorkshopDto>("/workshops", { method: "POST", body: JSON.stringify(body) }),
      update: (id: string, body: Partial<CreateWorkshopRequest>) =>
        client.request<WorkshopDto>(`/workshops/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
      cancel: (id: string) => client.request<WorkshopDto>(`/workshops/${id}/cancel`, { method: "POST" })
    },
    registrationApi: {
      createFree: (body: CreateRegistrationRequest) =>
        client.request<RegistrationDto>("/registrations", { method: "POST", body: JSON.stringify(body) }),
      createPaid: (body: CreateRegistrationRequest) =>
        client.request<RegistrationDto>("/registrations/paid", { method: "POST", body: JSON.stringify(body) }),
      qr: (id: string) => client.request<{ registrationId: string; qrPayload: string }>(`/registrations/${id}/qr`)
    },
    paymentApi: {
      webhookMock: (body: unknown) =>
        client.request<{ ok: true }>("/payments/webhook/mock", { method: "POST", body: JSON.stringify(body) })
    },
    checkinApi: {
      validateQr: (qrPayload: string, workshopId: string) =>
        client.request<{ valid: boolean; message: string }>("/checkins/validate", {
          method: "POST",
          body: JSON.stringify({ qrPayload, workshopId })
        }),
      checkin: (body: { qrPayload: string; workshopId: string; idempotencyKey: string }) =>
        client.request<{ checkinId: string; status: string }>("/checkins", {
          method: "POST",
          body: JSON.stringify(body)
        }),
      syncOffline: (body: OfflineCheckinSyncRequest) =>
        client.request<OfflineCheckinSyncResponse>("/checkins/offline-sync", {
          method: "POST",
          body: JSON.stringify(body)
        })
    },
    adminApi: {
      statistics: () =>
        client.request<{
          workshops: number;
          registrations: number;
          checkins: number;
          revenue: number;
        }>("/admin/statistics")
    },
    aiSummaryApi: {
      uploadMetadata: (body: { workshopId: string; fileName: string; contentType: string; size: number }) =>
        client.request<{ aiDocumentId: string; status: string }>("/ai-summary/documents", {
          method: "POST",
          body: JSON.stringify(body)
        })
    }
  };
}
