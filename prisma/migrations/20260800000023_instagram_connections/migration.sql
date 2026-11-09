CREATE TABLE "instagram_connections" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'facebook',
  "facebook_page_id" TEXT NOT NULL,
  "facebook_page_name" TEXT NOT NULL,
  "instagram_account_id" TEXT NOT NULL,
  "instagram_username" TEXT,
  "encrypted_access_token" TEXT NOT NULL,
  "token_expires_at" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'connected',
  "last_verified_at" TIMESTAMP(3),
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "instagram_connections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "instagram_connections_provider_key"
ON "instagram_connections"("provider");

CREATE UNIQUE INDEX "instagram_connections_instagram_account_id_key"
ON "instagram_connections"("instagram_account_id");
