import { LoaderArgs } from "@remix-run/node";
import { useLoaderData, useOutletContext } from "@remix-run/react";
import MenuItemForm from "~/domain/cardapio/components/menu-item-form/menu-item-form";
import { menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { categoryPrismaEntity } from "~/domain/category/category.entity.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";


export async function loader({ params }: LoaderArgs) {
    const itemId = params.id;

    if (!itemId) {
        return badRequest("Nenhum item encontrado");
    }

    const [errItem, item] = await prismaIt(menuItemPrismaEntity.findById(itemId));
    const [errCat, categories] = await prismaIt(categoryPrismaEntity.findAll());

    const err = errItem || errCat

    if (err) {
        return serverError(err);
    }

    return ok({
        item,
        categories
    });
}


export default function SingleMenuItemMain() {
    const loaderData = useLoaderData<typeof loader>()
    const item = loaderData.payload?.item
    const categories = loaderData.payload?.categories || []

    return (
        <MenuItemForm action="menu-item-update" item={item} categories={categories} />
    )
}