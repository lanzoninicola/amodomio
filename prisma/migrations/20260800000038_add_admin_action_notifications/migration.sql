CREATE TABLE "admin_action_notifications" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "entity_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "href" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_action_notifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "admin_action_notification_targets" (
    "id" TEXT NOT NULL,
    "notification_id" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_action_notification_targets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_action_notifications_key_key"
ON "admin_action_notifications"("key");

CREATE INDEX "admin_action_notifications_status_updated_idx"
ON "admin_action_notifications"("status", "updated_at");

CREATE INDEX "admin_action_notifications_type_entity_idx"
ON "admin_action_notifications"("type", "entity_id");

CREATE UNIQUE INDEX "admin_action_notification_targets_unique"
ON "admin_action_notification_targets"("notification_id", "target_type", "target_id");

CREATE INDEX "admin_action_notification_targets_lookup_idx"
ON "admin_action_notification_targets"("target_type", "target_id", "resolved_at");

ALTER TABLE "admin_action_notification_targets"
ADD CONSTRAINT "admin_action_notification_targets_notification_id_fkey"
FOREIGN KEY ("notification_id") REFERENCES "admin_action_notifications"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
