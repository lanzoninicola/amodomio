-- AlterTable
ALTER TABLE "_CategorySubCategories" ADD CONSTRAINT "_CategorySubCategories_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_CategorySubCategories_AB_unique";

-- CreateTable
CREATE TABLE "menu_engineering_imports" (
    "id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "source" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "menu_engineering_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_engineering_import_items" (
    "id" TEXT NOT NULL,
    "import_id" TEXT NOT NULL,
    "topping" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "menu_engineering_import_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "menu_engineering_imports_month_year_key" ON "menu_engineering_imports"("month", "year");

-- CreateIndex
CREATE INDEX "menu_engineering_import_items_import_id_idx" ON "menu_engineering_import_items"("import_id");

-- AddForeignKey
ALTER TABLE "menu_engineering_import_items" ADD CONSTRAINT "menu_engineering_import_items_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "menu_engineering_imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
