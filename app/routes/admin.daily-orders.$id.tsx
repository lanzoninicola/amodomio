import { Label } from "@radix-ui/react-label";
import { LoaderArgs, redirect } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation, useOutletContext, useParams } from "@remix-run/react";
import InputItem from "~/components/primitives/form/input-item/input-item";
import { DeleteItemButton, Table, TableRow, TableRows, TableTitles } from "~/components/primitives/table-list";
import SaveItemButton from "~/components/primitives/table-list/action-buttons/save-item-button/save-item-button";
import Fieldset from "~/components/ui/fieldset";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { dailyOrderEntity } from "~/domain/daily-orders/daily-order.entity.server";
import { DOTInboundChannel, DOTOperator, DOTPaymentMethod, DOTPizzaSize, DOTProduct, DailyOrder, DailyOrderTransaction } from "~/domain/daily-orders/daily-order.model.server";
import dotInboundChannels from "~/domain/daily-orders/dot-inbound-channels";
import dotPaymentMethods from "~/domain/daily-orders/dot-payment-methods";
import dotProducts from "~/domain/daily-orders/dot-products";
import { ok, serverError } from "~/utils/http-response.server";
import tryit from "~/utils/try-it";
import { urlAt } from "~/utils/url";
import { AdminOutletContext } from "./admin";
import { Separator } from "~/components/ui/separator";
import dotOperators from "~/domain/daily-orders/dot-operators";
import useFormResponse from "~/hooks/useFormResponse";
import { AlertError } from "~/components/layout/alerts/alerts";
import { useEffect, useState } from "react";
import randomReactKey from "~/utils/random-react-key";


export async function loader({ request, params }: LoaderArgs) {
    const operatorId = new URL(request.url).searchParams.get('op');

    if (!params?.id) {
        return redirect(`/admin/daily-orders`)
    }

    const dailyOrder = await dailyOrderEntity.findById(params?.id)

    return ok({
        dailyOrder,
        currentOperatorId: operatorId,
    })

}


export async function action({ request }: LoaderArgs) {

    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    const operator = dotOperators(values.operatorId as string) as DOTOperator

    const transaction: DailyOrderTransaction = {
        product: values.product as DOTProduct || "",
        amount: Number.isNaN(values?.amount) ? 0 : Number(values.amount),
        orderNumber: Number.isNaN(values?.orderNumber) ? 0 : Number(values.orderNumber),
        isMotoRequired: values.isMotoRequired === "Sim" ? true : false,
        amountMotoboy: Number.isNaN(values?.amountMotoboy) ? 0 : Number(values.amountMotoboy),
        inboundChannel: values.inboundChannel as DOTInboundChannel || "",
        paymentMethod: values.paymentMethod as DOTPaymentMethod || "",
        deletedAt: null,
        operator
    }

    if (values.transactionId) {
        transaction.id = values.transactionId as string
    }

    if (values.dailyOrderId === undefined || values.dailyOrderId === "") {
        return serverError("O ID dos pedidos do dia não pode ser null")
    }

    if (_action === "daily-orders-transaction-create") {
        const [err, itemCreated] = await tryit(dailyOrderEntity.createTransaction(values.dailyOrderId as string, transaction))


        if (err) {
            return serverError(err)
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
            return serverError(err)
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
            return serverError(err)
        }
        return ok()
    }


    if (_action === "daily-orders-pizzas-number-update") {


        console.log("im here", values)

        if (Number.isNaN(values.number)) {
            return serverError("O numero de pizza está incorreto")
        }

        const [err, itemUpdated] = await tryit(
            dailyOrderEntity.updatePizzaSizeRestNumber(
                values.dailyOrderId as string,
                values.pizzaSize as DOTPizzaSize,
                Number(values.number)
            )
        )

        if (err) {
            return serverError(err)
        }
        return ok()

    }


    return null


}

export default function DailyOrdersSingle() {
    const loaderData = useLoaderData<typeof loader>()
    const dailyOrder = loaderData?.payload?.dailyOrder as DailyOrder

    const transactions = dailyOrder?.transactions.filter(t => t.deletedAt === null) || []

    const formResponse = useFormResponse()

    return (
        <div className="flex flex-col">
            <div className="grid grid-cols-2 gap-x-6">
                <PizzaSizeStat label={"Pizza Familía"} initialNumber={dailyOrder?.initialLargePizzaNumber} restNumber={dailyOrder.restLargePizzaNumber} />
                <PizzaSizeStat label={"Pizza Medía"} initialNumber={dailyOrder?.initialMediumPizzaNumber} restNumber={dailyOrder.restMediumPizzaNumber} />
            </div>
            <Separator className="my-6" />

            <div className="flex gap-4 items-center w-full justify-center">
                <div className="grid grid-cols-2 items-center gap-x-4 ">
                    <span className="font-semibold leading-none tracking-tight">Total Valor Pedidos</span>
                    <span className="font-semibold leading-none tracking-tight">R$ {dailyOrder?.totalOrdersAmount || 0}</span>
                </div>
                <div className="grid grid-cols-2 items-center gap-x-4">
                    <span className="font-semibold leading-none tracking-tight">Total Valor Motoboy</span>
                    <span className="font-semibold leading-none tracking-tight">R$ {dailyOrder?.totalMotoboyAmount || 0}</span>
                </div>

            </div>
            <Separator className="my-6" />
            <div className="flex flex-col gap-6 w-full">
                <div className="bg-slate-50 rounded-xl p-4 mb-8">
                    <Form method="post" className="flex items-center gap-2 w-full" ref={formResponse.formRef}>
                        <TransactionForm dailyOrderId={dailyOrder.id} />
                        <SaveItemButton actionName="daily-orders-transaction-create" clazzName="mt-2" />
                    </Form>
                    {
                        formResponse?.isError && (
                            <div className="md:max-w-md mt-6">
                                <AlertError message={formResponse.errorMessage} title="Erro!" position="top" />
                            </div>

                        )
                    }
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
    const loaderData = useLoaderData<typeof loader>()

    const productsSelection = dotProducts()
    const inboundChannelsSelection = dotInboundChannels()
    const paymentMethodsSelection = dotPaymentMethods()



    return (
        <>
            <InputItem type="hidden" name="dailyOrderId" defaultValue={dailyOrderId} />
            <InputItem type="hidden" name="transactionId" defaultValue={transaction?.id || ""} />
            <InputItem type="hidden" name="operatorId" defaultValue={loaderData.payload?.currentOperatorId} />
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
                <InputItem type="number" name="amount"
                    step=".01"
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
                <InputItem type="number" name="amountMotoboy"
                    step=".01"
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

    const loaderData = useLoaderData<typeof loader>()
    const dailyOrder = loaderData?.payload?.dailyOrder as DailyOrder
    const [restNumberInput, setRestNumberInput] = useState(restNumber)
    const [isRestNumberChanged, setIsRestNumberChanged] = useState(false)

    const warn = restNumber > 1 && restNumber <= 3
    const error = restNumber === 1

    const formResponse = useFormResponse()


    function handleChangeNumber(newValue: string) {
        if (Number.isNaN(Number(newValue))) {
            setRestNumberInput(0)
            return
        }
        setRestNumberInput(Number(newValue))
    }

    useEffect(() => {
        if (formResponse.isError) {
            setIsRestNumberChanged(false)
            setRestNumberInput(restNumber)
        }

    }, [formResponse.isError])

    return (
        <div key={randomReactKey()} className={`flex justify-between items-end gap-12 border rounded-lg py-4 px-6
        ${warn === true ? 'bg-orange-500' : error === true ? 'bg-red-500' : ""}`}>
            <h4 className={`text-3xl leading-none tracking-tight ${warn === true || error === true ? 'text-white' : 'text-black'}`}>{label}</h4>
            <Form method="post" className={`flex gap-4 ${warn === true || error === true ? 'text-white' : 'text-black'}`} ref={formResponse.formRef}>
                <div className="grid grid-cols-2">
                    <div className="flex gap-4">
                        <div className="flex gap-4">
                            <div className="flex flex-col items-center">
                                <span className="text-xs leading-none tracking-tight">Iniciais</span>
                                <input type="text" defaultValue={initialNumber}
                                    className="text-xl  border-none font-semibold leading-none tracking-tight w-[72px] text-center pt-2 bg-transparent outline-none"
                                />
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="text-xs leading-none tracking-tight">Restante</span>
                                <input type="text"
                                    name="number"
                                    className="text-xl  border-none font-semibold leading-none tracking-tight w-[72px] text-center pt-2 bg-transparent outline-none"
                                    onChange={e => {
                                        const newValue = e.target.value

                                        if (Number(newValue) !== restNumber) {
                                            setIsRestNumberChanged(true)
                                        }
                                        handleChangeNumber(newValue)
                                    }}
                                    value={restNumberInput || 0}

                                />

                            </div>
                        </div>


                    </div>
                    <input type="hidden" name="dailyOrderId" value={dailyOrder.id} />
                    <input type="hidden" name="pizzaSize" value={label} />
                    {isRestNumberChanged === true &&
                        <button type="submit" className="text-sm underline justify-self-end" name="_action" value={"daily-orders-pizzas-number-update"}>
                            Salvar alterações
                        </button>
                    }
                </div>
            </Form>


        </div>
    )
}