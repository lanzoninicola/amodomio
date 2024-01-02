import { Label } from "@radix-ui/react-label";
import { LoaderArgs, redirect } from "@remix-run/node";
import { Form, useLoaderData, useNavigation } from "@remix-run/react";
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
import { Separator } from "~/components/ui/separator";
import dotOperators from "~/domain/daily-orders/dot-operators";
import useFormResponse from "~/hooks/useFormResponse";
import { AlertError, AlertOk } from "~/components/layout/alerts/alerts";
import { useEffect, useState } from "react";
import randomReactKey from "~/utils/random-react-key";
import getSearchParam from "~/utils/get-search-param";
import { formatDateOnyTime } from "~/lib/dayjs";
import useFormSubmissionnState from "~/hooks/useFormSubmissionState";
import { Loader } from "lucide-react";


export async function loader({ request, params }: LoaderArgs) {
    if (!params?.id) {
        return redirect(`/admin/daily-orders`)
    }

    const dailyOrder = await dailyOrderEntity.findById(params?.id)

    return ok({
        dailyOrder,
        currentOperatorId: getSearchParam({ request, paramName: 'op' }),
    })

}


export async function action({ request }: LoaderArgs) {

    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    const operator = dotOperators(values.operatorId as string) as DOTOperator

    const transaction: Omit<DailyOrderTransaction, "createdAt" | "updatedAt"> = {
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

        return ok({
            action: "daily-orders-pizzas-number-update",
        })

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
                <DailyOrderQuickStat label={"Total Pedidos"} value={dailyOrder?.totalOrdersNumber || 0} decimalsAmount={0} />
                <DailyOrderQuickStat label={"Total Valor Pedidos"} value={dailyOrder?.totalOrdersAmount || 0} />
                <DailyOrderQuickStat label={"Total Valor Motoboy"} value={dailyOrder?.totalMotoboyAmount || 0} />
            </div>
            <Separator className="my-6" />
            <div className="flex flex-col gap-6 w-full">
                <div className="bg-slate-50 rounded-xl p-4 mb-8">
                    <Form method="post" className="flex items-center gap-2 w-full" ref={formResponse.formRef}>
                        <TransactionForm saveActionName="daily-orders-transaction-create" />
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
                    clazzName="grid-cols-9"
                    titles={[
                        "Comanda",
                        "Produto",
                        "Valor",
                        "Moto",
                        "Valor Motoboy",
                        "Canal de entrada",
                        "Forma de pagamento",
                        "Data",
                        "Ações",
                    ]}
                />
                <TableRows>
                    {transactions.sort((a, b) => {
                        // sort desc by date
                        if (a.createdAt > b.createdAt) return -1

                        if (a.createdAt < b.createdAt) return 1

                        return 0; // Handle undefined values, placing them at an arbitrary position
                    }).map(t => {
                        return (

                            <TableRow
                                key={t.id}
                                row={t}
                                isProcessing={navigation.state !== "idle"}
                                showDateColumns={false}
                            >
                                <Form method="post" className="grid grid-cols-9">
                                    <TransactionForm
                                        transaction={t}
                                        showLabels={false}
                                        ghost={true}
                                        smallText={true}
                                        saveActionName="daily-orders-transaction-update"
                                        showDeleteButton={true}
                                    />

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
    transaction?: DailyOrderTransaction
    showLabels?: boolean
    ghost?: boolean
    smallText?: boolean
    action?: "create" | "update" | "soft-delete",
    saveActionName: "daily-orders-transaction-create" | "daily-orders-transaction-update",
    showDeleteButton?: boolean
}

function TransactionForm({ transaction, showLabels = true, ghost = false, smallText = false, saveActionName, showDeleteButton = false }: TransactionFormProps) {
    const loaderData = useLoaderData<typeof loader>()
    const dailyOrder = loaderData?.payload?.dailyOrder as DailyOrder

    // if the transaction is undefined, this means that the form is used to add a new transaction
    // otherwise it is used to update the order
    const transactionFormState = transaction === undefined ? "new" : "update"

    const productsSelection = dotProducts()
    const inboundChannelsSelection = dotInboundChannels()
    const paymentMethodsSelection = dotPaymentMethods()

    return (

        <>
            <InputItem type="hidden" name="dailyOrderId" defaultValue={dailyOrder.id} />
            <InputItem type="hidden" name="transactionId" defaultValue={transaction?.id || ""} />
            <InputItem type="hidden" name="operatorId" defaultValue={loaderData.payload?.currentOperatorId} />
            {
                transactionFormState === "update" && (
                    <Fieldset clazzName="mb-0">
                        {showLabels && (
                            <Label htmlFor="orderNumber" className="flex gap-2 items-center text-sm font-semibold max-w-[100px]">
                                Comanda
                            </Label>
                        )}
                        <div className="border-2 border-black rounded-xl font-bold text-xl w-[60px] h-[40px] m-auto grid place-items-center">
                            <InputItem type="text" name="orderNumber"
                                className={`max-w-[60px] ${smallText === true ? `text-xs` : ``} border-none outline-none text-center`}
                                ghost={ghost}
                                defaultValue={transaction?.orderNumber}

                            />
                        </div>
                    </Fieldset>
                )
            }
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
                    defaultValue={transaction?.amount}
                    required
                />
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

            <div className="flex flex-col justify-center">
                {transaction?.createdAt && (
                    <div className="flex flex-col">
                        <span className="font-body font-bold text-xs">Criado</span>
                        <span className="font-body text-xs">
                            {formatDateOnyTime(transaction?.createdAt)}
                        </span>
                    </div>
                )}
                {transaction?.updatedAt && (
                    <div className="flex flex-col">
                        <span className="font-body font-bold text-xs">Atualizado</span>
                        <span className="font-body text-xs">
                            {formatDateOnyTime(transaction?.updatedAt)}
                        </span>
                    </div>
                )}
            </div>

            <div className="flex items-center">
                <SaveItemButton actionName={saveActionName} />
                {showDeleteButton === true && <DeleteItemButton actionName="daily-orders-transaction-soft-delete" />}
            </div>







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
    const error = restNumber <= 1

    const formResponse = useFormResponse()

    const formSubmissionState = useFormSubmissionnState()
    let formSubmissionInProgress = formSubmissionState === "submitting"
    let saveLabel = formSubmissionInProgress ? ("Salvando...") : ("Salvar alterações")

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
        <div className="flex flex-col gap-2">
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
                            <div className="flex gap-2 items-center justify-end">
                                {formSubmissionInProgress && <Loader className="text-md" />}
                                <button type="submit" className="text-sm underline justify-self-end" name="_action" value={"daily-orders-pizzas-number-update"}>
                                    {saveLabel}

                                </button>
                            </div>
                        }
                    </div>
                </Form>
            </div>
            {/* {
                formResponse.isOk === true &&
                formResponse.data?.action === "daily-orders-pizzas-number-update" &&
                (
                    <AlertOk message="Numero de pizza alterado com successo" />
                )
            } */}
        </div>

    )
}

interface DailyOrderQuickStatProps {
    label: string
    value: number
    decimalsAmount?: number
}

export function DailyOrderQuickStat({ label, value, decimalsAmount = 2 }: DailyOrderQuickStatProps) {

    const valueRendered = value.toFixed(decimalsAmount)

    return (
        <div className="grid grid-cols-2 items-center gap-x-4 ">
            <span className="font-medium leading-none tracking-tight">{label}</span>
            <span className="font-semibold leading-none tracking-tight">{valueRendered}</span>
        </div>
    )
}