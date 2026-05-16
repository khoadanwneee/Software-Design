import type {
  AdminUserDto,
  CreateRoomRequest,
  CreateRegistrationRequest,
  CreateWorkshopRequest,
  LoginRequest,
  LoginResponse,
  NotificationListParams,
  NotificationsResponse,
  OfflineCheckinCacheResponse,
  OfflineCheckinSyncRequest,
  OfflineCheckinSyncResponse,
  RegistrationDto,
  RoomDto,
  RoomLayoutMetadataRequest,
  StudentImportListParams,
  StudentImportListResponse,
  StudentImportRunDetailDto,
  StudentImportUploadResponse,
  UpdateRoomRequest,
  UpdateUserRolesRequest,
  UpdateUserStatusRequest,
  UserListFilters,
  WorkshopDto,
  WorkshopListFilters,
  WorkshopSeatAvailabilityDto,
  UnreadCountResponse,
  NotificationItem
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

interface StreamOptions<T> {
  eventName: string;
  onEvent: (payload: T) => void;
  onError?: (error: Error) => void;
}

function toQueryString(params: object = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    query.set(key, String(value));
  }
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
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

  stream<T>(path: string, options: StreamOptions<T>) {
    const controller = new AbortController();
    const token = this.options.getAccessToken?.();
    const headers = new Headers({ Accept: "text/event-stream" });
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const run = async () => {
      const response = await fetch(`${this.options.baseUrl}${path}`, {
        headers,
        cache: "no-store",
        signal: controller.signal
      });

      if (response.status === 401) {
        this.options.onUnauthorized?.();
      }

      if (!response.ok || !response.body) {
        throw new ApiClientError(response.status, "SSE_UNAVAILABLE", response.statusText || "SSE stream unavailable");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (!controller.signal.aborted) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const event = parseSseFrame(frame);
          if (event?.event === options.eventName && event.data) {
            options.onEvent(JSON.parse(event.data) as T);
          }
        }
      }

      if (!controller.signal.aborted) {
        throw new Error("SSE stream closed");
      }
    };

    void run().catch((error: unknown) => {
      if (!controller.signal.aborted) {
        options.onError?.(error instanceof Error ? error : new Error("SSE stream failed"));
      }
    });

    return () => controller.abort();
  }
}

function parseSseFrame(frame: string) {
  const event: { event?: string; data?: string } = {};
  const dataLines: string[] = [];
  for (const rawLine of frame.split("\n")) {
    const line = rawLine.trimEnd();
    if (line.startsWith(":")) {
      continue;
    }
    if (line.startsWith("event:")) {
      event.event = line.slice("event:".length).trim();
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trim());
    }
  }
  if (dataLines.length > 0) {
    event.data = dataLines.join("\n");
  }
  return event;
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
      list: (filters: WorkshopListFilters = {}) =>
        client.request<WorkshopDto[]>(`/workshops${toQueryString(filters)}`),
      detail: (id: string) => client.request<WorkshopDto>(`/workshops/${id}`),
      seats: (id: string) => client.request<WorkshopSeatAvailabilityDto>(`/workshops/${id}/seats`),
      streamSeats: (
        id: string,
        handlers: { onEvent: (payload: WorkshopSeatAvailabilityDto) => void; onError?: (error: Error) => void }
      ) =>
        client.stream<WorkshopSeatAvailabilityDto>(`/workshops/${id}/seats/stream`, {
          eventName: "workshop.seats.updated",
          onEvent: handlers.onEvent,
          onError: handlers.onError
        }),
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
      myByWorkshop: (workshopId: string) =>
        client.request<{ id: string; workshopId: string; status: string } | null>(
          `/registrations/me${toQueryString({ workshopId })}`
        ),
      qr: (id: string) => client.request<{ registrationId: string; qrPayload: string }>(`/registrations/${id}/qr`)
    },
    paymentApi: {
      webhookMock: (body: unknown) =>
        client.request<{ ok: true }>("/payments/webhook/mock", { method: "POST", body: JSON.stringify(body) })
    },
    roomApi: {
      list: () => client.request<RoomDto[]>("/rooms"),
      detail: (id: string) => client.request<RoomDto>(`/rooms/${id}`),
      create: (body: CreateRoomRequest) =>
        client.request<RoomDto>("/rooms", { method: "POST", body: JSON.stringify(body) }),
      update: (id: string, body: UpdateRoomRequest) =>
        client.request<RoomDto>(`/rooms/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
      updateStatus: (id: string, status: RoomDto["status"]) =>
        client.request<RoomDto>(`/rooms/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
      uploadLayout: (id: string, body: RoomLayoutMetadataRequest) =>
        client.request<RoomDto>(`/rooms/${id}/layout`, { method: "POST", body: JSON.stringify(body) }),
      archive: (id: string) => client.request<RoomDto>(`/rooms/${id}`, { method: "DELETE" })
    },
    userApi: {
      list: (filters: UserListFilters = {}) => client.request<AdminUserDto[]>(`/users${toQueryString(filters)}`),
      updateRoles: (id: string, body: UpdateUserRolesRequest) =>
        client.request<AdminUserDto>(`/users/${id}/roles`, { method: "PATCH", body: JSON.stringify(body) }),
      updateStatus: (id: string, body: UpdateUserStatusRequest) =>
        client.request<AdminUserDto>(`/users/${id}/status`, { method: "PATCH", body: JSON.stringify(body) })
    },
    notificationApi: {
      list: (params: NotificationListParams = {}) =>
        client.request<NotificationsResponse>(`/notifications${toQueryString(params)}`),
      unreadCount: () => client.request<UnreadCountResponse>("/notifications/unread-count"),
      markRead: (id: string) =>
        client.request<NotificationItem>(`/notifications/${id}/read`, { method: "PATCH" }),
      markAllRead: () => client.request<{ updated: number }>("/notifications/read-all", { method: "PATCH" })
    },
    checkinApi: {
      offlineCache: (workshopId: string) =>
        client.request<OfflineCheckinCacheResponse>(`/checkins/offline-cache${toQueryString({ workshopId })}`),
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
    },
    studentImportApi: {
      upload: (body: FormData) =>
        client.request<StudentImportUploadResponse>("/admin/student-imports", { method: "POST", body }),
      list: (params: StudentImportListParams = {}) =>
        client.request<StudentImportListResponse>(`/admin/student-imports${toQueryString(params)}`),
      detail: (id: string) => client.request<StudentImportRunDetailDto>(`/admin/student-imports/${id}`)
    }
  };
}
