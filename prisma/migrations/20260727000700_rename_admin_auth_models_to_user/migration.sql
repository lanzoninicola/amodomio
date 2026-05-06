DO $$
BEGIN
    CREATE TYPE "UserRole" AS ENUM ('user', 'admin', 'super-admin');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE "UserProvisionSource" AS ENUM ('manual', 'seed', 'whitelist-migration');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE "AuditEventType" AS ENUM (
        'login-success',
        'login-failure',
        'logout',
        'logout-all-devices',
        'password-reset-requested',
        'password-reset-sent',
        'password-reset-failed',
        'session-expired',
        'session-revoked',
        'session-blocked'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE "AuditProvider" AS ENUM ('google', 'password', 'system');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE "UserSessionStatus" AS ENUM ('active', 'revoked', 'blocked', 'expired');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "user_access" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "mobile_phone" TEXT,
    "avatar_url" TEXT,
    "google_sub" TEXT,
    "roles" "UserRole"[] NOT NULL DEFAULT ARRAY['user']::"UserRole"[],
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
    "source" "UserProvisionSource" NOT NULL DEFAULT 'manual',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_access_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "user_session" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "auth_provider" "AuditProvider" NOT NULL,
    "session_secret_hash" TEXT NOT NULL,
    "status" "UserSessionStatus" NOT NULL DEFAULT 'active',
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

    CONSTRAINT "user_session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "access_audit" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "actor_user_id" TEXT,
    "session_id" TEXT,
    "username" TEXT,
    "email" TEXT,
    "provider" "AuditProvider" NOT NULL,
    "event_type" "AuditEventType" NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "session_device_label" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_audit_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
    IF to_regclass('public.admin_user_access') IS NOT NULL THEN
        INSERT INTO "user_access" (
            "id",
            "username",
            "email",
            "name",
            "mobile_phone",
            "avatar_url",
            "google_sub",
            "roles",
            "is_active",
            "allow_google_login",
            "allow_password_login",
            "password_hash",
            "password_updated_at",
            "temporary_password_hash",
            "temporary_password_expires_at",
            "temporary_password_sent_at",
            "last_login_at",
            "last_google_login_at",
            "last_password_login_at",
            "source",
            "created_at",
            "updated_at"
        )
        SELECT
            source."id",
            source."username",
            source."email",
            source."name",
            source."mobile_phone",
            source."avatar_url",
            source."google_sub",
            ARRAY(
                SELECT role_value::text::"UserRole"
                FROM unnest(source."roles") AS role_value
            ),
            source."is_active",
            source."allow_google_login",
            source."allow_password_login",
            source."password_hash",
            source."password_updated_at",
            source."temporary_password_hash",
            source."temporary_password_expires_at",
            source."temporary_password_sent_at",
            source."last_login_at",
            source."last_google_login_at",
            source."last_password_login_at",
            source."source"::text::"UserProvisionSource",
            source."created_at",
            source."updated_at"
        FROM "admin_user_access" AS source
        ON CONFLICT ("id") DO NOTHING;
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('public.admin_user_session') IS NOT NULL THEN
        INSERT INTO "user_session" (
            "id",
            "user_id",
            "auth_provider",
            "session_secret_hash",
            "status",
            "device_label",
            "ip_address",
            "user_agent",
            "last_activity_at",
            "idle_expires_at",
            "absolute_expires_at",
            "revoked_at",
            "revoked_reason",
            "revoked_by_user_id",
            "created_at",
            "updated_at"
        )
        SELECT
            source."id",
            source."user_id",
            source."auth_provider"::text::"AuditProvider",
            source."session_secret_hash",
            source."status"::text::"UserSessionStatus",
            source."device_label",
            source."ip_address",
            source."user_agent",
            source."last_activity_at",
            source."idle_expires_at",
            source."absolute_expires_at",
            source."revoked_at",
            source."revoked_reason",
            source."revoked_by_user_id",
            source."created_at",
            source."updated_at"
        FROM "admin_user_session" AS source
        ON CONFLICT ("id") DO NOTHING;
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('public.admin_access_audit') IS NOT NULL THEN
        INSERT INTO "access_audit" (
            "id",
            "user_id",
            "actor_user_id",
            "session_id",
            "username",
            "email",
            "provider",
            "event_type",
            "success",
            "session_device_label",
            "ip_address",
            "user_agent",
            "details",
            "created_at"
        )
        SELECT
            source."id",
            source."user_id",
            source."actor_user_id",
            source."session_id",
            source."username",
            source."email",
            source."provider"::text::"AuditProvider",
            source."event_type"::text::"AuditEventType",
            source."success",
            source."session_device_label",
            source."ip_address",
            source."user_agent",
            source."details",
            source."created_at"
        FROM "admin_access_audit" AS source
        ON CONFLICT ("id") DO NOTHING;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "user_access_username_key" ON "user_access"("username");
CREATE UNIQUE INDEX IF NOT EXISTS "user_access_email_key" ON "user_access"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "user_access_google_sub_key" ON "user_access"("google_sub");
CREATE INDEX IF NOT EXISTS "user_access_is_active_idx" ON "user_access"("is_active");
CREATE INDEX IF NOT EXISTS "user_access_allow_google_login_idx" ON "user_access"("allow_google_login");
CREATE INDEX IF NOT EXISTS "user_access_allow_password_login_idx" ON "user_access"("allow_password_login");

CREATE INDEX IF NOT EXISTS "user_session_user_id_status_idx" ON "user_session"("user_id", "status");
CREATE INDEX IF NOT EXISTS "user_session_status_idle_expires_at_idx" ON "user_session"("status", "idle_expires_at");
CREATE INDEX IF NOT EXISTS "user_session_absolute_expires_at_idx" ON "user_session"("absolute_expires_at");

CREATE INDEX IF NOT EXISTS "access_audit_user_id_created_at_idx" ON "access_audit"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "access_audit_actor_user_id_created_at_idx" ON "access_audit"("actor_user_id", "created_at");
CREATE INDEX IF NOT EXISTS "access_audit_session_id_created_at_idx" ON "access_audit"("session_id", "created_at");
CREATE INDEX IF NOT EXISTS "access_audit_event_type_created_at_idx" ON "access_audit"("event_type", "created_at");

DO $$
BEGIN
    ALTER TABLE "user_session"
    ADD CONSTRAINT "user_session_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "user_access"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "user_session"
    ADD CONSTRAINT "user_session_revoked_by_user_id_fkey"
    FOREIGN KEY ("revoked_by_user_id") REFERENCES "user_access"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "access_audit"
    ADD CONSTRAINT "access_audit_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "user_access"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "access_audit"
    ADD CONSTRAINT "access_audit_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "user_access"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "access_audit"
    ADD CONSTRAINT "access_audit_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "user_session"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DROP TABLE IF EXISTS "admin_access_audit";
DROP TABLE IF EXISTS "admin_user_session";
DROP TABLE IF EXISTS "admin_user_access";

DROP TYPE IF EXISTS "AccessAuditEventType";
DROP TYPE IF EXISTS "AccessAuditProvider";
DROP TYPE IF EXISTS "AdminUserSessionStatus";
DROP TYPE IF EXISTS "AdminUserProvisionSource";
DROP TYPE IF EXISTS "AdminUserAccessSource";
DROP TYPE IF EXISTS "AdminUserRole";
