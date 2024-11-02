import { MenuItemPriceVariation } from "@prisma/client";
import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, MetaFunction, useLoaderData } from "@remix-run/react";
import { ok } from "assert";
import { useState } from "react";
import { Input } from "~/components/ui/input";
import { authenticator } from "~/domain/auth/google.server";
import { MenuItemWithAssociations, menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { cn } from "~/lib/utils";
import { badRequest, serverError } from "~/utils/http-response.server";
import { jsonParse } from "~/utils/json-helper";
import parserFormDataEntryToNumber from "~/utils/parse-form-data-entry-to-number";
import toNumber from "~/utils/to-number";
import { urlAt } from "~/utils/url";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
    const item: MenuItemWithAssociations = data?.payload?.item

    return [
        { title: item?.name || "Nome não encontrado" },
    ];
};


export async function loader({ request, params }: LoaderFunctionArgs) {
    const itemId = urlAt(request.url, -3);
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

    return ok({
        item,
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


    return (
        <div className="flex flex-col gap-4">
            <Form method="post">
                <div className="grid grid-cols-8">
                    <span className="text-xs uppercase tracking-wider col-span-1 font-semibold text-muted-foreground ">Ultímo custo</span>
                    <Input type="text"
                        name="ingredientsCost"
                        defaultValue={toNumber(item.MenuItemCost.ingredientsCost).toFixed(2)}
                        className={
                            cn(
                                "text-xs md:text-sm text-right w-full py-2 border",
                            )
                        }
                    />
                </div>
            </Form>

        </div>
    )
}
