import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// ---------------------------------------------------------------------------
// Usage
//   node scripts/create-recipes-from-menu-items.mjs "Margherita"
//   node scripts/create-recipes-from-menu-items.mjs --all
//   node scripts/create-recipes-from-menu-items.mjs --all --dry-run
//   node scripts/create-recipes-from-menu-items.mjs --all --env=production
//   node scripts/create-recipes-from-menu-items.mjs --all --variation-kind=size
//   node scripts/create-recipes-from-menu-items.mjs --all --variation-kind=size --reset-recipes
//   node scripts/create-recipes-from-menu-items.mjs --all --variation-kind=size --migrate-and-clean-legacy
//   node scripts/create-recipes-from-menu-items.mjs --all --variation-kind=size --one-recipe-per-item
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Quantity map for pizza-medium (40x20cm oval) — in KG.
// Reference: molho de tomate = 0.200 KG, muçarela = 0.150 KG.
// Other quantities are culinary estimates based on typical Italian pizza.
// Ingredients NOT in this map will be created with quantity = 0 (manual fill).
// ---------------------------------------------------------------------------
const MEDIUM_QTY_KG = {
  // Sauces / Bases
  'molho de tomate': 0.200,
  'molho de tomate italiano': 0.200,
  'reducao de molho de tomate italiano': 0.100,
  'molho pesto': 0.080,
  'molho pesto caseiro': 0.080,
  'creme de leite': 0.100,
  'requeijao': 0.100,
  'requeijao cremoso': 0.100,
  'creme de ricota': 0.100,
  'creme de ricotta': 0.100,
  'creme de pistache': 0.080,
  'creme de leite e nozes': 0.080,

  // Oils
  'azeite ao manjericao': 0.020,
  'azeite de oliva aromatizado com manjericao': 0.020,
  'oleo de oliva com manjericao': 0.020,
  'creme balsamico': 0.020,
  'mel': 0.020,

  // Cheeses — primary
  'mucarela': 0.150,
  'mucarela de bufala': 0.150,
  'burrata de bufala': 0.120,
  'burrata de fufala': 0.120,
  'bacon e burrata de bufala': 0.120,

  // Cheeses — secondary / accent
  'parmesao': 0.050,
  'parmesao ralado': 0.050,
  'queijo parmesao': 0.050,
  'queijo vaccino romano': 0.050,
  'parmesao e mel': 0.050,
  'gorgonzola': 0.080,
  'gorgonzola nozes': 0.080,
  'provolone defumado': 0.080,
  'queijo provolone defumado': 0.080,
  'queijo colonial': 0.080,
  'queijo defumado': 0.080,
  'brie': 0.080,
  'cream cheese': 0.080,
  'creem cheese': 0.080,
  'ricota': 0.100,

  // Meats
  'calabresa': 0.100,
  'linguica calabresa': 0.100,
  'linguica': 0.100,
  'bacon defumado': 0.080,
  'bacon defumado fatiado': 0.080,
  'bacon em cubos': 0.080,
  'pepperoni picante': 0.060,
  'saleme pepperoni picante': 0.060,
  'salame italiano': 0.060,
  'lombo canadense fatiado': 0.080,
  'presunto cozido': 0.080,
  'presunto cozido italiano (importado)': 0.080,
  'presunto cru': 0.060,
  'presunto cru italiano (importado)': 0.060,
  'peito de frango desfiado': 0.100,
  'peito de peru defumado': 0.080,
  'mortadela defumada': 0.080,

  // Fish / Seafood
  'atum solido': 0.080,

  // Vegetables
  'tomate ao forno': 0.060,
  'tomate confit': 0.060,
  'tomate picado': 0.060,
  'tomate seco': 0.040,
  'tomatinhos': 0.060,
  'tomatihos confit': 0.060,
  'cogumelos': 0.060,
  'cogumelos frescos': 0.060,
  'cogumelos refogados': 0.060,
  'cogumelos salteados': 0.060,
  'milho': 0.050,
  'milho verde': 0.050,
  'cebola caramelizada': 0.040,
  'cebola refogada': 0.040,
  'cebola roxa': 0.040,
  'alcachofra': 0.060,
  'abobrinha': 0.060,
  'abobrinha ao forno': 0.060,
  'abobrinha assada': 0.060,
  'abobrinha em fatias': 0.060,
  'abobrinha ralada': 0.060,
  'abobora': 0.060,
  'batata ao forno com alecrim': 0.080,
  'batata frita': 0.080,
  'figo': 0.060,
  'alho poro': 0.040,
  'alho-poro': 0.040,
  'azeitona preta': 0.030,
  'azeitonas preta': 0.030,
  'azeitona verde': 0.030,
  'geleia apimentada': 0.050,
  'geleia de abacaxi': 0.050,
  'geleia de damasco': 0.050,
  'geleia de damasco apimentado': 0.050,
  'geleia de figo': 0.050,
  'geleia de goiabada': 0.050,
  'geleia de pimenta': 0.050,

  // Fresh herbs / garnish (very light)
  'rucula': 0.015,
  'manjericao': 0.010,
  'manjericao fresco': 0.010,
  'cheiro-verde': 0.010,
  'oregano': 0.005,
  'noz moscada': 0.003,
  'noz-moscada': 0.003,

  // Nuts / seeds (accent)
  'nozes': 0.030,
  'pistache': 0.030,
  'amendoas laminadas': 0.030,
  'amendoin': 0.030,
  'coco flocos': 0.030,

  // Eggs
  'ovo': 0.060,
  'ovos cozido': 0.120,

  // Sweets / chocolate (dessert pizzas)
  'chocolate branco': 0.080,
  'chocolate preto': 0.080,
  'nutella': 0.080,

  // Other
  'palmito': 0.060,
  'requeijao cremoso': 0.100,
  'requeijao': 0.100,
  'reiqueijao': 0.100,
  'amendoim': 0.030,
};

// ---------------------------------------------------------------------------
// Size conversion factors relative to pizza-medium = 1.0
// Source: MenuItemCostVariationUtility in the codebase.
// ---------------------------------------------------------------------------
const SIZE_FACTORS = {
  'pizza-individual': 0.5,
  'pizza-small': 0.75,
  'pizza-medium': 1.0,
  'pizza-big': 1.25,
  'pizza-bigger': 2.0,
  'pizza-slice': 0.25,
};

function normalizedKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function getMediumQuantity(ingredientName) {
  const key = normalizedKey(ingredientName);
  return MEDIUM_QTY_KG[key] ?? null;
}

function getSizeFactor(variationCode) {
  return SIZE_FACTORS[variationCode] ?? 1.0;
}

// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    name: '',
    env: 'development',
    dryRun: false,
    all: false,
    variationKind: null,
    resetRecipes: false,
    migrateAndCleanLegacy: false,
    oneRecipePerItem: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const token = String(argv[i] || '');
    if (!token) continue;
    if (token === '--all') { args.all = true; continue; }
    if (token === '--dry-run') { args.dryRun = true; continue; }
    if (token === '--reset-recipes') { args.resetRecipes = true; continue; }
    if (token === '--migrate-and-clean-legacy') { args.migrateAndCleanLegacy = true; continue; }
    if (token === '--one-recipe-per-item') { args.oneRecipePerItem = true; continue; }
    if (token.startsWith('--env=')) { args.env = token.slice('--env='.length) || args.env; continue; }
    if (token.startsWith('--variation-kind=')) { args.variationKind = token.slice('--variation-kind='.length) || null; continue; }
    if (!args.name) args.name = token;
  }
  return args;
}

function supportsNewRecipeCompositionModel(db) {
  return typeof db?.recipeIngredient?.findMany === 'function'
    && typeof db?.recipeVariationIngredient?.findMany === 'function'
    && typeof db?.itemVariation?.findFirst === 'function';
}

async function ensureOwnerItemVariationForRecipe(db, { itemId, variationId, recipeId, dryRun }) {
  if (!itemId || !variationId || !recipeId) return null;
  let owner = await db.itemVariation.findFirst({
    where: { itemId, variationId, deletedAt: null },
    select: { id: true, recipeId: true },
    orderBy: [{ createdAt: 'asc' }],
  });

  if (!owner) {
    if (dryRun) return null;
    owner = await db.itemVariation.create({
      data: {
        itemId,
        variationId,
        recipeId,
      },
      select: { id: true, recipeId: true },
    });
    return owner.id;
  }

  if (!dryRun && !owner.recipeId) {
    await db.itemVariation.update({
      where: { id: owner.id },
      data: { recipeId },
    });
  }
  return owner.id;
}

async function ensureVariationLinksForRecipe(db, { itemId, recipeId, variations, dryRun }) {
  const links = new Map();
  for (const variation of variations || []) {
    const id = await ensureOwnerItemVariationForRecipe(db, {
      itemId,
      variationId: variation.id,
      recipeId,
      dryRun,
    });
    if (id) links.set(variation.id, id);
  }
  return links;
}

async function upsertNewCompositionLine(db, params) {
  const {
    recipeId,
    itemId,
    sortOrderIndex,
    unit,
    quantity,
    ownerItemVariationId,
    snapshot,
  } = params;

  let recipeIngredient = await db.recipeIngredient.findUnique({
    where: {
      recipeId_ingredientItemId: {
        recipeId,
        ingredientItemId: itemId,
      },
    },
    select: { id: true },
  });

  if (!recipeIngredient) {
    recipeIngredient = await db.recipeIngredient.create({
      data: {
        recipeId,
        ingredientItemId: itemId,
        sortOrderIndex,
      },
      select: { id: true },
    });
  }

  await db.recipeVariationIngredient.upsert({
    where: {
      recipeIngredientId_itemVariationId: {
        recipeIngredientId: recipeIngredient.id,
        itemVariationId: ownerItemVariationId,
      },
    },
    update: {
      unit,
      quantity,
      lossPct: null,
      lastUnitCostAmount: snapshot.lastUnitCostAmount,
      avgUnitCostAmount: snapshot.avgUnitCostAmount,
      lastTotalCostAmount: snapshot.lastTotalCostAmount,
      avgTotalCostAmount: snapshot.avgTotalCostAmount,
    },
    create: {
      recipeIngredientId: recipeIngredient.id,
      itemVariationId: ownerItemVariationId,
      unit,
      quantity,
      lossPct: null,
      lastUnitCostAmount: snapshot.lastUnitCostAmount,
      avgUnitCostAmount: snapshot.avgUnitCostAmount,
      lastTotalCostAmount: snapshot.lastTotalCostAmount,
      avgTotalCostAmount: snapshot.avgTotalCostAmount,
    },
  });
}

async function migrateAndCleanLegacyRecipeLines(db, { recipeId, ownerItemVariationId, dryRun }) {
  if (!supportsNewRecipeCompositionModel(db)) {
    return { migratedLines: 0, cleanedLegacyLines: 0, skipped: true };
  }
  if (!ownerItemVariationId) {
    return { migratedLines: 0, cleanedLegacyLines: 0, skipped: true };
  }
  if (typeof db?.recipeLine?.findMany !== 'function') {
    return { migratedLines: 0, cleanedLegacyLines: 0, skipped: true };
  }

  let legacyLines = [];
  try {
    legacyLines = await db.recipeLine.findMany({
      where: { recipeId },
      orderBy: [{ sortOrderIndex: 'asc' }, { createdAt: 'asc' }],
      select: {
        itemId: true,
        itemVariationId: true,
        unit: true,
        quantity: true,
        lastUnitCostAmount: true,
        avgUnitCostAmount: true,
        lastTotalCostAmount: true,
        avgTotalCostAmount: true,
        sortOrderIndex: true,
      },
    });
  } catch (error) {
    // Prisma P2021 = table does not exist (legacy table already dropped)
    if (error?.code === 'P2021') {
      return { migratedLines: 0, cleanedLegacyLines: 0, skipped: true };
    }
    throw error;
  }

  if (dryRun) {
    return { migratedLines: legacyLines.length, cleanedLegacyLines: legacyLines.length, skipped: false };
  }

  for (const line of legacyLines) {
    await upsertNewCompositionLine(db, {
      recipeId,
      itemId: line.itemId,
      sortOrderIndex: Number(line.sortOrderIndex || 0),
      unit: String(line.unit || 'UN'),
      quantity: Number(line.quantity || 0),
      ownerItemVariationId: String(line.itemVariationId || ownerItemVariationId),
      snapshot: {
        lastUnitCostAmount: Number(line.lastUnitCostAmount || 0),
        avgUnitCostAmount: Number(line.avgUnitCostAmount || 0),
        lastTotalCostAmount: Number(line.lastTotalCostAmount || 0),
        avgTotalCostAmount: Number(line.avgTotalCostAmount || 0),
      },
    });
  }

  let deleted = { count: 0 };
  try {
    deleted = await db.recipeLine.deleteMany({ where: { recipeId } });
  } catch (error) {
    if (error?.code === 'P2021') {
      return { migratedLines: legacyLines.length, cleanedLegacyLines: 0, skipped: true };
    }
    throw error;
  }
  return {
    migratedLines: legacyLines.length,
    cleanedLegacyLines: Number(deleted?.count || 0),
    skipped: false,
  };
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

async function findOrCreateIngredientItem(db, ingredientName, existingItems, dryRun, menuItemName) {
  const key = normalizedKey(ingredientName);
  const matched = existingItems.find((it) => normalizedKey(it.name) === key) || null;

  if (matched) {
    return { item: matched, status: 'existing' };
  }

  if (dryRun) {
    return { item: null, status: 'would_create' };
  }

  const created = await db.item.create({
    data: {
      name: ingredientName,
      description: `Criado automaticamente a partir dos ingredientes do sabor ${menuItemName}`,
      classification: 'insumo',
      consumptionUm: 'KG',
      active: true,
      canPurchase: true,
      canTransform: false,
      canSell: false,
      canStock: true,
    },
    select: { id: true, name: true, consumptionUm: true, classification: true, description: true },
  });

  existingItems.unshift(created);
  return { item: created, status: 'created' };
}

async function main() {
  const args = parseArgs(process.argv);

  if (!args.all && !args.name) {
    throw new Error(
      'Uso:\n' +
      '  node scripts/create-recipes-from-menu-items.mjs "Nome do Sabor" [--env=development] [--dry-run] [--variation-kind=size] [--reset-recipes] [--migrate-and-clean-legacy] [--one-recipe-per-item]\n' +
      '  node scripts/create-recipes-from-menu-items.mjs --all [--env=development] [--dry-run] [--variation-kind=size] [--reset-recipes] [--migrate-and-clean-legacy] [--one-recipe-per-item]'
    );
  }

  const envName = args.env === 'production' ? 'production' : 'development';
  const datasourceUrl = envName === 'development' ? process.env.PRISMA_DB_DEV_URL : process.env.PRISMA_DB_URL;

  if (!datasourceUrl) {
    throw new Error(`URL do banco não encontrada para env=${envName}. Verifique PRISMA_DB_DEV_URL ou PRISMA_DB_URL no .env`);
  }

  const pool = new Pool({ connectionString: datasourceUrl });
  const adapter = new PrismaPg(pool);
  const db = new PrismaClient({ adapter });

  try {
    let recipesDeleted = 0;
    let recipesDeletePreview = 0;
    let migratedLegacyLines = 0;
    let cleanedLegacyLines = 0;
    let duplicateRecipesDeleted = 0;

    if (args.resetRecipes) {
      if (args.dryRun) {
        recipesDeletePreview = await db.recipe.count();
      } else {
        const result = await db.recipe.deleteMany({});
        recipesDeleted = Number(result?.count || 0);
      }
    }

    // 1. Fetch MenuItems
    const menuItems = args.all
      ? await db.menuItem.findMany({
          where: {
            active: true,
            deletedAt: null,
            itemId: { not: null },
            ingredients: { not: '' },
          },
          select: { id: true, name: true, ingredients: true, itemId: true },
          orderBy: [{ updatedAt: 'desc' }],
          take: 5000,
        })
      : await db.menuItem.findMany({
          where: {
            name: { equals: args.name, mode: 'insensitive' },
            deletedAt: null,
            itemId: { not: null },
          },
          select: { id: true, name: true, ingredients: true, itemId: true },
          orderBy: [{ updatedAt: 'desc' }],
          take: 1,
        });

    if (!menuItems.length) {
      throw new Error(
        args.all
          ? 'Nenhum MenuItem ativo com itemId e ingredients encontrado'
          : `MenuItem não encontrado ou sem itemId: "${args.name}"`
      );
    }

    // 2. Fetch Variations (tamanhos)
    const variationWhere = {
      deletedAt: null,
      ...(args.variationKind ? { kind: args.variationKind } : {}),
    };

    const variations = await db.variation.findMany({
      where: variationWhere,
      select: { id: true, kind: true, code: true, name: true },
      orderBy: [{ kind: 'asc' }, { name: 'asc' }],
    });

    if (!variations.length) {
      throw new Error(
        args.variationKind
          ? `Nenhuma Variation encontrada com kind="${args.variationKind}"`
          : 'Nenhuma Variation encontrada no banco de dados'
      );
    }

    // 3. Fetch all existing Items for ingredient matching
    const existingItems = await db.item.findMany({
      select: { id: true, name: true, consumptionUm: true, classification: true, description: true },
      orderBy: { updatedAt: 'desc' },
      take: 20000,
    });

    // 4. Process each MenuItem × Variation
    const menuItemSummaries = [];
    const recipeResults = [];
    const ingredientResults = [];
    const unmappedIngredients = new Set();

    for (const menuItem of menuItems) {
      const ingredientNames = splitIngredients(menuItem.ingredients);

      if (ingredientNames.length === 0) {
        menuItemSummaries.push({
          menuItemName: menuItem.name,
          itemId: menuItem.itemId,
          skipped: true,
          reason: 'sem ingredientes após parse',
        });
        continue;
      }

      // Pre-compute medium quantities per ingredient name
      const mediumQtyMap = {};
      for (const name of ingredientNames) {
        const qty = getMediumQuantity(name);
        mediumQtyMap[name] = qty;
        if (qty === null) unmappedIngredients.add(name);
      }

      let recipesCreated = 0;
      let recipesSkipped = 0;

      if (args.oneRecipePerItem) {
        const existingRecipesForItem = await db.recipe.findMany({
          where: {
            itemId: menuItem.itemId,
            type: 'pizzaTopping',
          },
          select: { id: true, name: true, updatedAt: true, createdAt: true },
          orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
          take: 20,
        });

        const existingRecipe = existingRecipesForItem[0] || null;
        const recipeName = menuItem.name;
        const newModelAvailable = supportsNewRecipeCompositionModel(db);

        if (existingRecipe) {
          const variationLinks = newModelAvailable
            ? await ensureVariationLinksForRecipe(db, {
              itemId: menuItem.itemId,
              recipeId: existingRecipe.id,
              variations,
              dryRun: args.dryRun,
            })
            : new Map();

          if (args.migrateAndCleanLegacy) {
            const firstVariation = variations[0] || null;
            const fallbackItemVariationId = firstVariation
              ? variationLinks.get(firstVariation.id) || null
              : null;
            const migration = await migrateAndCleanLegacyRecipeLines(db, {
              recipeId: existingRecipe.id,
              ownerItemVariationId: fallbackItemVariationId,
              dryRun: args.dryRun,
            });
            migratedLegacyLines += Number(migration.migratedLines || 0);
            cleanedLegacyLines += Number(migration.cleanedLegacyLines || 0);

            for (const duplicate of existingRecipesForItem.slice(1)) {
              const duplicateMigration = await migrateAndCleanLegacyRecipeLines(db, {
                recipeId: duplicate.id,
                ownerItemVariationId: fallbackItemVariationId,
                dryRun: args.dryRun,
              });
              migratedLegacyLines += Number(duplicateMigration.migratedLines || 0);
              cleanedLegacyLines += Number(duplicateMigration.cleanedLegacyLines || 0);

              if (!args.dryRun) {
                await db.recipe.delete({ where: { id: duplicate.id } });
                duplicateRecipesDeleted += 1;
              } else {
                duplicateRecipesDeleted += 1;
              }
            }
          }

          recipeResults.push({
            menuItemName: menuItem.name,
            variationName: '(all sizes)',
            status: 'existing',
            recipeId: existingRecipe.id,
            recipeName: existingRecipe.name,
            duplicateRecipesForItem: Math.max(0, existingRecipesForItem.length - 1),
          });
          recipesSkipped += 1;
        } else if (args.dryRun) {
          recipeResults.push({
            menuItemName: menuItem.name,
            variationName: '(all sizes)',
            status: 'would_create',
            recipeName,
            lines: ingredientNames.flatMap((name) => variations.map((variation) => {
              const medQty = mediumQtyMap[name];
              const sizeFactor = getSizeFactor(variation.code);
              return {
                variationName: variation.name,
                variationCode: variation.code,
                ingredientName: name,
                mediumQty: medQty ?? 0,
                finalQty: medQty !== null ? parseFloat((medQty * sizeFactor).toFixed(4)) : 0,
                quantitySource: medQty !== null ? 'estimated' : 'unmapped (qty=0)',
              };
            })),
          });
          recipesCreated += 1;
        } else {
          const recipe = await db.recipe.create({
            data: {
              name: recipeName,
              type: 'pizzaTopping',
              itemId: menuItem.itemId,
              variationId: null,
              hasVariations: true,
              isVegetarian: false,
              isGlutenFree: false,
            },
            select: { id: true, name: true },
          });

          const variationLinks = newModelAvailable
            ? await ensureVariationLinksForRecipe(db, {
              itemId: menuItem.itemId,
              recipeId: recipe.id,
              variations,
              dryRun: args.dryRun,
            })
            : new Map();

          const recipeLinesSummary = [];
          for (let idx = 0; idx < ingredientNames.length; idx++) {
            const ingredientName = ingredientNames[idx];
            const { item, status } = await findOrCreateIngredientItem(
              db, ingredientName, existingItems, false, menuItem.name
            );

            for (const variation of variations) {
              const medQty = mediumQtyMap[ingredientName];
              const finalQty = medQty !== null
                ? parseFloat((medQty * getSizeFactor(variation.code)).toFixed(4))
                : 0;

              ingredientResults.push({
                menuItemName: menuItem.name,
                variationName: variation.name,
                ingredientName,
                status,
                itemId: item?.id ?? null,
                mediumQty: medQty ?? 0,
                finalQty,
              });

              const linkedVariationId = variationLinks.get(variation.id);
              if (newModelAvailable && linkedVariationId) {
                await upsertNewCompositionLine(db, {
                  recipeId: recipe.id,
                  itemId: item.id,
                  sortOrderIndex: idx,
                  unit: item.consumptionUm || 'KG',
                  quantity: finalQty,
                  ownerItemVariationId: linkedVariationId,
                  snapshot: {
                    lastUnitCostAmount: 0,
                    avgUnitCostAmount: 0,
                    lastTotalCostAmount: 0,
                    avgTotalCostAmount: 0,
                  },
                });
              } else if (variation === variations[0]) {
                await db.recipeLine.create({
                  data: {
                    recipeId: recipe.id,
                    itemId: item.id,
                    unit: item.consumptionUm || 'KG',
                    quantity: finalQty,
                    lastUnitCostAmount: 0,
                    avgUnitCostAmount: 0,
                    lastTotalCostAmount: 0,
                    avgTotalCostAmount: 0,
                    sortOrderIndex: idx,
                  },
                });
              }

              recipeLinesSummary.push({
                variationName: variation.name,
                variationCode: variation.code,
                ingredientName,
                status,
                mediumQty: medQty ?? 0,
                finalQty,
                quantitySource: medQty !== null ? 'estimated' : 'unmapped (qty=0)',
              });
            }
          }

          recipeResults.push({
            menuItemName: menuItem.name,
            variationName: '(all sizes)',
            status: 'created',
            recipeId: recipe.id,
            recipeName: recipe.name,
            lines: recipeLinesSummary,
          });
          recipesCreated += 1;

          if (args.migrateAndCleanLegacy) {
            const firstVariation = variations[0] || null;
            const fallbackItemVariationId = firstVariation
              ? variationLinks.get(firstVariation.id) || null
              : null;
            const migration = await migrateAndCleanLegacyRecipeLines(db, {
              recipeId: recipe.id,
              ownerItemVariationId: fallbackItemVariationId,
              dryRun: args.dryRun,
            });
            migratedLegacyLines += Number(migration.migratedLines || 0);
            cleanedLegacyLines += Number(migration.cleanedLegacyLines || 0);
          }
        }

        menuItemSummaries.push({
          menuItemName: menuItem.name,
          itemId: menuItem.itemId,
          totalIngredients: ingredientNames.length,
          unmappedIngredients: ingredientNames.filter((n) => mediumQtyMap[n] === null),
          totalVariations: variations.length,
          recipesCreated,
          recipesSkipped,
        });
        continue;
      }

      for (const variation of variations) {
        // Check if recipe already exists for this itemId + variationId
        const existingRecipe = await db.recipe.findFirst({
          where: {
            itemId: menuItem.itemId,
            variationId: variation.id,
            type: 'pizzaTopping',
          },
          select: { id: true, name: true },
        });

        if (existingRecipe) {
          if (args.migrateAndCleanLegacy) {
            const ownerItemVariationId = await ensureOwnerItemVariationForRecipe(db, {
              itemId: menuItem.itemId,
              variationId: variation.id,
              recipeId: existingRecipe.id,
              dryRun: args.dryRun,
            });
            const migration = await migrateAndCleanLegacyRecipeLines(db, {
              recipeId: existingRecipe.id,
              ownerItemVariationId,
              dryRun: args.dryRun,
            });
            migratedLegacyLines += Number(migration.migratedLines || 0);
            cleanedLegacyLines += Number(migration.cleanedLegacyLines || 0);
          }

          recipeResults.push({
            menuItemName: menuItem.name,
            variationName: variation.name,
            status: 'existing',
            recipeId: existingRecipe.id,
            recipeName: existingRecipe.name,
          });
          recipesSkipped += 1;
          continue;
        }

        const sizeFactor = getSizeFactor(variation.code);
        const recipeName = `${menuItem.name} - ${variation.name}`;

        if (args.dryRun) {
          recipeResults.push({
            menuItemName: menuItem.name,
            variationName: variation.name,
            variationCode: variation.code,
            sizeFactor,
            status: 'would_create',
            recipeName,
            lines: ingredientNames.map((name) => {
              const medQty = mediumQtyMap[name];
              return {
                ingredientName: name,
                mediumQty: medQty ?? 0,
                finalQty: medQty !== null ? parseFloat((medQty * sizeFactor).toFixed(4)) : 0,
                quantitySource: medQty !== null ? 'estimated' : 'unmapped (qty=0)',
              };
            }),
          });
          recipesCreated += 1;
          continue;
        }

        // Create the Recipe
        const recipe = await db.recipe.create({
          data: {
            name: recipeName,
            type: 'pizzaTopping',
            itemId: menuItem.itemId,
            variationId: variation.id,
            hasVariations: false,
            isVegetarian: false,
            isGlutenFree: false,
          },
          select: { id: true, name: true },
        });

        const newModelAvailable = supportsNewRecipeCompositionModel(db);
        const ownerItemVariationId = newModelAvailable
          ? await ensureOwnerItemVariationForRecipe(db, {
            itemId: menuItem.itemId,
            variationId: variation.id,
            recipeId: recipe.id,
            dryRun: args.dryRun,
          })
          : null;

        // Create composition lines
        const recipeLinesSummary = [];
        for (let idx = 0; idx < ingredientNames.length; idx++) {
          const ingredientName = ingredientNames[idx];
          const { item, status } = await findOrCreateIngredientItem(
            db, ingredientName, existingItems, false, menuItem.name
          );

          const medQty = mediumQtyMap[ingredientName];
          const finalQty = medQty !== null ? parseFloat((medQty * sizeFactor).toFixed(4)) : 0;

          ingredientResults.push({
            menuItemName: menuItem.name,
            variationName: variation.name,
            ingredientName,
            status,
            itemId: item?.id ?? null,
            mediumQty: medQty ?? 0,
            finalQty,
          });

          if (newModelAvailable && ownerItemVariationId) {
            await upsertNewCompositionLine(db, {
              recipeId: recipe.id,
              itemId: item.id,
              sortOrderIndex: idx,
              unit: item.consumptionUm || 'KG',
              quantity: finalQty,
              ownerItemVariationId,
              snapshot: {
                lastUnitCostAmount: 0,
                avgUnitCostAmount: 0,
                lastTotalCostAmount: 0,
                avgTotalCostAmount: 0,
              },
            });
          } else {
            await db.recipeLine.create({
              data: {
                recipeId: recipe.id,
                itemId: item.id,
                unit: item.consumptionUm || 'KG',
                quantity: finalQty,
                lastUnitCostAmount: 0,
                avgUnitCostAmount: 0,
                lastTotalCostAmount: 0,
                avgTotalCostAmount: 0,
                sortOrderIndex: idx,
              },
            });
          }

          recipeLinesSummary.push({
            ingredientName,
            status,
            mediumQty: medQty ?? 0,
            finalQty,
            quantitySource: medQty !== null ? 'estimated' : 'unmapped (qty=0)',
          });
        }

        recipeResults.push({
          menuItemName: menuItem.name,
          variationName: variation.name,
          variationCode: variation.code,
          sizeFactor,
          status: 'created',
          recipeId: recipe.id,
          recipeName: recipe.name,
          lines: recipeLinesSummary,
        });
        recipesCreated += 1;

        if (args.migrateAndCleanLegacy) {
          const migration = await migrateAndCleanLegacyRecipeLines(db, {
            recipeId: recipe.id,
            ownerItemVariationId,
            dryRun: args.dryRun,
          });
          migratedLegacyLines += Number(migration.migratedLines || 0);
          cleanedLegacyLines += Number(migration.cleanedLegacyLines || 0);
        }
      }

      menuItemSummaries.push({
        menuItemName: menuItem.name,
        itemId: menuItem.itemId,
        totalIngredients: ingredientNames.length,
        unmappedIngredients: ingredientNames.filter((n) => mediumQtyMap[n] === null),
        totalVariations: variations.length,
        recipesCreated,
        recipesSkipped,
      });
    }

    const summary = {
      ok: true,
      env: envName,
      dryRun: args.dryRun,
      mode: args.all ? 'all' : 'single',
      resetRecipes: args.resetRecipes,
      migrateAndCleanLegacy: args.migrateAndCleanLegacy,
      oneRecipePerItem: args.oneRecipePerItem,
      recipesDeleted: args.dryRun ? undefined : recipesDeleted,
      recipesDeletePreview: args.dryRun ? recipesDeletePreview : undefined,
      migratedLegacyLines,
      cleanedLegacyLines,
      duplicateRecipesDeleted,
      variationKindFilter: args.variationKind ?? '(sem filtro - todas as variations)',
      totalMenuItems: menuItems.length,
      totalVariations: variations.length,
      variations: variations.map((v) => ({
        id: v.id,
        kind: v.kind,
        code: v.code,
        name: v.name,
        sizeFactor: getSizeFactor(v.code),
      })),
      recipesCreated: recipeResults.filter((r) => r.status === 'created' || r.status === 'would_create').length,
      recipesSkipped: recipeResults.filter((r) => r.status === 'existing').length,
      ingredientsCreated: ingredientResults.filter((r) => r.status === 'created').length,
      ingredientsExisting: ingredientResults.filter((r) => r.status === 'existing').length,
      // Ingredients without a quantity estimate — need manual review
      unmappedIngredients: Array.from(unmappedIngredients).sort(),
      menuItemSummaries,
      // In dry-run mode, expose recipe details for verification
      recipeResults: args.dryRun ? recipeResults : undefined,
    };

    console.log(JSON.stringify(summary, null, 2));

    // In dry-run mode, also write a TSV report for easy spreadsheet review
    if (args.dryRun) {
      const { writeFileSync } = await import('fs');
      const reportPath = '/tmp/recipes-dry-run-report.tsv';
      const rows = ['Sabor\tTamanho\tFator\tIngrediente\tQty (KG)\tFonte'];
      for (const r of recipeResults) {
        if (!r.lines) continue;
        for (const line of r.lines) {
          const lineVariationName = line.variationName || r.variationName || '';
          const lineSizeFactor = line.variationCode
            ? getSizeFactor(line.variationCode)
            : (typeof r.sizeFactor === 'number' ? r.sizeFactor : 1);
          rows.push([
            r.menuItemName,
            lineVariationName,
            lineSizeFactor,
            line.ingredientName,
            line.finalQty.toFixed(4),
            line.quantitySource,
          ].join('\t'));
        }
      }
      writeFileSync(reportPath, rows.join('\n'), 'utf8');
      console.error(`\n[INFO] Relatório TSV salvo em: ${reportPath}`);
      console.error('[INFO] Abra com qualquer editor de planilha (LibreOffice, Google Sheets) para verificar.');
    }
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
