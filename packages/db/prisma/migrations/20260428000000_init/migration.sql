CREATE TYPE "Role" AS ENUM ('STUDENT', 'ORGANIZER', 'CHECKIN_STAFF', 'ADMIN');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'LOCKED', 'PENDING_VERIFICATION');
CREATE TYPE "WorkshopStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED');
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING_PAYMENT', 'CONFIRMED', 'PAYMENT_FAILED', 'CANCELLED');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'INIT_FAILED', 'REFUND_PENDING', 'REFUNDED', 'NEEDS_MANUAL_REVIEW');
CREATE TYPE "QrTokenStatus" AS ENUM ('ACTIVE', 'USED', 'EXPIRED', 'REVOKED');
CREATE TYPE "OfflineSyncStatus" AS ENUM ('PENDING', 'SYNCED', 'FAILED', 'DUPLICATE', 'CONFLICT');
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'TELEGRAM');
CREATE TYPE "AiSummaryStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE "StudentImportStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'DONE_WITH_ERRORS', 'FAILED');

CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "full_name" TEXT NOT NULL,
  "roles" "Role"[] NOT NULL DEFAULT ARRAY['STUDENT']::"Role"[],
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "student_profiles" (
  "id" TEXT NOT NULL,
  "user_id" TEXT,
  "student_code" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "full_name" TEXT NOT NULL,
  "major" TEXT,
  "class_name" TEXT,
  "verified_at" TIMESTAMP(3),
  "imported_at" TIMESTAMP(3),
  CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rooms" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "capacity" INTEGER NOT NULL,
  "layout_url" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "speakers" (
  "id" TEXT NOT NULL,
  "full_name" TEXT NOT NULL,
  "title" TEXT,
  "bio" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "speakers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workshops" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "room_id" TEXT NOT NULL,
  "created_by_id" TEXT NOT NULL,
  "start_time" TIMESTAMP(3) NOT NULL,
  "end_time" TIMESTAMP(3) NOT NULL,
  "capacity" INTEGER NOT NULL,
  "registered_count" INTEGER NOT NULL DEFAULT 0,
  "price_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'VND',
  "status" "WorkshopStatus" NOT NULL DEFAULT 'DRAFT',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "cancelled_at" TIMESTAMP(3),
  CONSTRAINT "workshops_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workshop_speakers" (
  "id" TEXT NOT NULL,
  "workshop_id" TEXT NOT NULL,
  "speaker_id" TEXT NOT NULL,
  CONSTRAINT "workshop_speakers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "registrations" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "workshop_id" TEXT NOT NULL,
  "status" "RegistrationStatus" NOT NULL DEFAULT 'CONFIRMED',
  "idempotency_key" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "registrations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payments" (
  "id" TEXT NOT NULL,
  "registration_id" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'mock',
  "provider_order_id" TEXT,
  "provider_transaction_id" TEXT,
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'VND',
  "payment_url" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "idempotency_keys" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "request_hash" TEXT NOT NULL,
  "response_json" JSONB,
  "status_code" INTEGER,
  "expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payment_callbacks" (
  "id" TEXT NOT NULL,
  "payment_id" TEXT,
  "provider" TEXT NOT NULL,
  "provider_event_id" TEXT NOT NULL,
  "provider_transaction_id" TEXT,
  "valid_signature" BOOLEAN NOT NULL,
  "payload" JSONB NOT NULL,
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_callbacks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "qr_tokens" (
  "id" TEXT NOT NULL,
  "registration_id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "token_preview" TEXT NOT NULL,
  "status" "QrTokenStatus" NOT NULL DEFAULT 'ACTIVE',
  "expires_at" TIMESTAMP(3),
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "qr_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "checkins" (
  "id" TEXT NOT NULL,
  "qr_token_id" TEXT NOT NULL,
  "workshop_id" TEXT NOT NULL,
  "staff_id" TEXT NOT NULL,
  "idempotency_key" TEXT,
  "client_checkin_id" TEXT,
  "device_id" TEXT,
  "checked_in_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "checkins_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "offline_checkin_sync_logs" (
  "id" TEXT NOT NULL,
  "client_checkin_id" TEXT NOT NULL,
  "device_id" TEXT NOT NULL,
  "workshop_id" TEXT NOT NULL,
  "staff_id" TEXT NOT NULL,
  "qr_payload_hash" TEXT NOT NULL,
  "sync_status" "OfflineSyncStatus" NOT NULL,
  "checkin_id" TEXT,
  "error_code" TEXT,
  "error_message" TEXT,
  "synced_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "offline_checkin_sync_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notifications" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "workshop_id" TEXT,
  "channel" "NotificationChannel" NOT NULL,
  "event_type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
  "dedupe_key" TEXT NOT NULL,
  "retry_count" INTEGER NOT NULL DEFAULT 0,
  "last_error" TEXT,
  "sent_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_documents" (
  "id" TEXT NOT NULL,
  "workshop_id" TEXT NOT NULL,
  "uploaded_by_id" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "content_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "storage_key" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_summaries" (
  "id" TEXT NOT NULL,
  "workshop_id" TEXT NOT NULL,
  "document_id" TEXT NOT NULL,
  "status" "AiSummaryStatus" NOT NULL DEFAULT 'PENDING',
  "summary_text" TEXT,
  "error_message" TEXT,
  "model_version" TEXT,
  "prompt_version" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_summaries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "student_import_runs" (
  "id" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "file_hash" TEXT NOT NULL,
  "import_type" TEXT NOT NULL DEFAULT 'LEGACY_STUDENT_CSV',
  "status" "StudentImportStatus" NOT NULL DEFAULT 'PENDING',
  "total_rows" INTEGER NOT NULL DEFAULT 0,
  "success_rows" INTEGER NOT NULL DEFAULT 0,
  "failed_rows" INTEGER NOT NULL DEFAULT 0,
  "error_message" TEXT,
  "created_by_id" TEXT,
  "started_at" TIMESTAMP(3),
  "finished_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_import_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "student_import_errors" (
  "id" TEXT NOT NULL,
  "run_id" TEXT NOT NULL,
  "row_number" INTEGER NOT NULL,
  "student_code" TEXT,
  "email" TEXT,
  "error_code" TEXT NOT NULL,
  "error_message" TEXT NOT NULL,
  "raw_row" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_import_errors_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
  "id" TEXT NOT NULL,
  "actor_id" TEXT,
  "action" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT,
  "old_value" JSONB,
  "new_value" JSONB,
  "request_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "student_profiles_user_id_key" ON "student_profiles"("user_id");
CREATE UNIQUE INDEX "student_profiles_student_code_key" ON "student_profiles"("student_code");
CREATE UNIQUE INDEX "student_profiles_email_key" ON "student_profiles"("email");
CREATE INDEX "student_profiles_student_code_idx" ON "student_profiles"("student_code");
CREATE INDEX "student_profiles_major_idx" ON "student_profiles"("major");
CREATE UNIQUE INDEX "rooms_name_key" ON "rooms"("name");
CREATE INDEX "rooms_capacity_idx" ON "rooms"("capacity");
CREATE INDEX "speakers_full_name_idx" ON "speakers"("full_name");
CREATE UNIQUE INDEX "workshops_slug_key" ON "workshops"("slug");
CREATE INDEX "workshops_start_time_idx" ON "workshops"("start_time");
CREATE INDEX "workshops_room_id_start_time_end_time_idx" ON "workshops"("room_id", "start_time", "end_time");
CREATE INDEX "workshops_status_category_idx" ON "workshops"("status", "category");
CREATE UNIQUE INDEX "workshop_speakers_workshop_id_speaker_id_key" ON "workshop_speakers"("workshop_id", "speaker_id");
CREATE INDEX "workshop_speakers_speaker_id_idx" ON "workshop_speakers"("speaker_id");
CREATE UNIQUE INDEX "registrations_idempotency_key_key" ON "registrations"("idempotency_key");
CREATE UNIQUE INDEX "registrations_user_id_workshop_id_key" ON "registrations"("user_id", "workshop_id");
CREATE INDEX "registrations_workshop_id_status_idx" ON "registrations"("workshop_id", "status");
CREATE INDEX "registrations_user_id_idx" ON "registrations"("user_id");
CREATE UNIQUE INDEX "payments_registration_id_key" ON "payments"("registration_id");
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");
CREATE UNIQUE INDEX "payments_provider_transaction_id_key" ON "payments"("provider_transaction_id");
CREATE INDEX "payments_status_idx" ON "payments"("status");
CREATE INDEX "payments_provider_order_id_idx" ON "payments"("provider_order_id");
CREATE UNIQUE INDEX "idempotency_keys_scope_key_key" ON "idempotency_keys"("scope", "key");
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys"("expires_at");
CREATE UNIQUE INDEX "payment_callbacks_provider_provider_event_id_key" ON "payment_callbacks"("provider", "provider_event_id");
CREATE INDEX "payment_callbacks_provider_transaction_id_idx" ON "payment_callbacks"("provider_transaction_id");
CREATE INDEX "payment_callbacks_received_at_idx" ON "payment_callbacks"("received_at");
CREATE UNIQUE INDEX "qr_tokens_registration_id_key" ON "qr_tokens"("registration_id");
CREATE UNIQUE INDEX "qr_tokens_token_hash_key" ON "qr_tokens"("token_hash");
CREATE INDEX "qr_tokens_status_idx" ON "qr_tokens"("status");
CREATE INDEX "qr_tokens_expires_at_idx" ON "qr_tokens"("expires_at");
CREATE UNIQUE INDEX "checkins_qr_token_id_key" ON "checkins"("qr_token_id");
CREATE UNIQUE INDEX "checkins_idempotency_key_key" ON "checkins"("idempotency_key");
CREATE INDEX "checkins_workshop_id_checked_in_at_idx" ON "checkins"("workshop_id", "checked_in_at");
CREATE INDEX "checkins_staff_id_idx" ON "checkins"("staff_id");
CREATE UNIQUE INDEX "offline_checkin_sync_logs_device_id_client_checkin_id_key" ON "offline_checkin_sync_logs"("device_id", "client_checkin_id");
CREATE INDEX "offline_checkin_sync_logs_sync_status_idx" ON "offline_checkin_sync_logs"("sync_status");
CREATE INDEX "offline_checkin_sync_logs_workshop_id_idx" ON "offline_checkin_sync_logs"("workshop_id");
CREATE UNIQUE INDEX "notifications_dedupe_key_key" ON "notifications"("dedupe_key");
CREATE INDEX "notifications_user_id_status_idx" ON "notifications"("user_id", "status");
CREATE INDEX "notifications_event_type_created_at_idx" ON "notifications"("event_type", "created_at");
CREATE INDEX "ai_documents_workshop_id_idx" ON "ai_documents"("workshop_id");
CREATE UNIQUE INDEX "ai_summaries_workshop_id_document_id_key" ON "ai_summaries"("workshop_id", "document_id");
CREATE INDEX "ai_summaries_status_idx" ON "ai_summaries"("status");
CREATE UNIQUE INDEX "student_import_runs_file_hash_import_type_key" ON "student_import_runs"("file_hash", "import_type");
CREATE INDEX "student_import_runs_status_idx" ON "student_import_runs"("status");
CREATE UNIQUE INDEX "student_import_errors_run_id_row_number_key" ON "student_import_errors"("run_id", "row_number");
CREATE INDEX "student_import_errors_student_code_idx" ON "student_import_errors"("student_code");
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "workshops" ADD CONSTRAINT "workshops_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workshops" ADD CONSTRAINT "workshops_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workshop_speakers" ADD CONSTRAINT "workshop_speakers_workshop_id_fkey" FOREIGN KEY ("workshop_id") REFERENCES "workshops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workshop_speakers" ADD CONSTRAINT "workshop_speakers_speaker_id_fkey" FOREIGN KEY ("speaker_id") REFERENCES "speakers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_workshop_id_fkey" FOREIGN KEY ("workshop_id") REFERENCES "workshops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_callbacks" ADD CONSTRAINT "payment_callbacks_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "qr_tokens" ADD CONSTRAINT "qr_tokens_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_qr_token_id_fkey" FOREIGN KEY ("qr_token_id") REFERENCES "qr_tokens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_workshop_id_fkey" FOREIGN KEY ("workshop_id") REFERENCES "workshops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "offline_checkin_sync_logs" ADD CONSTRAINT "offline_checkin_sync_logs_workshop_id_fkey" FOREIGN KEY ("workshop_id") REFERENCES "workshops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "offline_checkin_sync_logs" ADD CONSTRAINT "offline_checkin_sync_logs_checkin_id_fkey" FOREIGN KEY ("checkin_id") REFERENCES "checkins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workshop_id_fkey" FOREIGN KEY ("workshop_id") REFERENCES "workshops"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_documents" ADD CONSTRAINT "ai_documents_workshop_id_fkey" FOREIGN KEY ("workshop_id") REFERENCES "workshops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_documents" ADD CONSTRAINT "ai_documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ai_summaries" ADD CONSTRAINT "ai_summaries_workshop_id_fkey" FOREIGN KEY ("workshop_id") REFERENCES "workshops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_summaries" ADD CONSTRAINT "ai_summaries_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "ai_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_import_runs" ADD CONSTRAINT "student_import_runs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "student_import_errors" ADD CONSTRAINT "student_import_errors_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "student_import_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
