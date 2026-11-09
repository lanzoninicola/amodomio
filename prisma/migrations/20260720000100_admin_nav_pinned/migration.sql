-- Add pinning to admin navigation links
ALTER TABLE "admin_navigation_clicks"
ADD COLUMN "pinned" BOOLEAN NOT NULL DEFAULT false;
