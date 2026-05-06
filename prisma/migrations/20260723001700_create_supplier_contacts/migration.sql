CREATE TABLE "supplier_contacts" (
  "id" TEXT NOT NULL,
  "supplier_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone_number" TEXT,
  "email" TEXT,
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "supplier_contacts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "supplier_contacts_supplier_id_idx" ON "supplier_contacts"("supplier_id");
CREATE INDEX "supplier_contacts_supplier_id_primary_idx" ON "supplier_contacts"("supplier_id", "is_primary");

ALTER TABLE "supplier_contacts"
ADD CONSTRAINT "supplier_contacts_supplier_id_fkey"
FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "supplier_contacts" (
  "id",
  "supplier_id",
  "name",
  "phone_number",
  "email",
  "is_primary",
  "created_at",
  "updated_at"
)
SELECT
  "id" || '-primary-contact',
  "id",
  "contact_name",
  "phone_number",
  "email",
  true,
  "created_at",
  "updated_at"
FROM "suppliers"
WHERE
  "contact_name" IS NOT NULL
  OR "phone_number" IS NOT NULL
  OR "email" IS NOT NULL;
