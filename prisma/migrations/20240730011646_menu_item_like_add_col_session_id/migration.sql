-- AlterTable
ALTER TABLE "menu_item_likes" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "sessionId" TEXT;
