# Prisma setup notes

This folder uses Prisma config-based datasource settings (Prisma v7+), so the
schema does not contain a datasource URL.

## Key files
- `schema.prisma`: schema only, no datasource `url`.
- `prisma.config.ts`: config for migrations and datasource URL selection.
- `shadow-init.sql`: SQL executed to prepare the shadow database when running
  `prisma migrate dev`.

## Env vars
- `PRISMA_DB_URL`: production / default database URL.
- `PRISMA_DB_DEV_URL`: development database URL.
- `SHADOW_DATABASE_URL`: shadow database URL.

## Migrations
If you see errors about missing datasource URLs, make sure you are using Prisma
CLI v7+ and that your Node version is 20.19+ / 22.12+ / 24+.

If Prisma reports a shadow DB error involving `menu_item_interest_events`, the
shadow DB is initialized via `shadow-init.sql` to allow older migrations to run
in the correct order without resetting the main database.
