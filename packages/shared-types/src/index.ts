export enum Role {
  STUDENT = "STUDENT",
  ORGANIZER = "ORGANIZER",
  CHECKIN_STAFF = "CHECKIN_STAFF",
  ADMIN = "ADMIN"
}

export enum UserStatus {
  ACTIVE = "ACTIVE",
  LOCKED = "LOCKED",
  PENDING_VERIFICATION = "PENDING_VERIFICATION"
}

export enum WorkshopStatus {
  DRAFT = "DRAFT",
  PUBLISHED = "PUBLISHED",
  CANCELLED = "CANCELLED",
  COMPLETED = "COMPLETED"
}

export enum RegistrationStatus {
  PENDING_PAYMENT = "PENDING_PAYMENT",
  CONFIRMED = "CONFIRMED",
  PAYMENT_FAILED = "PAYMENT_FAILED",
  CANCELLED = "CANCELLED"
}

export enum PaymentStatus {
  PENDING = "PENDING",
  PAID = "PAID",
  FAILED = "FAILED",
  EXPIRED = "EXPIRED",
  INIT_FAILED = "INIT_FAILED",
  REFUND_PENDING = "REFUND_PENDING",
  REFUNDED = "REFUNDED",
  NEEDS_MANUAL_REVIEW = "NEEDS_MANUAL_REVIEW"
}

export enum QrTokenStatus {
  ACTIVE = "ACTIVE",
  USED = "USED",
  EXPIRED = "EXPIRED",
  REVOKED = "REVOKED"
}

export enum OfflineSyncStatus {
  PENDING = "PENDING",
  SYNCED = "SYNCED",
  FAILED = "FAILED",
  DUPLICATE = "DUPLICATE",
  CONFLICT = "CONFLICT"
}

export enum NotificationStatus {
  PENDING = "PENDING",
  SENT = "SENT",
  FAILED = "FAILED",
  SKIPPED = "SKIPPED"
}

export enum NotificationChannel {
  IN_APP = "IN_APP",
  EMAIL = "EMAIL",
  TELEGRAM = "TELEGRAM"
}

export enum AiSummaryStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED"
}

export enum StudentImportStatus {
  PENDING = "PENDING",
  RUNNING = "RUNNING",
  DONE = "DONE",
  DONE_WITH_ERRORS = "DONE_WITH_ERRORS",
  FAILED = "FAILED"
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  roles: Role[];
  status: UserStatus;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface RoomDto {
  id: string;
  name: string;
  capacity: number;
  layoutUrl?: string | null;
}

export interface SpeakerDto {
  id: string;
  fullName: string;
  bio?: string | null;
  title?: string | null;
}

export interface WorkshopDto {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  status: WorkshopStatus;
  startTime: string;
  endTime: string;
  priceAmount: number;
  currency: string;
  capacity: number;
  registeredCount: number;
  remainingSeats: number;
  room: RoomDto;
  speakers: SpeakerDto[];
  aiSummary?: {
    status: AiSummaryStatus;
    summaryText?: string | null;
  } | null;
}

export interface CreateWorkshopRequest {
  title: string;
  description: string;
  category: string;
  roomId: string;
  startTime: string;
  endTime: string;
  capacity: number;
  priceAmount: number;
  currency?: string;
  speakerIds?: string[];
  status?: WorkshopStatus;
}

export interface RegistrationDto {
  id: string;
  workshopId: string;
  userId: string;
  status: RegistrationStatus;
  qrToken?: string | null;
  paymentUrl?: string | null;
}

export interface CreateRegistrationRequest {
  workshopId: string;
  idempotencyKey: string;
}

export interface PaymentIntentResponse {
  registrationId: string;
  paymentId: string;
  paymentUrl: string;
  status: PaymentStatus;
}

export interface QrPayload {
  token: string;
  registrationId?: string;
  workshopId?: string;
  issuedAt?: string;
}

export interface OfflineCheckinRecord {
  clientCheckinId: string;
  qrPayload: string;
  workshopId: string;
  staffId: string;
  deviceId: string;
  checkedInAt: string;
  syncStatus: OfflineSyncStatus;
  retryCount: number;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OfflineCheckinSyncRequest {
  events: OfflineCheckinRecord[];
}

export interface OfflineCheckinSyncResult {
  clientCheckinId: string;
  status: OfflineSyncStatus;
  checkinId?: string;
  errorCode?: string;
  message?: string;
}

export interface OfflineCheckinSyncResponse {
  results: OfflineCheckinSyncResult[];
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
