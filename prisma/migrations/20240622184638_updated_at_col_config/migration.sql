-- AlterTable
ALTER TABLE "categories" ALTER COLUMN "created_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ingredients" ALTER COLUMN "created_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "menu_item" ALTER COLUMN "created_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "menu_item_price" ALTER COLUMN "created_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "products" ALTER COLUMN "created_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "recipes" ALTER COLUMN "created_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "recipes_ingredients" ALTER COLUMN "created_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "recipes_variations" ALTER COLUMN "created_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "sub_categories" ALTER COLUMN "created_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;