-- CreateTable
CREATE TABLE "menu_item_cost" (
    "id" TEXT NOT NULL,
    "menu_item_id" TEXT,
    "latest_cost" DOUBLE PRECISION NOT NULL,
    "average_cost" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "menu_item_cost_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "menu_item_cost" ADD CONSTRAINT "menu_item_cost_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_item_likes" ADD CONSTRAINT "menu_item_likes_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
