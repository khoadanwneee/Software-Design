CREATE TABLE "uploaded_files" (
  "id" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "content_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "storage_key" TEXT NOT NULL,
  "checksum_sha256" TEXT NOT NULL,
  "uploaded_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "uploaded_files_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "student_import_runs"
  ADD COLUMN "file_id" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "dry_run" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "uploaded_files_storage_key_key" ON "uploaded_files"("storage_key");
CREATE INDEX "uploaded_files_checksum_sha256_idx" ON "uploaded_files"("checksum_sha256");
CREATE INDEX "uploaded_files_uploaded_by_id_idx" ON "uploaded_files"("uploaded_by_id");
CREATE INDEX "student_import_runs_file_id_idx" ON "student_import_runs"("file_id");

ALTER TABLE "uploaded_files"
  ADD CONSTRAINT "uploaded_files_uploaded_by_id_fkey"
  FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "student_import_runs"
  ADD CONSTRAINT "student_import_runs_file_id_fkey"
  FOREIGN KEY ("file_id") REFERENCES "uploaded_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
