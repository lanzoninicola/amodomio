-- Seed default measurement units (idempotent)
INSERT INTO "measurement_units" ("id", "code", "name", "kind", "active")
VALUES
  (gen_random_uuid(), 'UN', 'Unidade',     'count',  true),
  (gen_random_uuid(), 'KG', 'Quilograma',  'weight', true),
  (gen_random_uuid(), 'G',  'Grama',       'weight', true),
  (gen_random_uuid(), 'L',  'Litro',       'volume', true),
  (gen_random_uuid(), 'ML', 'Mililitro',   'volume', true)
ON CONFLICT ("code") DO NOTHING;

-- Seed standard base conversions (idempotent)
-- Weight: KG <-> G
INSERT INTO "measurement_unit_conversions" ("id", "from_unit_id", "to_unit_id", "factor", "notes", "active")
SELECT gen_random_uuid(),
       (SELECT id FROM measurement_units WHERE code = 'KG'),
       (SELECT id FROM measurement_units WHERE code = 'G'),
       1000,
       '1 kg = 1000 g',
       true
WHERE EXISTS (SELECT 1 FROM measurement_units WHERE code = 'KG')
  AND EXISTS (SELECT 1 FROM measurement_units WHERE code = 'G')
ON CONFLICT ("from_unit_id", "to_unit_id") DO NOTHING;

INSERT INTO "measurement_unit_conversions" ("id", "from_unit_id", "to_unit_id", "factor", "notes", "active")
SELECT gen_random_uuid(),
       (SELECT id FROM measurement_units WHERE code = 'G'),
       (SELECT id FROM measurement_units WHERE code = 'KG'),
       0.001,
       '1 g = 0,001 kg',
       true
WHERE EXISTS (SELECT 1 FROM measurement_units WHERE code = 'G')
  AND EXISTS (SELECT 1 FROM measurement_units WHERE code = 'KG')
ON CONFLICT ("from_unit_id", "to_unit_id") DO NOTHING;

-- Volume: L <-> ML
INSERT INTO "measurement_unit_conversions" ("id", "from_unit_id", "to_unit_id", "factor", "notes", "active")
SELECT gen_random_uuid(),
       (SELECT id FROM measurement_units WHERE code = 'L'),
       (SELECT id FROM measurement_units WHERE code = 'ML'),
       1000,
       '1 L = 1000 mL',
       true
WHERE EXISTS (SELECT 1 FROM measurement_units WHERE code = 'L')
  AND EXISTS (SELECT 1 FROM measurement_units WHERE code = 'ML')
ON CONFLICT ("from_unit_id", "to_unit_id") DO NOTHING;

INSERT INTO "measurement_unit_conversions" ("id", "from_unit_id", "to_unit_id", "factor", "notes", "active")
SELECT gen_random_uuid(),
       (SELECT id FROM measurement_units WHERE code = 'ML'),
       (SELECT id FROM measurement_units WHERE code = 'L'),
       0.001,
       '1 mL = 0,001 L',
       true
WHERE EXISTS (SELECT 1 FROM measurement_units WHERE code = 'ML')
  AND EXISTS (SELECT 1 FROM measurement_units WHERE code = 'L')
ON CONFLICT ("from_unit_id", "to_unit_id") DO NOTHING;
