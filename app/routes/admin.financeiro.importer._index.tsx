import React, { useState } from 'react';
import { Dialog, DialogContent, DialogTrigger } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { OfxParser, OfxRawTransaction } from '~/domain/importer/ofx-parser';
import { NotificationImporterRenderer, IImporterNotification } from '~/domain/importer/components/notification-importer-rendered';
import { Button } from '~/components/ui/button';
import { Link, redirect, useActionData, useFetcher } from '@remix-run/react';
import { jsonParse, jsonStringify } from '~/utils/json-helper';
import { LoaderFunctionArgs } from '@remix-run/node';
import { HttpResponse, badRequest, ok } from '~/utils/http-response.server';
import { prismaIt } from '~/lib/prisma/prisma-it.server';
import { bankTransactionImporterEntity } from '~/domain/importer/bank-transaction-importer.entity.server';
import { toast } from '~/components/ui/use-toast';



export async function action({ request }: LoaderFunctionArgs) {
    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    if (_action === "import-bank-statement") {
        const records = jsonParse(values.data as string)

        if (!records) {
            return badRequest("Nenhum registro encontrado")
        }

        const [err, result] = await prismaIt(bankTransactionImporterEntity.importMany(records))

        if (err) {
            return badRequest(err)
        }

        return redirect("process")
    }

    return null
}

export default function BankStatementIndexPage() {
    const [transactions, setTransactions] = useState<OfxRawTransaction[]>([]);

    const [notification, setNotification] = useState<IImporterNotification>({
        status: "idle",
        message: "Aguardando arquivo",
    });
    const [parseErrorTagsRendered, setParseErrorTagsRendered] = useState<string[]>([]);


    const fetcher = useFetcher({
        key: "import-bank-statement",
    });

    const actionData = fetcher.data as any

    if (actionData && actionData.status > 399) {
        toast({
            title: "Erro",
            description: actionData.message,
            variant: "destructive",
        })
    }



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
            message: `Arquivo lido. ${result.length} transações encontradas.`,
        });

    };



    const submitData = () => {
        setNotification({
            status: "submitting",
            message: "Importando transações.",
        })
        fetcher.submit({
            data: jsonStringify(transactions) as string,
            _action: "import-bank-statement",
        }, { method: "post" })
    }



    return (
        <div className="flex flex-col gap-4">
            <h3 className="text-4xl text-muted-foreground mb-6 text-center">
                Importar arquivo OFX
            </h3>
            <div className="flex flex-col mx-48 ">

                <Input
                    type="file"
                    accept=".ofx"
                    onChange={handleFileUpload}
                    className='mb-4'
                />
                <Button onClick={submitData}
                    className='mb-4'
                    disabled={transactions.length === 0 || notification.status === "submitting"}
                >Importar</Button>
                <div className="flex flex-col">
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
                <div className='flex justify-between items-center mb-36'>
                    <NotificationImporterRenderer status={notification.status} message={notification.message} />
                    <div className="flex flex-col gap-4">

                        <Dialog >
                            <DialogTrigger asChild className="w-full">
                                <span className='text-sm underline cursor-pointer'>
                                    Mostrar transações
                                </span>
                            </DialogTrigger>
                            <DialogContent>
                                <TransactionsList transactions={transactions} />
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            </div >



        </div>
    );
}

function TransactionsList({ transactions }: { transactions: OfxRawTransaction[] }) {

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
                            <td className="border p-2 text-xs">{transaction.date}</td>
                            <td className="border p-2 text-xs">{transaction.amount}</td>
                            <td className="border p-2 text-xs">{transaction.description}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )

}