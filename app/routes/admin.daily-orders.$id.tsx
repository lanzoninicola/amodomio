import { Label } from "@radix-ui/react-label";
import { LoaderArgs, redirect } from "@remix-run/node";
import { Form, useLoaderData, useNavigation, useOutletContext } from "@remix-run/react";
import InputItem from "~/components/primitives/form/input-item/input-item";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import { DeleteItemButton, EditItemButton, Table, TableRow, TableRows, TableTitles } from "~/components/primitives/table-list";
import SaveItemButton from "~/components/primitives/table-list/action-buttons/save-item-button/save-item-button";
import Fieldset from "~/components/ui/fieldset";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { dailyOrderEntity } from "~/domain/daily-orders/daily-order.entity.server";
import { DOTInboundChannel, DOTPaymentMethod, DOTProduct, DailyOrder, DailyOrderTransaction } from "~/domain/daily-orders/daily-order.model.server";
import dotInboundChannels from "~/domain/daily-orders/dot-inbound-channels";
import dotPaymentMethods from "~/domain/daily-orders/dot-payment-methods";
import dotProducts from "~/domain/daily-orders/dot-products";
import { ok, serverError } from "~/utils/http-response.server";
import { jsonStringify } from "~/utils/json-helper";
import randomReactKey from "~/utils/random-react-key";
import tryit from "~/utils/try-it";
import { urlAt } from "~/utils/url";
import { AdminOutletContext } from "./admin";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";


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

    const transaction: DailyOrderTransaction = {
        product: values.product as DOTProduct || "",
        amount: Number.isNaN(values?.amount) ? 0 : Number(values.amount),
        orderNumber: Number.isNaN(values?.orderNumber) ? 0 : Number(values.orderNumber),
        isMotoRequired: values.isMotoRequired === "Sim" ? true : false,
        amountMotoboy: Number.isNaN(values?.amountMotoboy) ? 0 : Number(values.amountMotoboy),
        inboundChannel: values.inboundChannel as DOTInboundChannel || "",
        paymentMethod: values.paymentMethod as DOTPaymentMethod || "",
        deletedAt: null,
        userLogged: values.userLogged as string
    }

    if (values.transactionId) {
        transaction.id = values.transactionId as string
    }

    if (values.dailyOrderId === undefined || values.dailyOrderId === "") {
        return serverError({ message: "Erro generico" })
    }

    if (_action === "daily-orders-transaction-create") {
        const [err, itemCreated] = await tryit(dailyOrderEntity.createTransaction(values.dailyOrderId as string, transaction))

        if (err) {
            return serverError({ message: err.message })
        }
        return ok()
    }

    if (_action === "daily-orders-transaction-update") {
        const [err, itemUpdated] = await tryit(
            dailyOrderEntity.updateTransaction(
                values.dailyOrderId as string,
                transaction.id,
                transaction
            )
        )

        if (err) {
            return serverError({ message: err.message })
        }
        return ok()
    }

    if (_action === "daily-orders-transaction-soft-delete") {
        const [err, itemUpdated] = await tryit(
            dailyOrderEntity.deleteTransaction(
                values.dailyOrderId as string,
                transaction.id,
            )
        )

        if (err) {
            return serverError({ message: err.message })
        }
        return ok()
    }


    return null


}

export default function DailyOrdersSingle() {
    const loaderData = useLoaderData<typeof loader>()
    const dailyOrder = loaderData.payload.dailyOrder as DailyOrder

    const transactions = dailyOrder.transactions.filter(t => t.deletedAt === null) || []

    return (
        <div className="flex flex-col">
            <div className="flex justify-between items-center">
                <div className="flex gap-4">
                    <PizzaSizeStat label={"Pizza Familía"} initialNumber={dailyOrder.initialLargePizzaNumber} restNumber={dailyOrder.restLargePizzaNumber} />
                    <PizzaSizeStat label={"Pizza Medía"} initialNumber={dailyOrder.initialMediumPizzaNumber} restNumber={dailyOrder.restMediumPizzaNumber} />
                </div>
                <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 items-center gap-x-4">
                        <span className="font-semibold leading-none tracking-tight">Total Valor Pedidos</span>
                        <span className="font-semibold leading-none tracking-tight">R$ {dailyOrder.totalOrdersAmount || 0}</span>
                    </div>
                    <div className="grid grid-cols-2 items-center gap-x-4">
                        <span className="text-sm font-semibold leading-none tracking-tight">Total Valor Motoboy</span>
                        <span className="text-sm font-semibold leading-none tracking-tight">R$ {dailyOrder.totalMotoboyAmount || 0}</span>
                    </div>

                </div>
            </div>
            <Separator className="my-6" />
            <div className="flex flex-col gap-6 w-full">
                <div className="bg-slate-50 rounded-xl p-4 mb-8">
                    <Form method="post" className="flex items-center gap-2 w-full ">
                        <TransactionForm dailyOrderId={dailyOrder.id} />
                        <SaveItemButton actionName="daily-orders-transaction-create" clazzName="mt-6" />
                    </Form>
                </div>

                <Transactions dailyOrderId={dailyOrder.id} transactions={transactions} />
            </div>
        </div>

    )
}

interface TransactionsProps {
    dailyOrderId: DailyOrder["id"],
    transactions: DailyOrderTransaction[]
}

function Transactions({ transactions, dailyOrderId }: TransactionsProps) {
    const navigation = useNavigation()

    return (
        <>
            <h4 className="scroll-m-20 text-xl font-semibold tracking-tight">
                Pedidos do dia
            </h4>
            <Table>
                <TableTitles
                    clazzName="grid-cols-8"
                    titles={[
                        "Produto",
                        "Valor",
                        "Comanda",
                        "Moto",
                        "Valor Motoboy",
                        "Canal de entrada",
                        "Forma de pagamento",
                        "Ações"
                    ]}
                />
                <TableRows>
                    {transactions.map(t => {
                        return (
                            <TableRow
                                key={t.id}
                                row={t}
                                isProcessing={navigation.state !== "idle"}

                            >
                                <Form method="post" className="grid grid-cols-8">
                                    <TransactionForm
                                        dailyOrderId={dailyOrderId}
                                        transaction={t}
                                        showLabels={false}
                                        ghost={true}
                                        smallText={true} />
                                    <div className="flex">
                                        <SaveItemButton actionName="daily-orders-transaction-update" />
                                        <DeleteItemButton actionName="daily-orders-transaction-soft-delete" />
                                    </div>
                                </Form>
                            </TableRow>
                        )
                    })}
                </TableRows>
            </Table>
        </>

    )
}



interface TransactionFormProps {
    dailyOrderId: DailyOrder["id"],
    transaction?: DailyOrderTransaction
    showLabels?: boolean
    ghost?: boolean
    smallText?: boolean
    action?: "create" | "update" | "soft-delete"
}

function TransactionForm({ dailyOrderId, transaction, showLabels = true, ghost = false, smallText = false }: TransactionFormProps) {
    const outletContext = useOutletContext<AdminOutletContext>()

    const productsSelection = dotProducts()
    const inboundChannelsSelection = dotInboundChannels()
    const paymentMethodsSelection = dotPaymentMethods()

    return (
        <>
            <InputItem type="hidden" name="dailyOrderId" defaultValue={dailyOrderId} />
            <InputItem type="hidden" name="transactionId" defaultValue={transaction?.id || ""} />
            <InputItem type="hidden" name="userLogged" defaultValue={outletContext?.loggedUser?.email || ""} />
            <Fieldset clazzName="mb-0">
                {showLabels && (
                    <Label htmlFor="name" className="flex gap-2 items-center text-sm font-semibold">
                        Produto
                    </Label>
                )}
                <div className="md:max-w-[150px] ">
                    <Select name="product" defaultValue={transaction?.product || "Pizza Familía"}>
                        <SelectTrigger className={`${smallText === true ? `text-xs` : ``} ${ghost === true ? `border-none` : ``}`} >
                            <SelectValue placeholder="Produto" />
                        </SelectTrigger>
                        <SelectContent id="product" >
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

            <Fieldset clazzName="mb-0">
                {showLabels && (
                    <Label htmlFor="name" className="flex gap-2 items-center text-sm font-semibold">
                        Valor
                    </Label>
                )}
                <InputItem type="text" name="amount"
                    className={`max-w-[100px] ${smallText === true ? `text-xs` : ``}`}
                    ghost={ghost}
                    defaultValue={transaction?.amount} />
            </Fieldset>

            <Fieldset clazzName="mb-0">
                {showLabels && (
                    <Label htmlFor="orderNumber" className="flex gap-2 items-center text-sm font-semibold max-w-[100px]">
                        Comanda
                    </Label>
                )}
                <InputItem type="text" name="orderNumber"
                    className={`max-w-[100px] ${smallText === true ? `text-xs` : ``}`}
                    ghost={ghost}
                    defaultValue={transaction?.orderNumber} />
            </Fieldset>

            <Fieldset clazzName="mb-0">
                {showLabels && (
                    <Label htmlFor="name" className="flex gap-2 items-center text-sm font-semibold">
                        Moto
                    </Label>
                )}
                <div className="md:max-w-[100px]">
                    <Select name="isMotoRequired" defaultValue={transaction?.isMotoRequired === true ? "Sim" : "Não" || "Sim"}>
                        <SelectTrigger className={`${smallText === true ? `text-xs` : ``} ${ghost === true ? `border-none` : ``}`}>
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

            <Fieldset clazzName="mb-0">
                {showLabels && (
                    <Label htmlFor="amountMotoboy" className="flex gap-2 items-center text-sm font-semibold">
                        Valor Motoboy
                    </Label>
                )}
                <InputItem type="text" name="amountMotoboy"
                    className={`max-w-[100px] ${smallText === true ? `text-xs` : ``}`}
                    ghost={ghost}
                    defaultValue={transaction?.amountMotoboy} />

            </Fieldset>

            <Fieldset clazzName="mb-0">
                {showLabels && (
                    <Label htmlFor="name" className="flex gap-2 items-center text-sm font-semibold">
                        Canal de Entrada
                    </Label>
                )}
                <div className="md:max-w-[150px]">
                    <Select name="inboundChannel" defaultValue={transaction?.inboundChannel || "Mogo"}>
                        <SelectTrigger className={`${smallText === true ? `text-xs` : ``} ${ghost === true ? `border-none` : ``}`}>
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

            <Fieldset clazzName="mb-0">
                {showLabels && (
                    <Label htmlFor="name" className="flex gap-2 items-center text-sm font-semibold">
                        Metodo de Pag.
                    </Label>
                )}
                <div className="md:max-w-[150px]">
                    <Select name="paymentMethod" defaultValue={transaction?.paymentMethod || "PIX"}>
                        <SelectTrigger className={`${smallText === true ? `text-xs` : ``} ${ghost === true ? `border-none` : ``}`}>
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
        </>
    )
}


interface PizzaSizeStatProps {
    label: string
    initialNumber?: number
    restNumber?: number
}

function PizzaSizeStat({ label, initialNumber = 0, restNumber = 0 }: PizzaSizeStatProps) {
    return (
        <div className="flex items-end gap-12 border rounded-lg px-2 py-4">
            <h4 className="font-semibold leading-none tracking-tight">{label}</h4>
            <Form method="post" className="flex gap-4">
                <div className="flex gap-4">
                    <div className="flex gap-4">
                        <div className="flex flex-col items-center">
                            <span className="text-xs  leading-none tracking-tight">Iniciais</span>
                            <input type="text" defaultValue={initialNumber}
                                className="border-none text-sm font-semibold leading-none tracking-tight w-[24px] text-center pt-2" />
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-xs  leading-none tracking-tight">Restante</span>
                            <input type="text" defaultValue={restNumber}
                                className="border-none text-sm font-semibold leading-none tracking-tight w-[24px] text-center pt-2" />
                        </div>
                    </div>

                    <input type="hidden" name="pizzaSize" value={label} />
                    <SaveItemButton actionName="daily-orders-pizzas-number-update" />
                </div>
            </Form>


        </div>
    )
}