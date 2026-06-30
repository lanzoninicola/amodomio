ALTER TABLE "content_post_media" ADD COLUMN "link_position" TEXT;
ALTER TABLE "content_post_media" ADD COLUMN "link_new_tab" BOOLEAN NOT NULL DEFAULT true;
