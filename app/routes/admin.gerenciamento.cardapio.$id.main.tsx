import { Category, Prisma } from "@prisma/client";
import { LoaderFunctionArgs, MetaFunction, redirect } from "@remix-run/node";
import { Await, defer, useLoaderData } from "@remix-run/react";
import { Suspense } from "react";
import Loading from "~/components/loading/loading";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import MenuItemForm from "~/domain/cardapio/components/menu-item-form/menu-item-form";
import { MenuItemWithAssociations, menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { categoryPrismaEntity } from "~/domain/category/category.entity.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { badRequest, ok } from "~/utils/http-response.server";
import { jsonParse } from "~/utils/json-helper";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
    // @ts-ignore
    const item: MenuItemWithAssociations = data?.payload?.item

    return [
        { title: item?.name || "Nome não encontrado" },
    ];
};

export async function loader({ params }: LoaderFunctionArgs) {
    const itemId = params.id;

    if (!itemId) {
        return badRequest("Nenhum item encontrado");
    }

    const itemQryResult = prismaIt(menuItemPrismaEntity.findById(itemId));
    const categoriesQryResult = prismaIt(categoryPrismaEntity.findAll());


    const data = Promise.all([
        itemQryResult,
        categoriesQryResult
    ]);

    return defer({ data })
}

export async function action({ request }: LoaderFunctionArgs) {

    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);
    // console.log({ action: _action, values })

    if (_action === "menu-item-update") {

        const category: Category = jsonParse(values.category as string)
        const imageInfo: MenuItemWithAssociations["MenuItemImage"] = jsonParse(values.imageInfo as string)


        let menuItem: Prisma.MenuItemCreateInput = {
            name: values.name as string,
            ingredients: values.ingredients as string,
            description: values?.description as string || "",
            visible: values?.visible === "on" ? true : false,
            basePriceAmount: values?.basePriceAmount ? parseFloat(values.basePriceAmount as string) : 0,
            mogoId: values?.mogoId as string || "",
            createdAt: new Date().toISOString(),
            notesPublic: values?.notesPublic as string || "",
            Category: {
                connect: {
                    id: category.id
                }
            },


        }

        if (!imageInfo?.id) {
            menuItem = {
                ...menuItem,
                MenuItemImage: {
                    create: {
                        ...imageInfo
                    }
                }
            }
        }

        if (imageInfo?.id) {
            menuItem = {
                ...menuItem,
                MenuItemImage: {
                    connect: {
                        id: imageInfo?.id
                    }
                }
            }
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
    const {
        data,
    } = useLoaderData<typeof loader>();



    return (

        <div className="min-h-[200px]">
            <Suspense fallback={<Loading />}>
                <Await resolve={data}>
                    {
                        ([itemQryResult, categoriesQryResult]) => {

                            const err = itemQryResult[0] || categoriesQryResult[0]
                            if (err) {
                                return (
                                    <Alert variant={"destructive"} >
                                        <AlertTitle>Erro</AlertTitle>
                                        <AlertDescription>{err?.name}</AlertDescription>
                                    </Alert>
                                )
                            }


                            return (
                                <MenuItemForm action="menu-item-update" item={itemQryResult[1]} categories={categoriesQryResult[1]} />
                            )
                        }
                    }

                </Await>
            </Suspense>
        </div>
    )



}


