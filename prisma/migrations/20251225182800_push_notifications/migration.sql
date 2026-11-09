-- CreateTable
CREATE TABLE "push_notification_campaigns" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "sendCount" INTEGER NOT NULL DEFAULT 0,
    "showCount" INTEGER NOT NULL DEFAULT 0,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "closeCount" INTEGER NOT NULL DEFAULT 0,
    "totalDwellMs" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_notification_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_notification_events" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "dwellMs" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_notification_events_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "push_notification_events" ADD CONSTRAINT "push_notification_events_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "push_notification_campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_notification_events" ADD CONSTRAINT "push_notification_events_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "push_subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
