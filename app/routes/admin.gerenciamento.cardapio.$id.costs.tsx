import { MenuItemPriceVariation, MenuItemSizeVariation } from "@prisma/client";
import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, MetaFunction, useLoaderData } from "@remix-run/react";
import { Input } from "~/components/ui/input";
import { authenticator } from "~/domain/auth/google.server";
import MenuItemSizeVariationsSelector from "~/domain/cardapio/components/menu-item-size-variation-selector/menu-item-size-variations-selector";
import { MenuItemWithAssociations, menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import prismaClient from "~/lib/prisma/client.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";
import { jsonParse } from "~/utils/json-helper";
import parserFormDataEntryToNumber from "~/utils/parse-form-data-entry-to-number";
import tryit from "~/utils/try-it";
import { urlAt } from "~/utils/url";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
    const item: MenuItemWithAssociations = data?.payload?.item

    return [
        { title: item?.name || "Nome não encontrado" },
    ];
};


export async function loader({ request, params }: LoaderFunctionArgs) {
    const itemId = urlAt(request.url, -2);
    let user = await authenticator.isAuthenticated(request);

    if (!itemId) {
        return badRequest("Nenhum item encontrado");
    }


    const [err, item] = await prismaIt(menuItemPrismaEntity.findById(itemId));

    if (err) {
        return serverError(err);
    }

    if (!item) {
        return badRequest("Nenhum item encontrado");
    }

    const [errSizeVariations, sizeVariations] = await tryit(prismaClient.menuItemSizeVariation.findMany())

    return ok({
        item,
        sizeVariations,
        loggedUser: user
    });
}

export async function action({ request }: ActionFunctionArgs) {

    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    if (_action === "menu-item-last-cost-update") {

        const amount = isNaN(Number(values?.amount)) ? 0 : Number(values?.amount)
        const latestAmount = parserFormDataEntryToNumber(values?.latestAmount)
        const discountPercentage = isNaN(Number(values?.discountPercentage)) ? 0 : Number(values?.discountPercentage)
        const showOnCardapio = values?.showOnCardapio === "on" ? true : false
        const updatedBy = jsonParse(values?.updatedBy)?.email || ""

        const nextPrice: Partial<MenuItemPriceVariation> = {
            id: values.id as string,
            amount,
            discountPercentage,
            showOnCardapio,
            latestAmount,
            updatedBy
        }
    }
}


export default function SingleMenuItemCosts() {



    const loaderData = useLoaderData<typeof loader>()
    const item: MenuItemWithAssociations = loaderData.payload?.item
    const sizeVariations: MenuItemSizeVariation[] = loaderData.payload?.sizeVariations || []

    const costVariations = item.costVariations || []

    console.log({ item })

    if (costVariations.length === 0) {
        return (
            <div className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">Nenhum custos cadastrado</p>
            </div>
        )
    }


    return (
        <div className="flex flex-col gap-4">

            {
                costVariations.map((cost) => (
                    <Form method="post" key={cost.id}>
                        <input type="hidden" name="id" value={cost.id} />

                        <MenuItemSizeVariationsSelector variations={sizeVariations} />

                        <Input type="string" name="crustPrice" placeholder="Valor da Massa" defaultValue={cost.crustPrice} className="w-full" />

                        <Input type="string" name="ingredientsPrice" placeholder="Valor dos Ingredientes" defaultValue={cost.ingredientPrice} className="w-full" />
                    </Form>
                ))
            }

        </div>
    )
}
