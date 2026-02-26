import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

function parseArgs(argv) {
  const args = { name: '', env: 'development', dryRun: false, all: false };
  for (let i = 2; i < argv.length; i += 1) {
    const token = String(argv[i] || '');
    if (!token) continue;
    if (token === '--all') {
      args.all = true;
      continue;
    }
    if (token === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (token.startsWith('--env=')) {
      args.env = token.slice('--env='.length) || args.env;
      continue;
    }
    if (!args.name) args.name = token;
  }
  return args;
}

function uppercaseFirstLetter(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.charAt(0).toLocaleUpperCase('pt-BR') + text.slice(1);
}

function normalizeIngredientName(value) {
  return uppercaseFirstLetter(
    String(value || '')
      .trim()
      .replace(/^e\s+/i, '')
      .replace(/\.+$/, '')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function splitIngredients(ingredientsText) {
  return Array.from(
    new Set(
      String(ingredientsText || '')
        .split(/[;,]/g)
        .map(normalizeIngredientName)
        .filter(Boolean)
    )
  );
}

function normalizedCompareKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

async function ensureBaseVariation(db) {
  const existing = await db.variation.findFirst({
    where: { kind: 'base', code: 'base' },
  });

  if (existing && !existing.deletedAt) return existing;

  if (existing?.deletedAt) {
    return db.variation.update({
      where: { id: existing.id },
      data: { deletedAt: null, name: 'Base' },
    });
  }

  return db.variation.create({
    data: { kind: 'base', code: 'base', name: 'Base' },
  });
}

async function ensureBaseItemVariation(db, itemId, variationId) {
  const existing = await db.itemVariation.findFirst({
    where: { itemId, variationId },
  });

  if (!existing) {
    return db.itemVariation.create({ data: { itemId, variationId } });
  }

  if (existing.deletedAt) {
    return db.itemVariation.update({
      where: { id: existing.id },
      data: { deletedAt: null },
    });
  }

  return existing;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.all && !args.name) {
    throw new Error('Uso: node scripts/create-items-from-menu-item-ingredients.mjs "Margherita" [--env=development] [--dry-run] | --all');
  }

  const envName = args.env === 'production' ? 'production' : 'development';
  const datasourceUrl = envName === 'development' ? process.env.PRISMA_DB_DEV_URL : process.env.PRISMA_DB_URL;

  if (!datasourceUrl) {
    throw new Error(`URL do banco não encontrada para env=${envName}`);
  }

  const pool = new Pool({ connectionString: datasourceUrl });
  const adapter = new PrismaPg(pool);
  const db = new PrismaClient({ adapter });

  try {
    const menuItems = args.all
      ? await db.menuItem.findMany({
          where: {
            active: true,
            ingredients: { not: '' },
          },
          select: { id: true, name: true, ingredients: true },
          orderBy: [{ updatedAt: 'desc' }],
          take: 5000,
        })
      : await db.menuItem.findMany({
          where: { name: { equals: args.name, mode: 'insensitive' } },
          select: { id: true, name: true, ingredients: true },
          orderBy: [{ updatedAt: 'desc' }],
          take: 1,
        });

    if (!menuItems.length) {
      throw new Error(args.all ? 'Nenhum MenuItem encontrado para processamento' : `MenuItem não encontrado: ${args.name}`);
    }

    const baseVariation = args.dryRun ? null : await ensureBaseVariation(db);
    const existingItems = await db.item.findMany({
      select: { id: true, name: true, consumptionUm: true, classification: true, description: true },
      orderBy: { updatedAt: 'desc' },
      take: 20000,
    });

    const results = [];
    const menuItemSummaries = [];

    for (const menuItem of menuItems) {
      const ingredientNames = splitIngredients(menuItem.ingredients);
      if (ingredientNames.length === 0) {
        menuItemSummaries.push({
          menuItemId: menuItem.id,
          menuItemName: menuItem.name,
          totalIngredients: 0,
          created: 0,
          existing: 0,
          skipped: true,
        });
        continue;
      }

      let createdCount = 0;
      let existingCount = 0;

      for (const ingredientName of ingredientNames) {
        const key = normalizedCompareKey(ingredientName);
        const matched = existingItems.find((it) => normalizedCompareKey(it.name) === key) || null;

        if (matched) {
          let matchedUpdated = false;
          if (!args.dryRun && baseVariation) {
            await ensureBaseItemVariation(db, matched.id, baseVariation.id);
          }
          if (
            !args.dryRun &&
            matched.classification === 'insumo' &&
            String(matched.description || '').startsWith('Criado automaticamente a partir dos ingredientes do sabor') &&
            (matched.name !== ingredientName || !String(matched.consumptionUm || '').trim())
          ) {
            const updated = await db.item.update({
              where: { id: matched.id },
              data: {
                name: ingredientName,
                consumptionUm: String(matched.consumptionUm || '').trim() ? matched.consumptionUm : 'KG',
              },
              select: { id: true, name: true, consumptionUm: true, classification: true, description: true },
            });
            const idx = existingItems.findIndex((it) => it.id === matched.id);
            if (idx >= 0) existingItems[idx] = updated;
            matchedUpdated = true;
          }
          results.push({
            menuItemId: menuItem.id,
            menuItemName: menuItem.name,
            name: ingredientName,
            status: 'existing',
            itemId: matched.id,
            matchedName: matched.name,
            matchedUpdated,
          });
          existingCount += 1;
          continue;
        }

        if (args.dryRun) {
          results.push({
            menuItemId: menuItem.id,
            menuItemName: menuItem.name,
            name: ingredientName,
            status: 'would_create',
          });
          continue;
        }

        const created = await db.item.create({
          data: {
            name: ingredientName,
            description: `Criado automaticamente a partir dos ingredientes do sabor ${menuItem.name}`,
            classification: 'insumo',
            consumptionUm: 'KG',
            active: true,
            canPurchase: true,
            canTransform: false,
            canSell: false,
            canStock: true,
            canBeInMenu: false,
          },
          select: { id: true, name: true, consumptionUm: true },
        });

        if (baseVariation) {
          await ensureBaseItemVariation(db, created.id, baseVariation.id);
        }

        existingItems.unshift(created);

        results.push({
          menuItemId: menuItem.id,
          menuItemName: menuItem.name,
          name: ingredientName,
          status: 'created',
          itemId: created.id,
        });
        createdCount += 1;
      }

      menuItemSummaries.push({
        menuItemId: menuItem.id,
        menuItemName: menuItem.name,
        totalIngredients: ingredientNames.length,
        created: createdCount,
        existing: existingCount,
      });
    }

    console.log(JSON.stringify({
      ok: true,
      env: envName,
      mode: args.all ? 'all' : 'single',
      menuItem: args.all ? null : { id: menuItems[0].id, name: menuItems[0].name },
      ingredientsText: args.all ? null : menuItems[0].ingredients,
      parsedIngredients: args.all ? null : splitIngredients(menuItems[0].ingredients),
      dryRun: args.dryRun,
      summary: {
        totalMenuItems: menuItems.length,
        totalIngredients: results.length,
        created: results.filter((r) => r.status === 'created').length,
        existing: results.filter((r) => r.status === 'existing').length,
        wouldCreate: results.filter((r) => r.status === 'would_create').length,
      },
      menuItemSummaries,
      results,
    }, null, 2));
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
