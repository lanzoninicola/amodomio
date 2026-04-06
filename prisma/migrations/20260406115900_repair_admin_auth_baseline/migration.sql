DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_type t
        WHERE t.typname = 'AdminUserRole'
    ) AND EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'AdminUserRole'
        GROUP BY t.typname
        HAVING COUNT(*) FILTER (WHERE e.enumlabel = 'user') = 0
            OR COUNT(*) FILTER (WHERE e.enumlabel = 'super-admin') = 0
    ) THEN
        ALTER TYPE "AdminUserRole" RENAME TO "AdminUserRole_legacy";
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE "AdminUserRole" AS ENUM ('user', 'admin', 'super-admin');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE "AdminUserProvisionSource" AS ENUM ('manual', 'seed', 'whitelist-migration');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE "AccessAuditEventType" AS ENUM (
        'login-success',
        'login-failure',
        'logout',
        'password-reset-requested',
        'password-reset-sent',
        'password-reset-failed'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE "AccessAuditProvider" AS ENUM ('google', 'password', 'system');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "admin_user_access" (
    "id" TEXT NOT NULL,
    "username" TEXT,
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

ALTER TABLE "admin_user_access" ADD COLUMN IF NOT EXISTS "username" TEXT;
ALTER TABLE "admin_user_access" ADD COLUMN IF NOT EXISTS "mobile_phone" TEXT;
ALTER TABLE "admin_user_access" ADD COLUMN IF NOT EXISTS "roles" "AdminUserRole"[] DEFAULT ARRAY['user']::"AdminUserRole"[];
ALTER TABLE "admin_user_access" ADD COLUMN IF NOT EXISTS "allow_google_login" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "admin_user_access" ADD COLUMN IF NOT EXISTS "allow_password_login" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "admin_user_access" ADD COLUMN IF NOT EXISTS "password_hash" TEXT;
ALTER TABLE "admin_user_access" ADD COLUMN IF NOT EXISTS "password_updated_at" TIMESTAMP(3);
ALTER TABLE "admin_user_access" ADD COLUMN IF NOT EXISTS "temporary_password_hash" TEXT;
ALTER TABLE "admin_user_access" ADD COLUMN IF NOT EXISTS "temporary_password_expires_at" TIMESTAMP(3);
ALTER TABLE "admin_user_access" ADD COLUMN IF NOT EXISTS "temporary_password_sent_at" TIMESTAMP(3);
ALTER TABLE "admin_user_access" ADD COLUMN IF NOT EXISTS "last_google_login_at" TIMESTAMP(3);
ALTER TABLE "admin_user_access" ADD COLUMN IF NOT EXISTS "last_password_login_at" TIMESTAMP(3);
ALTER TABLE "admin_user_access" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "admin_user_access" ALTER COLUMN "name" DROP NOT NULL;
ALTER TABLE "admin_user_access" ALTER COLUMN "avatar_url" DROP NOT NULL;
ALTER TABLE "admin_user_access" ALTER COLUMN "google_sub" DROP NOT NULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'admin_user_access'
          AND column_name = 'source'
          AND udt_name = 'AdminUserAccessSource'
    ) THEN
        ALTER TABLE "admin_user_access"
        ALTER COLUMN "source" DROP DEFAULT;

        ALTER TABLE "admin_user_access"
        ALTER COLUMN "source" TYPE "AdminUserProvisionSource"
        USING "source"::text::"AdminUserProvisionSource";

        ALTER TABLE "admin_user_access"
        ALTER COLUMN "source" SET DEFAULT 'manual';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'admin_user_access'
          AND column_name = 'role'
    ) THEN
        UPDATE "admin_user_access"
        SET "roles" = ARRAY[
            CASE
                WHEN "role"::text = 'admin' THEN 'admin'::"AdminUserRole"
                WHEN "role"::text = 'super-admin' THEN 'super-admin'::"AdminUserRole"
                ELSE 'user'::"AdminUserRole"
            END
        ]
        WHERE "roles" IS NULL
           OR cardinality("roles") = 0;

        ALTER TABLE "admin_user_access" DROP COLUMN "role";
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_type
        WHERE typname = 'AdminUserRole_legacy'
    ) THEN
        DROP TYPE "AdminUserRole_legacy";
    END IF;
EXCEPTION
    WHEN dependent_objects_still_exist THEN NULL;
END $$;

UPDATE "admin_user_access"
SET "roles" = ARRAY['user']::"AdminUserRole"[]
WHERE "roles" IS NULL
   OR cardinality("roles") = 0;

UPDATE "admin_user_access"
SET "username" = lower(split_part(email, '@', 1))
WHERE "username" IS NULL
  AND email IS NOT NULL;

UPDATE "admin_user_access"
SET "username" = concat('user_', substr(id, 1, 8))
WHERE "username" IS NULL;

ALTER TABLE "admin_user_access"
ALTER COLUMN "username" SET NOT NULL;

ALTER TABLE "admin_user_access"
ALTER COLUMN "roles" SET NOT NULL;

ALTER TABLE "admin_user_access"
ALTER COLUMN "roles" SET DEFAULT ARRAY['user']::"AdminUserRole"[];

CREATE TABLE IF NOT EXISTS "admin_access_audit" (
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

CREATE UNIQUE INDEX IF NOT EXISTS "admin_user_access_username_key" ON "admin_user_access"("username");
CREATE UNIQUE INDEX IF NOT EXISTS "admin_user_access_email_key" ON "admin_user_access"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "admin_user_access_google_sub_key" ON "admin_user_access"("google_sub");
CREATE INDEX IF NOT EXISTS "admin_user_access_is_active_idx" ON "admin_user_access"("is_active");
CREATE INDEX IF NOT EXISTS "admin_user_access_allow_google_login_idx" ON "admin_user_access"("allow_google_login");
CREATE INDEX IF NOT EXISTS "admin_user_access_allow_password_login_idx" ON "admin_user_access"("allow_password_login");
CREATE INDEX IF NOT EXISTS "admin_access_audit_user_id_created_at_idx" ON "admin_access_audit"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "admin_access_audit_event_type_created_at_idx" ON "admin_access_audit"("event_type", "created_at");

DO $$
BEGIN
    ALTER TABLE "admin_access_audit"
    ADD CONSTRAINT "admin_access_audit_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "admin_user_access"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

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
    ('6b7b5029-090a-4937-9664-d9cf0d188003', 'dioni.m', 'Dioni', ARRAY['admin']::"AdminUserRole"[], true, false, false, 'seed')
ON CONFLICT ("username") DO NOTHING;
