CREATE TYPE "AdminUserSessionStatus" AS ENUM ('active', 'revoked', 'blocked', 'expired');

ALTER TYPE "AccessAuditEventType" ADD VALUE IF NOT EXISTS 'logout-all-devices';
ALTER TYPE "AccessAuditEventType" ADD VALUE IF NOT EXISTS 'session-expired';
ALTER TYPE "AccessAuditEventType" ADD VALUE IF NOT EXISTS 'session-revoked';
ALTER TYPE "AccessAuditEventType" ADD VALUE IF NOT EXISTS 'session-blocked';

CREATE TABLE "admin_user_session" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "auth_provider" "AccessAuditProvider" NOT NULL,
    "session_secret_hash" TEXT NOT NULL,
    "status" "AdminUserSessionStatus" NOT NULL DEFAULT 'active',
    "device_label" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idle_expires_at" TIMESTAMP(3) NOT NULL,
    "absolute_expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "revoked_reason" TEXT,
    "revoked_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_user_session_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "admin_access_audit"
ADD COLUMN "actor_user_id" TEXT,
ADD COLUMN "session_id" TEXT,
ADD COLUMN "session_device_label" TEXT;

CREATE INDEX "admin_user_session_user_id_status_idx"
ON "admin_user_session"("user_id", "status");

CREATE INDEX "admin_user_session_status_idle_expires_at_idx"
ON "admin_user_session"("status", "idle_expires_at");

CREATE INDEX "admin_user_session_absolute_expires_at_idx"
ON "admin_user_session"("absolute_expires_at");

CREATE INDEX "admin_access_audit_actor_user_id_created_at_idx"
ON "admin_access_audit"("actor_user_id", "created_at");

CREATE INDEX "admin_access_audit_session_id_created_at_idx"
ON "admin_access_audit"("session_id", "created_at");

ALTER TABLE "admin_user_session"
ADD CONSTRAINT "admin_user_session_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "admin_user_access"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "admin_user_session"
ADD CONSTRAINT "admin_user_session_revoked_by_user_id_fkey"
FOREIGN KEY ("revoked_by_user_id") REFERENCES "admin_user_access"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "admin_access_audit"
ADD CONSTRAINT "admin_access_audit_actor_user_id_fkey"
FOREIGN KEY ("actor_user_id") REFERENCES "admin_user_access"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "admin_access_audit"
ADD CONSTRAINT "admin_access_audit_session_id_fkey"
FOREIGN KEY ("session_id") REFERENCES "admin_user_session"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
