CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

insert into categories (id, name, sort_order, type, created_at)
values (uuid_generate_v4(), 'Sabor Italiano', '1000', 'cardapio', CURRENT_DATE)

insert into menu_item_price_variations (id, label, amount, menu_item_id, created_at)
values(uuid_generate_v4(), 'media', '89.90', 'e6207bc4-c103-4f4a-95e7-db3eae1cf444', CURRENT_DATE)

insert into menu_item_price_variations (id, label, amount, menu_item_id, created_at)
values(uuid_generate_v4(), 'familia', '209.90', 'e6207bc4-c103-4f4a-95e7-db3eae1cf444', CURRENT_DATE)