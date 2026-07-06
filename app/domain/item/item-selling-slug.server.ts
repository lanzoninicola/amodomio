import { slugifyString } from "~/utils/slugify";

export async function buildUniqueItemSellingSlug(
  db: any,
  value: string | null | undefined,
  options: { itemId?: string | null } = {}
) {
  const baseSlug = slugifyString(value) || "item";
  const existingRows = await db.itemSellingInfo.findMany({
    where: {
      slug: {
        startsWith: baseSlug,
      },
      ...(options.itemId ? { itemId: { not: options.itemId } } : {}),
    },
    select: {
      slug: true,
    },
  });
  const existingSlugs = new Set(
    existingRows.map((row: { slug: string | null }) => row.slug).filter(Boolean)
  );

  if (!existingSlugs.has(baseSlug)) {
    return baseSlug;
  }

  let suffix = 2;
  while (existingSlugs.has(`${baseSlug}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseSlug}-${suffix}`;
}
