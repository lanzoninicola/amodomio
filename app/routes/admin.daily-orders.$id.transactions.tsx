import { useNavigation, Form, useOutletContext } from "@remix-run/react"
import { Table, TableTitles, TableRows, TableRow } from "~/components/primitives/table-list"
import { DOTInboundChannel, DOTOperator, DOTPaymentMethod, DOTProduct, DailyOrder, DailyOrderTransaction } from "~/domain/daily-orders/daily-order.model.server"
import { DailyOrderSingleOutletContext } from "./admin.daily-orders.$id"
import TransactionForm from "~/domain/daily-orders/components/transaction-form"
import randomReactKey from "~/utils/random-react-key"
import { LoaderArgs, redirect } from "@remix-run/node"
import { dailyOrderEntity } from "~/domain/daily-orders/daily-order.entity.server"
import dotOperators from "~/domain/daily-orders/dot-operators"
import { serverError, ok } from "~/utils/http-response.server"
import tryit from "~/utils/try-it"

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

        return redirect(`/admin/daily-orders/${values.dailyOrderId}/transactions`)
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





    return null


}

export default function DailyOrderSingleTransactions() {
    const outletContext = useOutletContext<DailyOrderSingleOutletContext>()
    const dailyOrder = outletContext?.dailyOrder as DailyOrder | undefined
    const operatorId = outletContext?.operatorId || null
    const transactions = dailyOrder?.transactions || []
    const activeTransactions = transactions.filter(t => t.deletedAt === null)

    const navigation = useNavigation()

    return (
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
                {activeTransactions.sort((a, b) => {
                    // sort desc by date
                    if (a?.createdAt > b?.createdAt) return -1

                    if (a?.createdAt < b?.createdAt) return 1

                    return 0; // Handle undefined values, placing them at an arbitrary position
                }).map(t => {

                    return (


                        <TableRow
                            key={t?.id || randomReactKey()}
                            row={t}
                            isProcessing={navigation.state !== "idle"}
                            showDateColumns={false}
                        >

                            <Form method="post" className="grid grid-cols-9">

                                <TransactionForm
                                    dailyOrderId={dailyOrder?.id || null}
                                    transaction={t}
                                    showLabels={false}
                                    ghost={true}
                                    smallText={true}
                                    saveActionName="daily-orders-transaction-update"
                                    showDeleteButton={true}
                                    operatorId={operatorId}
                                />

                            </Form>
                        </TableRow>


                    )
                })}
            </TableRows>
        </Table >


    )
}

