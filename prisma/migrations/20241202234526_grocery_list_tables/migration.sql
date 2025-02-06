-- CreateTable
CREATE TABLE "grocery_list" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grocery_list_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grocery_list_items" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grocery_list_id" TEXT NOT NULL,

    CONSTRAINT "grocery_list_items_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "grocery_list_items" ADD CONSTRAINT "grocery_list_items_grocery_list_id_fkey" FOREIGN KEY ("grocery_list_id") REFERENCES "grocery_list"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
