import { Label } from "@radix-ui/react-label";
import { LoaderArgs, redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import InputItem from "~/components/primitives/form/input-item/input-item";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import Fieldset from "~/components/ui/fieldset";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { dailyOrderEntity } from "~/domain/daily-orders/daily-order.entity.server";
import { DOTInboundChannel, DOTPaymentMethod, DOTProduct, DailyOrder, DailyOrderTransaction } from "~/domain/daily-orders/daily-order.model.server";
import dotInboundChannels from "~/domain/daily-orders/dot-inbound-channels";
import dotPaymentMethods from "~/domain/daily-orders/dot-payment-methods";
import dotProducts from "~/domain/daily-orders/dot-products";
import { ok, serverError } from "~/utils/http-response.server";
import randomReactKey from "~/utils/random-react-key";
import tryit from "~/utils/try-it";
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


export async function action({ request }: LoaderArgs) {

    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    console.log(values)
    if (_action === "daily-orders-transaction-create") {

        if (values.dailyOrderId === undefined || values.dailyOrderId === "") {
            return serverError({ message: "Erro generico" })
        }

        const transaction: DailyOrderTransaction = {
            product: values.product as DOTProduct || "",
            amount: Number.isNaN(values?.amount) ? 0 : Number(values.amount),
            orderNumber: Number.isNaN(values?.orderNumber) ? 0 : Number(values.orderNumber),
            isMotoRequired: values.isMotoRequired === "Sim" ? true : false,
            amountMotoboy: Number.isNaN(values?.amountMotoboy) ? 0 : Number(values.amountMotoboy),
            inboundChannel: values.inboundChannel as DOTInboundChannel || "",
            paymentMethod: values.paymentMethod as DOTPaymentMethod || "",
            deletedAt: null
        }

        const [err, itemCreated] = await tryit(dailyOrderEntity.createTransaction(values.dailyOrderId as string, transaction))

        if (err) {
            return serverError({ message: err.message })
        }

        return redirect(`/admin/daily-orders/${values.dailyOrderId}`)


    }


}

export default function DailyOrdersSingle() {

    const loaderData = useLoaderData<typeof loader>()
    const dailyOrder = loaderData.payload.dailyOrder as DailyOrder

    const transactions = dailyOrder.transactions || []




    return (
        <div className="flex flex-col gap-8">
            <div className="flex gap-4">
                <span>{`Numero pizza familia ${dailyOrder.largePizzaNumber}`}</span>
                <span>{`Numero pizza média ${dailyOrder.mediumPizzaNumber}`}</span>
            </div>
            <div className="flex flex-col gap-6 w-full">
                <TransactionForm dailyOrderId={dailyOrder.id} />
                <Transactions />
            </div>
        </div>

    )
}

function Transactions() {
    return <div>transactions</div>
}

interface TransactionFormProps {
    dailyOrderId: DailyOrder["id"],
    transaction?: DailyOrderTransaction
}

function TransactionForm({ dailyOrderId, transaction }: TransactionFormProps) {
    const productsSelection = dotProducts()
    const inboundChannelsSelection = dotInboundChannels()
    const paymentMethodsSelection = dotPaymentMethods()



    return (
        <Form method="post" className="flex items-center gap-2 w-full">
            <InputItem type="hidden" name="dailyOrderId" defaultValue={dailyOrderId} />
            <div className="flex items-center gap-1 w-full">
                <Fieldset>
                    <Label htmlFor="name" className="flex gap-2 items-center text-sm font-semibold">
                        Produto
                    </Label>
                    <div className="md:max-w-[150px]">
                        <Select name="product" defaultValue={transaction?.product || "Pizza Familía"}>
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
                    <InputItem type="text" name="amount" className="max-w-[100px]" defaultValue={transaction?.amount} />
                </Fieldset>

                <Fieldset >
                    <Label htmlFor="orderNumber" className="flex gap-2 items-center text-sm font-semibold max-w-[100px]">
                        Comanda
                    </Label>
                    <InputItem type="text" name="orderNumber" className="max-w-[100px]" defaultValue={transaction?.orderNumber} />
                </Fieldset>

                <Fieldset>
                    <Label htmlFor="name" className="flex gap-2 items-center text-sm font-semibold">
                        Moto
                    </Label>
                    <div className="md:max-w-[100px]">
                        <Select name="isMotoRequired" defaultValue={transaction?.isMotoRequired === true ? "Sim" : "Não" || "Sim"}>
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
                    <Label htmlFor="amountMotoboy" className="flex gap-2 items-center text-sm font-semibold">
                        Valor Motoboy
                    </Label>
                    <InputItem type="text" name="amountMotoboy" className="max-w-[100px]" defaultValue={transaction?.amountMotoboy} />
                </Fieldset>

                <Fieldset>
                    <Label htmlFor="name" className="flex gap-2 items-center text-sm font-semibold">
                        Canal de Entrada
                    </Label>
                    <div className="md:max-w-[150px]">
                        <Select name="inboundChannel" defaultValue={transaction?.inboundChannel || "Mogo"}>
                            <SelectTrigger >
                                <SelectValue placeholder="Canale Entrada" />
                            </SelectTrigger>
                            <SelectContent id="inboundChannel"   >
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
                        <Select name="paymentMethod" defaultValue={transaction?.paymentMethod || "PIX"}>
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
            </div>
            <SubmitButton actionName="daily-orders-transaction-create" onlyIcon={true} />
        </Form>
    )
}

