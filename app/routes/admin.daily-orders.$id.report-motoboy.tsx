import { useOutletContext } from "@remix-run/react";
import { DailyOrderQuickStat, DailyOrderSingleOutletContext } from "./admin.daily-orders.$id";
import { DailyOrder } from "~/domain/daily-orders/daily-order.model.server";
import randomReactKey from "~/utils/random-react-key";
import { Table, TableTitles, TableRows, TableRow } from "~/components/primitives/table-list";


export default function DailyOrderSingleReportMotoboy() {
    const outletContext = useOutletContext<DailyOrderSingleOutletContext>()
    const dailyOrder = outletContext?.dailyOrder as DailyOrder | undefined

    const transactions = dailyOrder?.transactions || []

    const motoboyTransactions = transactions.filter(t => t.deletedAt === null && t.isMotoRequired === true)

    return (
        <div className="flex flex-col gap-4">
            <div className="p-6 md:max-w-lg border rounded-lg">
                <div className="flex flex-col gap-4">
                    <DailyOrderQuickStat label={"Total Valor Motoboy"} value={dailyOrder?.totalMotoboyAmount || 0} />
                    <DailyOrderQuickStat label={"Numero de pedidos"} value={motoboyTransactions.length || 0} decimalsAmount={0} />
                </div>
            </div>
            <div className="md:max-w-xl">
                <h4 className="text-sm font-semibold mb-2">Elenco pedidos</h4>
                <Table>
                    <TableTitles
                        className="grid-cols-3 md:max-w-xl"
                        titles={[
                            "Comanda",
                            "Valor",
                            "Valor Motoboy",
                        ]}
                    />
                    <TableRows >
                        {motoboyTransactions.map(t => {

                            const amountMotoboy = Number(t.amountMotoboy)
                            const amountMotoboyDecimal = amountMotoboy.toFixed(2)




                            return (
                                <TableRow
                                    key={t?.id || randomReactKey()}
                                    row={t}
                                    showDateColumns={false}
                                    className="md:max-w-xl"
                                >
                                    <div className="grid grid-cols-3 w-full justify-items-center">
                                        <span>{t.orderNumber}</span>
                                        <span>{Number(t.amount) ? t.amount.toFixed(2) : t.amount}</span>
                                        <span>{Number(t.amountMotoboy) ? t.amountMotoboy.toFixed(2) : t.amountMotoboy}</span>
                                    </div>


                                </TableRow>


                            )
                        })}
                    </TableRows>
                </Table >



            </div>
        </div>

    )
}