CREATE TABLE "ai_context_profile_versions" (
  "id" TEXT NOT NULL,
  "language" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ai_context_profile_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_context_profile_versions_language_version_unique"
  ON "ai_context_profile_versions"("language", "version");

CREATE INDEX "ai_context_profile_versions_language_is_active_idx"
  ON "ai_context_profile_versions"("language", "is_active");

CREATE INDEX "ai_context_profile_versions_language_created_at_idx"
  ON "ai_context_profile_versions"("language", "created_at");
