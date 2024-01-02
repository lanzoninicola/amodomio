import { useNavigation, Form, useOutletContext } from "@remix-run/react"
import { Table, TableTitles, TableRows, TableRow } from "~/components/primitives/table-list"
import { DailyOrder, DailyOrderTransaction } from "~/domain/daily-orders/daily-order.model.server"
import { DailyOrderSingleOutletContext } from "./admin.daily-orders.$id"
import TransactionForm from "~/domain/daily-orders/components/transaction-form"
import randomReactKey from "~/utils/random-react-key"


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

