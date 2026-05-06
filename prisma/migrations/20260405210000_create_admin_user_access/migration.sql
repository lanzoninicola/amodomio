CREATE TYPE "AdminUserRole" AS ENUM ('user', 'admin', 'super-admin');

CREATE TYPE "AdminUserProvisionSource" AS ENUM ('manual', 'seed', 'whitelist-migration');

CREATE TYPE "AccessAuditEventType" AS ENUM (
    'login-success',
    'login-failure',
    'logout',
    'password-reset-requested',
    'password-reset-sent',
    'password-reset-failed'
);

CREATE TYPE "AccessAuditProvider" AS ENUM ('google', 'password', 'system');

CREATE TABLE "admin_user_access" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "mobile_phone" TEXT,
    "avatar_url" TEXT,
    "google_sub" TEXT,
    "roles" "AdminUserRole"[] NOT NULL DEFAULT ARRAY['user']::"AdminUserRole"[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "allow_google_login" BOOLEAN NOT NULL DEFAULT false,
    "allow_password_login" BOOLEAN NOT NULL DEFAULT false,
    "password_hash" TEXT,
    "password_updated_at" TIMESTAMP(3),
    "temporary_password_hash" TEXT,
    "temporary_password_expires_at" TIMESTAMP(3),
    "temporary_password_sent_at" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "last_google_login_at" TIMESTAMP(3),
    "last_password_login_at" TIMESTAMP(3),
    "source" "AdminUserProvisionSource" NOT NULL DEFAULT 'manual',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_user_access_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin_access_audit" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "username" TEXT,
    "email" TEXT,
    "provider" "AccessAuditProvider" NOT NULL,
    "event_type" "AccessAuditEventType" NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_access_audit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_user_access_username_key" ON "admin_user_access"("username");
CREATE UNIQUE INDEX "admin_user_access_email_key" ON "admin_user_access"("email");
CREATE UNIQUE INDEX "admin_user_access_google_sub_key" ON "admin_user_access"("google_sub");
CREATE INDEX "admin_user_access_is_active_idx" ON "admin_user_access"("is_active");
CREATE INDEX "admin_user_access_allow_google_login_idx" ON "admin_user_access"("allow_google_login");
CREATE INDEX "admin_user_access_allow_password_login_idx" ON "admin_user_access"("allow_password_login");

CREATE INDEX "admin_access_audit_user_id_created_at_idx" ON "admin_access_audit"("user_id", "created_at");
CREATE INDEX "admin_access_audit_event_type_created_at_idx" ON "admin_access_audit"("event_type", "created_at");

ALTER TABLE "admin_access_audit"
ADD CONSTRAINT "admin_access_audit_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "admin_user_access"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "admin_user_access" (
    "id",
    "username",
    "name",
    "roles",
    "is_active",
    "allow_google_login",
    "allow_password_login",
    "source"
) VALUES
    ('6b7b5029-090a-4937-9664-d9cf0d188001', 'gustavo.b', 'Gustavo', ARRAY['admin']::"AdminUserRole"[], true, false, false, 'seed'),
    ('6b7b5029-090a-4937-9664-d9cf0d188002', 'nicola.l', 'Nicola', ARRAY['super-admin']::"AdminUserRole"[], true, false, false, 'seed'),
    ('6b7b5029-090a-4937-9664-d9cf0d188003', 'dioni.m', 'Dioni', ARRAY['admin']::"AdminUserRole"[], true, false, false, 'seed');
