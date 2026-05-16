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

export enum RoomStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  ARCHIVED = "ARCHIVED"
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
  PARTIAL_FAILED = "PARTIAL_FAILED",
  FAILED_TEMPLATE = "FAILED_TEMPLATE",
  FAILED_PROVIDER = "FAILED_PROVIDER",
  SKIPPED = "SKIPPED"
}

export enum NotificationChannel {
  IN_APP = "IN_APP",
  EMAIL = "EMAIL",
  TELEGRAM = "TELEGRAM"
}

export enum NotificationDeliveryStatus {
  PENDING = "PENDING",
  SENT = "SENT",
  FAILED = "FAILED",
  FAILED_TEMPLATE = "FAILED_TEMPLATE",
  SKIPPED = "SKIPPED",
  PREFERENCE_DISABLED = "PREFERENCE_DISABLED"
}

export type NotificationReadStatus = "UNREAD" | "READ";
export type NotificationListStatus = NotificationReadStatus | "ALL";

export enum AiSummaryStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  DONE = "DONE",
  FAILED = "FAILED"
}

export enum StudentImportStatus {
  PENDING = "PENDING",
  RUNNING = "RUNNING",
  DONE = "DONE",
  DONE_WITH_ERRORS = "DONE_WITH_ERRORS",
  FAILED = "FAILED"
}

export enum UploadedFileType {
  STUDENT_CSV = "STUDENT_CSV",
  PDF = "PDF"
}

export interface UploadedFileDto {
  id: string;
  fileType?: UploadedFileType;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  storageKey: string;
  createdAt: string;
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
  status: RoomStatus;
  layoutUrl?: string | null;
  workshopCount?: number;
  createdAt?: string;
  updatedAt?: string;
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
    id: string;
    status: AiSummaryStatus;
    summary: string | null;
    updatedAt: string | null;
  } | null;
}

export type WorkshopPriceType = "all" | "free" | "paid";

export interface WorkshopListFilters {
  keyword?: string;
  category?: string;
  roomId?: string;
  date?: string;
  fromDate?: string;
  toDate?: string;
  hasSeats?: boolean;
  priceType?: WorkshopPriceType;
  page?: number;
  limit?: number;
}

export interface WorkshopSeatAvailabilityDto {
  workshopId: string;
  capacity: number;
  registeredCount: number;
  remainingSeats: number;
  status: WorkshopStatus;
  updatedAt: string;
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

export interface CreateRoomRequest {
  name: string;
  capacity: number;
  status?: RoomStatus;
  layoutUrl?: string | null;
}

export type UpdateRoomRequest = Partial<CreateRoomRequest>;

export interface RoomLayoutMetadataRequest {
  fileName: string;
  contentType: string;
  size: number;
}

export interface AdminUserDto {
  id: string;
  email: string;
  fullName: string;
  roles: Role[];
  status: UserStatus;
  createdAt: string;
}

export interface UserListFilters {
  keyword?: string;
  role?: Role;
  status?: UserStatus;
  page?: number;
  limit?: number;
}

export interface UpdateUserRolesRequest {
  roles: Role[];
}

export interface UpdateUserStatusRequest {
  status: UserStatus;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type?: string;
  status: NotificationReadStatus;
  createdAt: string;
  readAt?: string | null;
  workshopId?: string | null;
  workshopTitle?: string | null;
  actionUrl?: string | null;
}

export interface NotificationsResponse {
  items: NotificationItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface NotificationListParams {
  page?: number;
  limit?: number;
  status?: NotificationListStatus;
}

export interface UnreadCountResponse {
  count: number;
}

export interface NotificationPreferenceDto {
  inApp: boolean;
  email: boolean;
  telegram: boolean;
}

export interface UpdateNotificationPreferenceRequest {
  inApp?: boolean;
  email?: boolean;
  telegram?: boolean;
}

export interface NotificationDeliveryDto {
  id: string;
  notificationId: string;
  channel: NotificationChannel;
  status: NotificationDeliveryStatus;
  providerMsgId?: string | null;
  errorMessage?: string | null;
  attemptCount: number;
  sentAt?: string | null;
  createdAt: string;
}

export interface StudentImportErrorDto {
  id: string;
  runId: string;
  rowNumber: number;
  studentCode?: string | null;
  email?: string | null;
  errorCode: string;
  errorMessage: string;
  rawRow?: unknown;
  createdAt: string;
}

export interface StudentImportRunDto {
  id: string;
  fileName: string;
  fileHash: string;
  fileId?: string | null;
  importType: string;
  description?: string | null;
  dryRun: boolean;
  status: StudentImportStatus;
  totalRows: number;
  successRows: number;
  failedRows: number;
  errorMessage?: string | null;
  createdById?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
  file?: UploadedFileDto | null;
}

export interface StudentImportRunDetailDto extends StudentImportRunDto {
  errors: StudentImportErrorDto[];
}

export interface StudentImportListParams {
  page?: number;
  limit?: number;
  status?: StudentImportStatus;
}

export interface StudentImportListResponse {
  items: StudentImportRunDto[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface StudentImportUploadResponse {
  jobId: string;
  fileId?: string | null;
  status: StudentImportStatus;
  totalRows: number;
  message: string;
  run: StudentImportRunDto;
}

export interface AiSummaryUploadResponse {
  uploadedFileId: string;
  aiSummaryId: string;
  status: AiSummaryStatus.PENDING;
}

export interface AiSummaryDto {
  id: string;
  workshopId: string;
  uploadedFileId: string;
  status: AiSummaryStatus;
  summary: string | null;
  errorMessage: string | null;
  model: string | null;
  attemptCount: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
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

export type OfflineQrCacheLocalStatus = "ACTIVE" | "USED_LOCALLY";

export interface OfflineQrCacheItem {
  tokenHash: string;
  registrationId: string;
  workshopId: string;
  studentName?: string | null;
  studentCode?: string | null;
  qrExpiresAt?: string | null;
  cacheExpiresAt: string;
}

export interface OfflineCheckinCacheResponse {
  workshopId: string;
  generatedAt: string;
  expiresAt: string;
  items: OfflineQrCacheItem[];
}

export interface OfflineQrCacheEntry extends OfflineQrCacheItem {
  syncedAt: string;
  localStatus: OfflineQrCacheLocalStatus;
  localUsedAt?: string | null;
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
