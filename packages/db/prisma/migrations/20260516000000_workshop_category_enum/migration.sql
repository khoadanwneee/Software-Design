-- Clean existing values first
UPDATE "workshops"
SET "category" = TRIM("category");

UPDATE "workshops"
SET "category" =
  CASE LOWER("category")
    WHEN 'ai' THEN 'AI'
    WHEN 'career' THEN 'Career'
    WHEN 'data' THEN 'Data'
    WHEN 'design' THEN 'Design'
    WHEN 'product' THEN 'Product'
    WHEN 'cloud' THEN 'Cloud'
    WHEN 'security' THEN 'Security'
    WHEN 'devops' THEN 'DevOps'
    WHEN 'mobile' THEN 'Mobile'
    WHEN 'web' THEN 'Web'
    ELSE NULL
  END;

-- Create enum
CREATE TYPE "WorkshopCategory" AS ENUM (
  'AI',
  'Career',
  'Data',
  'Design',
  'Product',
  'Cloud',
  'Security',
  'DevOps',
  'Mobile',
  'Web'
);

-- Convert column
ALTER TABLE "workshops"
ALTER COLUMN "category" TYPE "WorkshopCategory"
USING ("category"::"WorkshopCategory");