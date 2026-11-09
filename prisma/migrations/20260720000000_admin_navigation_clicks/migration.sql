CREATE TABLE IF NOT EXISTS "admin_navigation_clicks" (
    "id" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "group_title" TEXT,
    "count" INTEGER NOT NULL DEFAULT 0,
    "last_clicked_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_navigation_clicks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "admin_navigation_clicks_href_key" ON "admin_navigation_clicks"("href");
