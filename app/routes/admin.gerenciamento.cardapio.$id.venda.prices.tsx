import { MenuItemPriceVariation } from "@prisma/client";
import { LoaderArgs } from "@remix-run/node";
import { useLoaderData, useOutletContext } from "@remix-run/react";
import { useState } from "react";
import Fieldset from "~/components/ui/fieldset";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import MenuItemPriceVariationForm, { MenuItemPriceVariationFormAction } from "~/domain/cardapio/components/menu-item-price-variation-form/menu-item-price-variation-form";
import { defaultItemsPriceVariations, suggestPriceVariations } from "~/domain/cardapio/fn.utils";
import { menuItemPriceVariationsEntity } from "~/domain/cardapio/menu-item-price-variations.prisma.entity.server";
import { MenuItemWithAssociations, menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { cn } from "~/lib/utils";
import { badRequest, ok, serverError } from "~/utils/http-response.server";
import { urlAt } from "~/utils/url";


export async function loader({ request, params }: LoaderArgs) {
    const itemId = urlAt(request.url, -3);

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
    });
}

export async function action({ request }: LoaderArgs) {

    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    // console.log({ action: _action, values })

    if (_action === "menu-item-price-variation-update") {

        const amount = isNaN(Number(values?.amount)) ? 0 : Number(values?.amount)
        const discountPercentage = isNaN(Number(values?.discountPercentage)) ? 0 : Number(values?.discountPercentage)
        const showOnCardapio = values?.showOnCardapio === "on" ? true : false

        const nextPrice: Partial<MenuItemPriceVariation> = {
            id: values.id as string,
            amount,
            discountPercentage,
            showOnCardapio
        }

        const [err, result] = await prismaIt(menuItemPriceVariationsEntity.update(values.id as string, nextPrice))

        if (err) {
            return badRequest(err)
        }

        return ok("Elemento atualizado com successo")
    }

    return null
}


export default function SingleMenuItemVendaPrice() {
    const loaderData = useLoaderData<typeof loader>()
    const item: MenuItemWithAssociations = loaderData.payload?.item
    let priceVariations = item.priceVariations || []
    let formAction: MenuItemPriceVariationFormAction = "menu-item-price-variation-update"


    if (priceVariations.length === 0) {
        priceVariations = defaultItemsPriceVariations() as MenuItemWithAssociations["priceVariations"]
        formAction = "menu-item-price-variation-create"
    }

    const [currentBasePrice, setCurrentBasePrice] = useState(item?.basePriceAmount || 0)



    return (

        <div className="flex flex-col">
            <div className="flex flex-col gap-4">
                <div className="grid grid-cols-8 items-center">
                    <span className="text-xs uppercase tracking-wider col-span-1 font-semibold text-muted-foreground ">Sabor</span>
                    <span className="text-sm text-right font-semibold">{item.name}</span>
                </div>
                <div className="grid grid-cols-8 items-center">
                    <span className="text-xs uppercase tracking-wider col-span-1 font-semibold text-muted-foreground">Preço Base</span>
                    <span className="text-sm text-right font-semibold">{item.basePriceAmount}</span>
                </div>
            </div>
            <Separator className="my-8" />
            <div className="flex flex-col gap-4">
                {priceVariations.map((pv: MenuItemPriceVariation) => <MenuItemPriceVariationForm
                    key={pv.id} price={pv} action={formAction}
                    basePrice={currentBasePrice} />
                )}
            </div>
        </div>
    )
}