import { MenuItem } from "@prisma/client";
import { LoaderFunctionArgs } from "@remix-run/node";
import { Await, defer, useActionData, useLoaderData } from "@remix-run/react";
import { Suspense } from "react";
import Loading from "~/components/loading/loading";
import { toast } from "~/components/ui/use-toast";
import MenuItemList from "~/domain/cardapio/components/menu-item-list/menu-item-list";
import { menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { badRequest, ok } from "~/utils/http-response.server";
import tryit from "~/utils/try-it";

export async function loader({ request }: LoaderFunctionArgs) {

    // https://github.com/remix-run/remix/discussions/6149

    // const categories = categoryPrismaEntity.findAll()
    const listFlat = menuItemPrismaEntity.findAll({
        option: {
            sorted: true,
            direction: "asc"
        }
    }, {
        imageTransform: true,
        imageScaleWidth: 64,
    })
    // const tags = menuItemTagPrismaEntity.findAll()
    // const sizeVariations = prismaClient.menuItemSize.findMany()

    // const data = Promise.all([categories, listFlat, tags, sizeVariations]);
    const data = Promise.all([listFlat]);

    return defer({ data });
}

export async function action({ request }: LoaderFunctionArgs) {

    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    // console.log({ action: _action, values })

    if (values?.action === "menu-item-move") {
        const items = JSON.parse(formData.get('items') as string);

        type MenuItemWithIndex = MenuItem & { index: number };
        const updateSortOrderIndexPromises = items.map((item: MenuItemWithIndex) => menuItemPrismaEntity.update(item.id, {
            sortOrderIndex: item.index
        }))

        const [err, result] = await tryit(Promise.all(updateSortOrderIndexPromises))

        if (err) {
            return badRequest(err)
        }

        return ok("Ordenamento atualizado");

    }

    if (_action === "menu-item-visibility-change") {
        const id = values?.id as string

        const [errItem, item] = await prismaIt(menuItemPrismaEntity.findById(id));

        if (errItem) {
            return badRequest(errItem)
        }

        if (!item) {
            return badRequest("Item não encontrado")
        }

        const [err, result] = await tryit(menuItemPrismaEntity.update(id, {
            visible: !item.visible
        }))

        if (err) {
            return badRequest(err)
        }

        const returnedMessage = !item.visible === true ? `Sabor "${item.name}" visivel no cardápio` : `Sabor "${item.name}" não visivel no cardápio`;

        return ok(returnedMessage);
    }

    return null
}

export default function AdminGerenciamentoCardapioMainListLayout() {

    const {
        data,
    } = useLoaderData<typeof loader>();

    const actionData = useActionData<typeof action>()

    if (actionData && actionData.status !== 200) {
        toast({
            title: "Erro",
            description: actionData.message,
        })
    }

    if (actionData && actionData.status === 200) {
        toast({
            title: "OK",
            description: actionData.message
        })
    }

    return (



        <Suspense fallback={
            <div className="flex justify-center items-center h-[150px]">
                <Loading color="black" />
            </div>
        }>
            <Await resolve={data}>
                {([listFlat]) => {



                    return (
                        // @ts-ignore
                        <MenuItemList initialItems={listFlat} />
                    )

                }}
            </Await>
        </Suspense>
    )
}