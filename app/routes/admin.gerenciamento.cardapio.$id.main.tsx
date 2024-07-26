import { Category, Prisma } from "@prisma/client";
import { LoaderArgs, redirect } from "@remix-run/node";
import { useLoaderData, useOutletContext } from "@remix-run/react";
import MenuItemForm from "~/domain/cardapio/components/menu-item-form/menu-item-form";
import { menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { categoryPrismaEntity } from "~/domain/category/category.entity.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { getBase64 } from "~/utils/get-base-64";
import { badRequest, ok, serverError } from "~/utils/http-response.server";
import { jsonParse } from "~/utils/json-helper";
import tryit from "~/utils/try-it";


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

export async function action({ request }: LoaderArgs) {

    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    // console.log({ action: _action, values })


    if (_action === "menu-item-update") {

        const category: Category = jsonParse(values.category as string)

        const imageFileName = values?.imageFileName as string
        const imageBase64 = values?.imageBase64 as string

        const menuItem: Prisma.MenuItemCreateInput = {
            name: values.name as string,
            ingredients: values.ingredients as string,
            description: values?.description as string || "",
            visible: values?.visible === "on" ? true : false,
            imageFileName: imageFileName,
            imageBase64: imageBase64,
            basePriceAmount: values?.basePriceAmount ? parseFloat(values.basePriceAmount as string) : 0,
            mogoId: values?.mogoId as string || "",
            createdAt: new Date().toISOString(),
            Category: {
                connect: {
                    id: category.id
                }
            },
        }

        const [err, result] = await prismaIt(menuItemPrismaEntity.update(values.id as string, menuItem))

        if (err) {
            return badRequest(err)
        }

        return ok("Elemento atualizado com successo")
    }

    if (_action === "menu-item-delete") {
        const id = values?.id as string

        const [err, result] = await prismaIt(menuItemPrismaEntity.delete(id))

        if (err) {
            return badRequest(err)
        }

        return redirect("/admin/gerenciamento/cardapio")
    }



    return null
}



export default function SingleMenuItemMain() {
    const loaderData = useLoaderData<typeof loader>()
    const item = loaderData.payload?.item
    const categories = loaderData.payload?.categories || []

    return (
        <MenuItemForm action="menu-item-update" item={item} categories={categories} />
    )
}


