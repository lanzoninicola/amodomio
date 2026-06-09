/**
 * Backfill responsive image variants for existing item_gallery_images records.
 *
 * Usage:
 *   # dry-run (shows what would be changed, no writes)
 *   npx tsx scripts/backfill-image-variants.ts --dry-run
 *
 *   # process up to 20 records
 *   npx tsx scripts/backfill-image-variants.ts --dry-run --limit 20
 *
 *   # real run (explicit confirmation required)
 *   npx tsx scripts/backfill-image-variants.ts --run
 *
 *   # resume after failure (skips already-processed)
 *   npx tsx scripts/backfill-image-variants.ts --run --limit 50
 */

import { PrismaClient } from "@prisma/client";

const MEDIA_API_BASE_URL = (
  process.env.MEDIA_API_BASE_URL ?? "https://media-api.amodomio.com.br"
).replace(/\/+$/, "");
const MEDIA_UPLOAD_API_KEY = process.env.MEDIA_UPLOAD_API_KEY ?? "";
const MEDIA_BASE_URL = (
  process.env.MEDIA_BASE_URL ?? "https://media.amodomio.com.br"
).replace(/\/+$/, "");

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes("--dry-run"),
    run: args.includes("--run"),
    limit: (() => {
      const idx = args.indexOf("--limit");
      if (idx === -1) return 200;
      const val = Number(args[idx + 1]);
      return Number.isFinite(val) && val > 0 ? val : 200;
    })(),
  };
}

function deriveFolderAndKey(secureUrl: string): { folderPath: string; assetKey: string } | null {
  try {
    const urlPath = new URL(secureUrl).pathname;
    // Expected: /images/{folderPath...}/{assetKey}.{ext}
    const parts = urlPath.replace(/^\//, "").split("/");
    if (parts.length < 3 || parts[0] !== "images") return null;

    const fileWithExt = parts[parts.length - 1];
    const assetKey = fileWithExt.replace(/\.[^/.]+$/, "");
    if (!assetKey) return null;

    const folderPath = parts.slice(1, -1).join("/");
    if (!folderPath) return null;

    return { folderPath, assetKey };
  } catch {
    return null;
  }
}

async function processVariants(input: {
  folderPath: string;
  assetKey: string;
}): Promise<{
  ok: boolean;
  thumbnailUrl: string | null;
  variants: Record<string, string> | null;
  width: number | null;
  height: number | null;
  error?: string;
}> {
  const url = new URL(`${MEDIA_API_BASE_URL}/v2/process-variants`);
  url.searchParams.set("folderPath", input.folderPath);
  url.searchParams.set("assetKey", input.assetKey);

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: "POST",
      headers: { "x-api-key": MEDIA_UPLOAD_API_KEY },
    });
  } catch (err) {
    return { ok: false, thumbnailUrl: null, variants: null, width: null, height: null, error: String(err) };
  }

  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload?.ok) {
    return {
      ok: false,
      thumbnailUrl: null,
      variants: null,
      width: null,
      height: null,
      error: payload?.error ?? `http_${res.status}`,
    };
  }

  const variants =
    payload.variants && typeof payload.variants === "object" && !Array.isArray(payload.variants)
      ? (payload.variants as Record<string, string>)
      : null;

  return {
    ok: true,
    thumbnailUrl: typeof payload.thumbnail_url === "string" ? payload.thumbnail_url : null,
    variants,
    width: typeof payload.width === "number" ? payload.width : null,
    height: typeof payload.height === "number" ? payload.height : null,
  };
}

async function main() {
  const { dryRun, run, limit } = parseArgs();

  if (!dryRun && !run) {
    console.error("Provide --dry-run or --run.");
    process.exit(1);
  }

  if (run && !MEDIA_UPLOAD_API_KEY) {
    console.error("MEDIA_UPLOAD_API_KEY is required for --run.");
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    const rows = await (prisma as any).itemGalleryImage.findMany({
      where: {
        kind: "image",
        visible: true,
        secureUrl: { not: null },
        variantsJson: null,
      },
      select: {
        id: true,
        secureUrl: true,
        thumbnailUrl: true,
        width: true,
        height: true,
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    }) as Array<{
      id: string;
      secureUrl: string | null;
      thumbnailUrl: string | null;
      width: number | null;
      height: number | null;
    }>;

    const eligible = rows.filter((r) => {
      if (!r.secureUrl) return false;
      if (!r.secureUrl.startsWith(MEDIA_BASE_URL)) return false;
      return Boolean(deriveFolderAndKey(r.secureUrl));
    });

    console.log(`\nBackfill summary`);
    console.log(`  Total candidates (no variants_json): ${rows.length}`);
    console.log(`  Eligible (parseable media.amodomio URL): ${eligible.length}`);
    console.log(`  Limit: ${limit}`);
    console.log(`  Mode: ${dryRun ? "DRY-RUN" : "REAL RUN"}\n`);

    if (eligible.length === 0) {
      console.log("Nothing to process.");
      return;
    }

    const example = eligible[0];
    const exampleTarget = deriveFolderAndKey(example.secureUrl!)!;
    console.log(`Example record:`);
    console.log(`  id:         ${example.id}`);
    console.log(`  secureUrl:  ${example.secureUrl}`);
    console.log(`  folderPath: ${exampleTarget.folderPath}`);
    console.log(`  assetKey:   ${exampleTarget.assetKey}`);
    console.log(
      `  API call:   POST ${MEDIA_API_BASE_URL}/v2/process-variants?folderPath=${exampleTarget.folderPath}&assetKey=${exampleTarget.assetKey}`
    );

    if (dryRun) {
      console.log(`\nDry-run complete. Re-run with --run to apply changes.`);
      console.log(`  Command: npx tsx scripts/backfill-image-variants.ts --run --limit ${limit}`);
      return;
    }

    let succeeded = 0;
    let failed = 0;
    let skipped = 0;

    for (const row of eligible) {
      const target = deriveFolderAndKey(row.secureUrl!)!;
      process.stdout.write(`  [${succeeded + failed + skipped + 1}/${eligible.length}] ${row.id} ... `);

      const result = await processVariants(target);

      if (!result.ok) {
        console.log(`FAILED (${result.error})`);
        failed += 1;
        continue;
      }

      if (!result.variants) {
        console.log(`SKIPPED (no variants generated)`);
        skipped += 1;
        continue;
      }

      await (prisma as any).itemGalleryImage.update({
        where: { id: row.id },
        data: {
          variantsJson: result.variants,
          thumbnailUrl: result.thumbnailUrl ?? row.thumbnailUrl,
          width: result.width ?? row.width,
          height: result.height ?? row.height,
        },
      });

      console.log(`OK (${Object.keys(result.variants).join(",")}w)`);
      succeeded += 1;
    }

    console.log(`\nDone.`);
    console.log(`  Succeeded: ${succeeded}`);
    console.log(`  Failed:    ${failed}`);
    console.log(`  Skipped:   ${skipped}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
