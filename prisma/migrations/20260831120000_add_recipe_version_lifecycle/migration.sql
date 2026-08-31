CREATE TYPE "RecipeStatus" AS ENUM ('draft', 'active', 'archived');

ALTER TABLE "recipes"
ADD COLUMN "group_id" TEXT,
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "status" "RecipeStatus" NOT NULL DEFAULT 'draft',
ADD COLUMN "activated_at" TIMESTAMP(3),
ADD COLUMN "archived_at" TIMESTAMP(3);

UPDATE "recipes"
SET
  "group_id" = "id",
  "status" = 'active',
  "activated_at" = COALESCE("updated_at", "created_at", CURRENT_TIMESTAMP);

ALTER TABLE "recipes"
ALTER COLUMN "group_id" SET NOT NULL;

CREATE UNIQUE INDEX "recipes_group_id_version_unique"
ON "recipes"("group_id", "version");

CREATE INDEX "recipes_group_id_status_idx"
ON "recipes"("group_id", "status");

CREATE UNIQUE INDEX "recipes_one_active_version_per_group"
ON "recipes"("group_id")
WHERE "status" = 'active';
