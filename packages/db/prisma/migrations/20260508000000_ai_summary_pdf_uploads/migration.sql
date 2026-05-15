CREATE TYPE "UploadedFileType" AS ENUM ('STUDENT_CSV', 'PDF');

ALTER TABLE "uploaded_files"
  ADD COLUMN "file_type" "UploadedFileType" NOT NULL DEFAULT 'STUDENT_CSV';

ALTER TYPE "AiSummaryStatus" RENAME VALUE 'COMPLETED' TO 'DONE';

ALTER TABLE "ai_summaries"
  ADD COLUMN "uploaded_file_id" TEXT,
  ADD COLUMN "attempt_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "started_at" TIMESTAMP(3),
  ADD COLUMN "completed_at" TIMESTAMP(3);

ALTER TABLE "ai_summaries"
  RENAME COLUMN "model_version" TO "model";

INSERT INTO "uploaded_files" (
  "id",
  "file_type",
  "file_name",
  "content_type",
  "size_bytes",
  "storage_key",
  "checksum_sha256",
  "uploaded_by_id",
  "created_at"
)
SELECT
  "id",
  'PDF'::"UploadedFileType",
  "file_name",
  "content_type",
  "size_bytes",
  "storage_key",
  substr(md5("id" || ':' || "storage_key") || md5("storage_key" || ':' || "id"), 1, 64),
  "uploaded_by_id",
  "created_at"
FROM "ai_documents"
ON CONFLICT ("storage_key") DO NOTHING;

UPDATE "ai_summaries"
SET "uploaded_file_id" = "document_id"
WHERE "uploaded_file_id" IS NULL;

ALTER TABLE "ai_summaries"
  ALTER COLUMN "uploaded_file_id" SET NOT NULL;

ALTER TABLE "ai_summaries"
  DROP CONSTRAINT "ai_summaries_document_id_fkey";

DROP INDEX "ai_summaries_workshop_id_document_id_key";

ALTER TABLE "ai_summaries"
  DROP COLUMN "document_id";

CREATE UNIQUE INDEX "ai_summaries_workshop_id_uploaded_file_id_key"
  ON "ai_summaries"("workshop_id", "uploaded_file_id");

CREATE INDEX "ai_summaries_workshop_id_idx" ON "ai_summaries"("workshop_id");
CREATE INDEX "ai_summaries_updated_at_idx" ON "ai_summaries"("updated_at");
CREATE INDEX "uploaded_files_file_type_idx" ON "uploaded_files"("file_type");

ALTER TABLE "ai_summaries"
  ADD CONSTRAINT "ai_summaries_uploaded_file_id_fkey"
  FOREIGN KEY ("uploaded_file_id") REFERENCES "uploaded_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
