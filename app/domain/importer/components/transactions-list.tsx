import dayjs from "dayjs";
import { OfxRawTransaction } from "../ofx-parser";

export default function TransactionsList({ transactions }: { transactions: OfxRawTransaction[] }) {

    if (transactions.length === 0) {
        return <p className="text-sm text-muted-foreground">Nenhuma transação encontrada.</p>;
    }

    return (
        <div className='max-h-[650px] overflow-auto px-4'>
            <table className="min-w-full border-collapse border border-gray-400">
                <thead>
                    <tr>
                        <th className="border p-2 font-semibold text-xs">Tipo</th>
                        <th className="border p-2 font-semibold text-xs">Data</th>
                        <th className="border p-2 font-semibold text-xs">Valor</th>
                        <th className="border p-2 font-semibold text-xs">Descrição</th>
                    </tr>
                </thead>
                <tbody>
                    {transactions.map((transaction, index) => (
                        <tr key={index}>
                            <td className="border p-2 text-xs">{transaction.type}</td>
                            <td className="border p-2 text-xs">{dayjs(transaction.date).format("DD/MM/YYYY")}</td>
                            <td className="border p-2 text-xs">{transaction.amount}</td>
                            <td className="border p-2 text-xs">{transaction.description}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )

}