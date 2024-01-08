
import InputItem from "~/components/primitives/form/input-item/input-item"
import { DeleteItemButton } from "~/components/primitives/table-list"
import SaveItemButton from "~/components/primitives/table-list/action-buttons/save-item-button/save-item-button"
import Fieldset from "~/components/ui/fieldset"
import { formatDateOnyTime } from "~/lib/dayjs"
import { DailyOrderTransaction, DailyOrder } from "../daily-order.model.server"
import dotInboundChannels from "../dot-inbound-channels"
import dotPaymentMethods from "../dot-payment-methods"
import dotProducts from "../dot-products"
import { Label } from "~/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { useState } from "react"

interface TransactionFormProps {
    dailyOrderId?: DailyOrder["id"] | null
    transaction?: DailyOrderTransaction
    operatorId?: number | null
    // layout props
    showLabels?: boolean
    ghost?: boolean
    smallText?: boolean
    action?: "create" | "update" | "soft-delete",
    saveActionName: "daily-orders-transaction-create" | "daily-orders-transaction-update",
    showDeleteButton?: boolean

}

export default function TransactionForm({
    dailyOrderId,
    transaction,
    operatorId = null,
    showLabels = true,
    ghost = false,
    smallText = false,
    saveActionName,
    showDeleteButton = false,
}: TransactionFormProps) {

    const [isMotoRequired, setIsMotoRequired] = useState(false)

    // if the transaction is undefined, this means that the form is used to add a new transaction
    // otherwise it is used to update the order
    const transactionFormState = transaction === undefined ? "new" : "update"



    const productsSelection = dotProducts()
    const inboundChannelsSelection = dotInboundChannels()
    const paymentMethodsSelection = dotPaymentMethods()

    return (

        <>
            <InputItem type="hidden" name="dailyOrderId" defaultValue={dailyOrderId || null} />
            <InputItem type="hidden" name="transactionId" defaultValue={transaction?.id || ""} />
            <InputItem type="hidden" name="operatorId" defaultValue={operatorId || null} />
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
                    <Select name="isMotoRequired" defaultValue={transaction?.isMotoRequired === true ? "Sim" : "Não" || "Sim"}
                        onValueChange={(value) => {
                            if (value === "Sim") setIsMotoRequired(true)
                            if (value === "Não") setIsMotoRequired(false)
                        }}
                    >
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
                    defaultValue={transaction?.amountMotoboy}
                    disabled={(transactionFormState === "new" && !isMotoRequired) || (transactionFormState === "update" && !transaction?.isMotoRequired)}
                />

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