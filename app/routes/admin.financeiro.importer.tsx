import dayjs from 'dayjs';
import React, { useState } from 'react';
import { OfxParser, OfxTransaction } from '~/domain/ofx/ofx-parser';
import { cn } from '~/lib/utils';

export default function BankStatementImporter() {
    const [transactions, setTransactions] = useState<OfxTransaction[]>([]);
    const [notification, setNotification] = useState<any>({
        status: "idle",
        message: "Aguardando arquivo",
    });

    const [parseErrorTagsRendered, setParseErrorTagsRendered] = useState<string[]>([]);




    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const fileText = await file.text();

        const [err, result] = OfxParser.getTransactions(fileText);

        if (err) {
            setNotification({
                status: "error",
                message: err.message,
            });
            return;
        }

        if (!result) {
            setNotification({
                status: "error",
                message: "Nenhum arquivo encontrado.",
            });
            return;
        }


        setTransactions(result);
        setNotification({
            status: "success",
            message: "Arquivo lido.",
        });
    };

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">Importador de Extrato Bancário</h1>

            <input
                type="file"
                accept=".ofx"
                onChange={handleFileUpload}
                className="mb-4"
            />

            <div className="flex flex-col mb-4">
                {parseErrorTagsRendered.length > 0 && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative font-mono text-xs" role="alert">
                        <strong className="font-bold">Atenção!</strong>
                        <ul>
                            {parseErrorTagsRendered.map((tag, index) => (
                                <li key={index}>{tag}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
            <div className="flex gap-4 items-center">
                <span className="font-semibold text-sm">Status:</span>
                <span className={
                    cn(
                        "font-semibold text-sm",
                        notification.status === "error" && "text-red-500",
                        notification.status === "success" && "text-green-500",
                        notification.status === "idle" && "text-gray-500",
                    )
                }>{notification.message}</span>
            </div>

            {transactions.length > 0 && (
                <table className="min-w-full border-collapse border border-gray-400">
                    <thead>
                        <tr>
                            <th className="border p-2">Tipo</th>
                            <th className="border p-2">Data</th>
                            <th className="border p-2">Valor</th>
                            <th className="border p-2">Descrição</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transactions.map((transaction, index) => (
                            <tr key={index}>
                                <td className="border p-2">{transaction.type}</td>
                                <td className="border p-2">{transaction.date}</td>
                                <td className="border p-2">{transaction.amount}</td>
                                <td className="border p-2">{transaction.description}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}
