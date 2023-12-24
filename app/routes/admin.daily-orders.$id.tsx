import { Label } from "@radix-ui/react-label";
import { LoaderArgs, redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import InputItem from "~/components/primitives/form/input-item/input-item";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import Fieldset from "~/components/ui/fieldset";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { dailyOrderEntity } from "~/domain/daily-orders/daily-order.entity.server";
import { DOTProduct, DailyOrder } from "~/domain/daily-orders/daily-order.model.server";
import dotInboundChannels from "~/domain/daily-orders/dot-inbound-channels";
import dotPaymentMethods from "~/domain/daily-orders/dot-payment-methods";
import dotProducts from "~/domain/daily-orders/dot-products";
import { ok } from "~/utils/http-response.server";
import { urlAt } from "~/utils/url";

export async function loader({ request }: LoaderArgs) {

    const lastUrlSlug = urlAt(request.url, -1)

    if (!lastUrlSlug) {
        return redirect(`/admin/daily-orders`)
    }

    const dailyOrder = await dailyOrderEntity.findById(lastUrlSlug)

    return ok({
        dailyOrder
    })

}
// function dotProducts(): DOTProduct[] {
//     return ["Pizza Familía", "Pizza Media", "Al Taglio", "Bebida"];
// }

export default function DailyOrdersSingle() {

    const loaderData = useLoaderData<typeof loader>()
    const dailyOrder = loaderData.payload.dailyOrder as DailyOrder

    const transactions = dailyOrder.transactions || []

    const productsSelection = dotProducts()
    const inboundChannelsSelection = dotInboundChannels()
    const paymentMethodsSelection = dotPaymentMethods()


    return (
        <div className="flex flex-col gap-8">
            <div className="flex gap-4">
                <span>{`Numero pizza familia ${dailyOrder.largePizzaNumber}`}</span>
                <span>{`Numero pizza média ${dailyOrder.mediumPizzaNumber}`}</span>
            </div>
            <div className="flex flex-col gap-6">
                <Form method="post" className="flex items-center gap-2">

                    <Fieldset>
                        <Label htmlFor="name" className="flex gap-2 items-center text-sm font-semibold">
                            Produto
                        </Label>
                        <div className="md:max-w-[150px]">
                            <Select name="product" defaultValue={"Pizza Familía"}>
                                <SelectTrigger >
                                    <SelectValue placeholder="Produto" />
                                </SelectTrigger>
                                <SelectContent id="product"   >
                                    <SelectGroup >
                                        {productsSelection && productsSelection.map(p => {
                                            return (
                                                <SelectItem key={p} value={p ?? ""} className="text-lg">{p}</SelectItem>
                                            )
                                        })}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </div>
                    </Fieldset>

                    <Fieldset>
                        <Label htmlFor="name" className="flex gap-2 items-center text-sm font-semibold">
                            Valor
                        </Label>
                        <InputItem type="text" name="amount" />
                    </Fieldset>

                    <Fieldset>
                        <Label htmlFor="name" className="flex gap-2 items-center text-sm font-semibold">
                            Comanda
                        </Label>
                        <InputItem type="text" name="orderNumber" />
                    </Fieldset>

                    <Fieldset>
                        <Label htmlFor="name" className="flex gap-2 items-center text-sm font-semibold">
                            Moto
                        </Label>
                        <div className="md:max-w-[100px]">
                            <Select name="isMotoRequired" defaultValue={"Sim"}>
                                <SelectTrigger >
                                    <SelectValue placeholder="Canale Entrada" />
                                </SelectTrigger>
                                <SelectContent id="isMotoRequired"   >
                                    <SelectGroup >
                                        <SelectItem value={"Sim"} className="text-lg">Sim</SelectItem>
                                        <SelectItem value={"Não"} className="text-lg">Não</SelectItem>
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </div>
                    </Fieldset>

                    <Fieldset>
                        <Label htmlFor="name" className="flex gap-2 items-center text-sm font-semibold">
                            Canale de Entrada
                        </Label>
                        <div className="md:max-w-[150px]">
                            <Select name="inboudChannel" defaultValue={"Mogo"}>
                                <SelectTrigger >
                                    <SelectValue placeholder="Canale Entrada" />
                                </SelectTrigger>
                                <SelectContent id="inboudChannel"   >
                                    <SelectGroup >
                                        {inboundChannelsSelection && inboundChannelsSelection.map(ic => {
                                            return (
                                                <SelectItem key={ic} value={ic ?? ""} className="text-lg">{ic}</SelectItem>
                                            )
                                        })}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </div>
                    </Fieldset>

                    <Fieldset>
                        <Label htmlFor="name" className="flex gap-2 items-center text-sm font-semibold">
                            Metodo de Pag.
                        </Label>
                        <div className="md:max-w-[150px]">
                            <Select name="paymentMethod" defaultValue={"Mogo"}>
                                <SelectTrigger >
                                    <SelectValue placeholder="Metodo de Pagamento" />
                                </SelectTrigger>
                                <SelectContent id="product"   >
                                    <SelectGroup >
                                        {paymentMethodsSelection && paymentMethodsSelection.map(mp => {
                                            return (
                                                <SelectItem key={mp} value={mp ?? ""} className="text-lg">{mp}</SelectItem>
                                            )
                                        })}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </div>
                    </Fieldset>


                    <SubmitButton actionName="daily-orders-create" idleText="Salvar" loadingText="Salvando..." />
                </Form>
                <Transactions />
            </div>
        </div>

    )
}

function Transactions() {
    return <div>transactions</div>
}