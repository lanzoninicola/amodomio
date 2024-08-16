import { MenuItemWithAssociations } from "~/domain/cardapio/menu-item.prisma.entity.server";

export default function isItalyProduct(item: MenuItemWithAssociations) {
  const italyProduct = item.tags?.public.some(
    (t) => t.toLocaleLowerCase() === "produtos-italianos"
  );

  return italyProduct;
}
