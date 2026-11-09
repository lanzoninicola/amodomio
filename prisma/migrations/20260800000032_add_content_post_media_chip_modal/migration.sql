ALTER TABLE "content_post_media" ADD COLUMN "chip_action" TEXT NOT NULL DEFAULT 'link';
ALTER TABLE "content_post_media" ADD COLUMN "chip_modal_title" TEXT;
ALTER TABLE "content_post_media" ADD COLUMN "chip_modal_body" TEXT;
