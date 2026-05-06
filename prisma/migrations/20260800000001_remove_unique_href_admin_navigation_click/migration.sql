-- AlterTable: revert unique constraint on href
ALTER TABLE "admin_navigation_clicks" DROP CONSTRAINT IF EXISTS "admin_navigation_clicks_href_key";
