import { Category, Prisma } from "@prisma/client";
import { LoaderFunctionArgs, redirect } from "@remix-run/node";
import { useActionData, useLoaderData } from "@remix-run/react";
import { toast } from "~/components/ui/use-toast";
import MenuItemForm from "~/domain/cardapio/components/menu-item-form/menu-item-form";
import { menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { categoryPrismaEntity } from "~/domain/category/category.entity.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";
import { jsonParse } from "~/utils/json-helper";


export async function loader({ params }: LoaderFunctionArgs) {
    const [err, categories] = await prismaIt(categoryPrismaEntity.findAll());

    if (err) {
        return serverError(err);
    }

    return ok({
        categories
    });
}


export async function action({ request }: LoaderFunctionArgs) {

    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    if (_action === "menu-item-create") {

        const category = jsonParse(values.category as string)

        if (!category?.id) {
            return badRequest("Categoria não seleçionada")
        }

        const nextMenuItem: Prisma.MenuItemCreateInput = {
            name: values.name as string,
            ingredients: values.ingredients as string,
            description: values?.description as string || "",
            visible: values?.visible === "on" ? true : false,
            upcoming: values?.upcoming === "on" ? true : false,
            basePriceAmount: values?.basePriceAmount ? parseFloat(values.basePriceAmount as string) : 0,
            mogoId: values?.mogoId as string || "",
            createdAt: new Date().toISOString(),
            Category: {
                connect: {
                    id: category.id
                }
            },
        }

        const [err, result] = await prismaIt(menuItemPrismaEntity.create(nextMenuItem))


        if (err) {
            return badRequest(err)
        }

        return ok(`Sabor "${result.name}" criado com sucesso!`)

    }


    // if (_action === "item-sortorder-up") {
    //     await menuEntity.sortUp(values.id as string, values.groupId as string)
    // }

    // if (_action === "item-sortorder-down") {
    //     await menuEntity.sortDown(values.id as string, values.groupId as string)
    // }


    return null
}

export default function NewCardapioItem() {
    const loaderData = useLoaderData<typeof loader>()
    const categories: Category[] = loaderData.payload?.categories

    const actionData = useActionData<typeof action>()
    if (actionData && actionData.status > 399) {
        toast({
            title: "Erro",
            description: actionData.message,
        })
    }

    if (actionData && actionData.status === 200) {
        toast({
            title: "Sucesso",
            description: actionData.message,
        })
    }

    return <MenuItemForm action="menu-item-create" className="my-8 border rounded-xl p-4" categories={categories} />
}