ALTER TABLE "cardapio_facebook_pixel_configs"
ADD COLUMN "name" TEXT,
ADD COLUMN "route_path" TEXT;

UPDATE "cardapio_facebook_pixel_configs"
SET
  "name" = COALESCE(NULLIF(TRIM("scope"), ''), 'Cardápio'),
  "route_path" = CASE
    WHEN "scope" = 'cardapio' THEN '/cardapio'
    ELSE CONCAT('/', TRIM(BOTH '/' FROM "scope"))
  END;

ALTER TABLE "cardapio_facebook_pixel_configs"
ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "route_path" SET NOT NULL;

DROP INDEX IF EXISTS "cardapio_facebook_pixel_configs_scope_key";
CREATE UNIQUE INDEX "cardapio_facebook_pixel_configs_route_path_key" ON "cardapio_facebook_pixel_configs"("route_path");

ALTER TABLE "cardapio_facebook_pixel_configs"
DROP COLUMN "scope";
