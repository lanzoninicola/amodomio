import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

let prisma: PrismaClient | null = null;
const sizeFactor = {
  "pizza-individual": 0.3,
  "pizza-small": 0.5,
  "pizza-medium": 1,
  "pizza-bigger": 2,
} as const;

type SizeCode = keyof typeof sizeFactor;

const SIZE_CODES: SizeCode[] = [
  "pizza-individual",
  "pizza-small",
  "pizza-medium",
  "pizza-bigger",
];

function normalizeName(str: string): string {
  return String(str ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function uniqStable(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of arr) {
    if (!v) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function hasAny(s: string, needles: string[]) {
  return needles.some(n => s.includes(n));
}

function estimateQtyMediumKg(normalized: string): number {
  const n = normalized.toLowerCase();
  // BASE FIXA
  if (
    n.includes("molho") ||
    n.includes("pomodoro") ||
    n.includes("tomate italiano")
  ) return 0.200;

  if (
    n.includes("mucarela") ||
    n.includes("mozzarella")
  ) return 0.150;

  // QUEIJOS SECUNDÁRIOS
  if (hasAny(n, ["gorgonzola", "provolone", "parmes", "grana", "pecorino", "ricota"])) {
    return 0.120;
  }

  // CARNES / EMBUTIDOS
  if (hasAny(n, ["salame", "presunto", "bacon", "mortadela", "pepperoni", "frango"])) {
    return 0.080;
  }

  // CREMES
  if (hasAny(n, ["pesto", "creme", "catupiry", "requeij", "pistache"])) {
    return 0.090;
  }

  // VEGETAIS
  if (hasAny(n, ["tomate", "cebola", "cogumelo", "piment", "berinj", "abobrinh", "milho"])) {
    return 0.070;
  }

  // FOLHAS
  if (hasAny(n, ["rucula", "manjeric", "salsinh"])) {
    return 0.010;
  }

  if (n.includes("noz")) return 0.025;
  if (n.includes("mel")) return 0.020;

  return 0.050;
}

function qtyForSizeKg(qtyMedium: number, sizeCode: SizeCode): number {
  return Number((qtyMedium * sizeFactor[sizeCode]).toFixed(3));
}

function parseArgs() {
  const args = process.argv.slice(2);
  const flags: { dryRun?: boolean; limit?: number; only?: string; env?: string } = {};

  for (const arg of args) {
    if (arg === "--dry-run") flags.dryRun = true;
    if (arg.startsWith("--limit=")) flags.limit = Number(arg.split("=")[1]);
    if (arg.startsWith("--only=")) flags.only = arg.split("=")[1];
    if (arg.startsWith("--env=")) flags.env = arg.split("=")[1];
  }

  return flags;
}

function ensureDataDir() {
  const dir = join(process.cwd(), "data");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function toCsvLine(values: (string | number)[]) {
  // CSV simples com escape de aspas e vírgulas
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return values.map(esc).join(",") + "\n";
}

async function main() {
  const { dryRun, limit, only, env } = parseArgs();
  const envName = env === "production" ? "production" : "development";
  const datasourceUrl =
    envName === "production" ? process.env.PRISMA_DB_URL : process.env.PRISMA_DB_DEV_URL;

  if (!datasourceUrl) {
    throw new Error(`URL do banco não encontrada para env=${envName}`);
  }

  const pool = new Pool({ connectionString: datasourceUrl });
  const adapter = new PrismaPg(pool);
  prisma = new PrismaClient({ adapter });

  console.log("Seed start:", {
    dryRun: !!dryRun,
    limit: limit ?? null,
    only: only ?? null,
    env: envName,
  });

  const category = await prisma.category.findFirst({
    where: { name: { equals: "Sabor Pizza", mode: "insensitive" } },
  });

  if (!category) throw new Error("Category 'Sabor Pizza' not found.");

  let items = await prisma.item.findMany({
    where: { categoryId: category.id },
    orderBy: { name: "asc" },
  });

  if (only) items = items.filter(i => i.id === only);
  if (limit) items = items.slice(0, limit);

  console.log(`Flavors found: ${items.length}`);

  const variations = await prisma.variation.findMany({
    where: { kind: "size", code: { in: SIZE_CODES } },
  });

  if (variations.length !== 4) {
    const found = variations.map(v => v.code).sort();
    throw new Error(`Missing size variations. Found: ${found.join(", ")}`);
  }

  const variationMap = Object.fromEntries(variations.map(v => [v.code, v]));

  // Relatórios de não resolvidos
  const unresolvedSummary = new Map<string, number>();
  const unresolvedByFlavor: Array<{
    flavor_item_id: string;
    flavor_name: string;
    ingredient_original: string;
    ingredient_normalized: string;
  }> = [];

  // Métricas
  let processed = 0;
  let skippedNoMenuItem = 0;
  let skippedNoResolvedIngredients = 0;
  let recipesCreated = 0;
  let recipesUpdated = 0;
  let linesCreated = 0;

  for (const flavorItem of items) {
    const menuItem = await prisma.menuItem.findFirst({
      where: { itemId: flavorItem.id },
      select: { id: true, ingredients: true },
    });

    if (!menuItem?.ingredients) {
      skippedNoMenuItem++;
      console.log(`SKIP (no MenuItem/ingredients): ${flavorItem.name} (${flavorItem.id})`);
      continue;
    }

    const rawTokens = menuItem.ingredients
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    const normalizedTokens = rawTokens.map(t => normalizeName(t));
    const normalizedUnique = uniqStable(normalizedTokens);

    // Resolver deterministicamente via ItemImportAlias
    const resolvedIngredients: Array<{ itemId: string; qtyMedium: number; sortKey: number }> = [];

    // Para reduzir roundtrips: buscar aliases em lote
    const aliases = await prisma.itemImportAlias.findMany({
      where: {
        active: true,
        aliasNormalized: { in: normalizedUnique },
      },
      select: { aliasNormalized: true, itemId: true },
    });

    const aliasMap = new Map<string, string>();
    for (const a of aliases) {
      // se houver duplicidade, mantém o primeiro (determinístico pela ordem retornada)
      if (!aliasMap.has(a.aliasNormalized)) aliasMap.set(a.aliasNormalized, a.itemId);
    }

    for (let i = 0; i < rawTokens.length; i++) {
      const original = rawTokens[i];
      const norm = normalizedTokens[i];
      if (!norm) continue;

      const ingredientItemId = aliasMap.get(norm);
      if (!ingredientItemId) {
        unresolvedSummary.set(norm, (unresolvedSummary.get(norm) ?? 0) + 1);
        unresolvedByFlavor.push({
          flavor_item_id: flavorItem.id,
          flavor_name: flavorItem.name,
          ingredient_original: original,
          ingredient_normalized: norm,
        });
        continue;
      }

      resolvedIngredients.push({
        itemId: ingredientItemId,
        qtyMedium: estimateQtyMediumKg(norm),
        sortKey: i,
      });
    }

    if (!resolvedIngredients.length) {
      skippedNoResolvedIngredients++;
      console.log(`SKIP (no resolved ingredients): ${flavorItem.name} (${flavorItem.id})`);
      continue;
    }

    processed++;

    if (dryRun) {
      console.log(`DRY RUN OK: ${flavorItem.name} -> ingredients resolved: ${resolvedIngredients.length}`);
      continue;
    }

    await prisma.$transaction(async tx => {
      for (const sizeCode of SIZE_CODES) {
        const variation = variationMap[sizeCode];

        const existing = await tx.recipe.findFirst({
          where: {
            itemId: flavorItem.id,
            variationId: variation.id,
            type: "pizzaTopping",
          },
          select: { id: true },
        });

        const name = `${flavorItem.name} (${variation.code})`;

        let recipeId: string;

        if (existing) {
          const updated = await tx.recipe.update({
            where: { id: existing.id },
            data: { name, hasVariations: true },
            select: { id: true },
          });
          recipeId = updated.id;
          recipesUpdated++;
        } else {
          const created = await tx.recipe.create({
            data: {
              name,
              itemId: flavorItem.id,
              variationId: variation.id,
              type: "pizzaTopping",
              hasVariations: true,
            },
            select: { id: true },
          });
          recipeId = created.id;
          recipesCreated++;
        }

        await tx.recipeLine.deleteMany({ where: { recipeId } });

        // Consolidar duplicados por itemId (somar qtyMedium) mantendo a ordem estável do primeiro aparecimento
        const firstIndex = new Map<string, number>();
        const sumQtyMedium = new Map<string, number>();

        for (const ing of resolvedIngredients) {
          if (!firstIndex.has(ing.itemId)) firstIndex.set(ing.itemId, ing.sortKey);
          sumQtyMedium.set(ing.itemId, (sumQtyMedium.get(ing.itemId) ?? 0) + ing.qtyMedium);
        }

        const consolidated = Array.from(sumQtyMedium.entries())
          .map(([itemId, qtyMedium]) => ({
            itemId,
            qtyMedium,
            first: firstIndex.get(itemId) ?? 0,
          }))
          .sort((a, b) => a.first - b.first);

        const lines = consolidated.map((ing, idx) => ({
          recipeId,
          itemId: ing.itemId,
          unit: "kg",
          quantity: qtyForSizeKg(ing.qtyMedium, sizeCode),
          sortOrderIndex: idx,
        }));

        await tx.recipeLine.createMany({ data: lines });
        linesCreated += lines.length;
      }
    });
  }

  // CSV
  const dataDir = ensureDataDir();

  const summaryPath = join(dataDir, "unresolved_ingredients_summary.csv");
  const byFlavorPath = join(dataDir, "unresolved_ingredients_by_flavor.csv");

  let summaryCsv = "";
  summaryCsv += toCsvLine(["ingredient_normalized", "count"]);
  for (const [ingredient_normalized, count] of Array.from(unresolvedSummary.entries()).sort((a, b) => b[1] - a[1])) {
    summaryCsv += toCsvLine([ingredient_normalized, count]);
  }
  writeFileSync(summaryPath, summaryCsv, "utf8");

  let byFlavorCsv = "";
  byFlavorCsv += toCsvLine(["flavor_item_id", "flavor_name", "ingredient_original", "ingredient_normalized"]);
  for (const row of unresolvedByFlavor) {
    byFlavorCsv += toCsvLine([
      row.flavor_item_id,
      row.flavor_name,
      row.ingredient_original,
      row.ingredient_normalized,
    ]);
  }
  writeFileSync(byFlavorPath, byFlavorCsv, "utf8");

  console.log("Seed done.");
  console.log({
    flavorsFound: items.length,
    processed,
    skippedNoMenuItem,
    skippedNoResolvedIngredients,
    recipesCreated,
    recipesUpdated,
    linesCreated,
    unresolvedUnique: unresolvedSummary.size,
    unresolvedTotal: Array.from(unresolvedSummary.values()).reduce((a, b) => a + b, 0),
    csv: {
      summary: summaryPath,
      byFlavor: byFlavorPath,
    },
  });
}

main()
  .catch(e => {
    console.error("Fatal error:", e);
    process.exit(1);
  })
  .finally(async () => {
    if (prisma) await prisma.$disconnect();
  });
