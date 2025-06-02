import { Category, Prisma } from "@prisma/client";
import { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Await, defer, useActionData, useLoaderData } from "@remix-run/react";
import { Suspense } from "react";
import Loading from "~/components/loading/loading";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { toast } from "~/components/ui/use-toast";
import { authenticator } from "~/domain/auth/google.server";
import { LoggedUser } from "~/domain/auth/types.server";
import MenuItemForm from "~/domain/cardapio/components/menu-item-form/menu-item-form";
import { MenuItemWithAssociations, menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { categoryPrismaEntity } from "~/domain/category/category.entity.server";
import prismaClient from "~/lib/prisma/client.server";
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

export async function loader({ request, params }: LoaderFunctionArgs) {
    const itemId = params.id;

    if (!itemId) {
        return badRequest("Nenhum item encontrado");
    }

    let loggedUser: Promise<LoggedUser> = authenticator.isAuthenticated(request);

    const itemQryResult = prismaIt(menuItemPrismaEntity.findById(itemId));
    const categoriesQryResult = prismaIt(categoryPrismaEntity.findAll());
    const groupsQryResult = prismaIt(prismaClient.menuItemGroup.findMany({
        where: {
            deletedAt: null
        }
    }))

    const data = Promise.all([
        itemQryResult,
        categoriesQryResult,
        groupsQryResult,
        loggedUser
    ]);

    return defer({ data })
}

export async function action({ request }: LoaderFunctionArgs) {

    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);


    if (_action === "menu-item-update") {

        const category: Category = jsonParse(values.category as string)
        const group = jsonParse(values.group as string)

        if (group && !group.id) {
            return badRequest("Grupo não encontrado")
        }

        if (!category || !category.id) {
            return badRequest("Categoria não encontrada")
        }



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
            MenuItemGroup: {
                connect: {
                    id: group?.id || ""
                }
            },
        }

        const [err, result] = await prismaIt(menuItemPrismaEntity.update(values.id as string, menuItem))

        if (err) {
            return badRequest(err)
        }

        return ok("Elemento atualizado com successo")
    }

    if (_action === "menu-item-soft-delete") {

        const id = values?.id as string
        const loggedUser = jsonParse(values?.loggedUser as string)?.email || ""

        const [errItem, item] = await prismaIt(menuItemPrismaEntity.findById(id));

        if (errItem) {
            return badRequest(errItem)
        }

        if (!item) {
            return badRequest("Item não encontrado")
        }

        const [err, result] = await prismaIt(menuItemPrismaEntity.softDelete(id, loggedUser))


        if (err) {
            return badRequest(err)
        }

        const returnedMessage = !item.active === false ? `Sabor "${item.name}" excluido` : `Algo deu errado ao excluir o sabor "${item.name}"`;

        return ok(returnedMessage);
    }


    return null
}



export default function SingleMenuItemMain() {
    const {
        data,
    } = useLoaderData<typeof loader>();


    const actionData = useActionData<typeof action>();

    if (actionData && actionData.status > 399) {
        toast({
            title: "Erro",
            description: actionData.message,
            variant: "destructive",
        });
    }

    if (actionData && actionData.status === 200) {
        toast({
            title: "Ok",
            description: actionData.message,
        });
    }


    return (

        <div className="min-h-[200px]">
            <Suspense fallback={<Loading />}>
                <Await resolve={data}>
                    {
                        ([itemQryResult, categoriesQryResult, groupsQryResult, loggedUser]) => {

                            const err = itemQryResult[0] || categoriesQryResult[0] || groupsQryResult[0];

                            if (err) {
                                return (
                                    <Alert variant={"destructive"} >
                                        <AlertTitle>Erro</AlertTitle>
                                        <AlertDescription>{err?.name}</AlertDescription>
                                    </Alert>
                                )
                            }


                            return (

                                <MenuItemForm
                                    action="menu-item-update" item={itemQryResult[1]}
                                    categories={categoriesQryResult[1]}
                                    groups={groupsQryResult[1]}
                                    loggedUser={loggedUser}
                                />
                            )
                        }
                    }

                </Await>
            </Suspense>
        </div>
    )



}


