import { LoaderFunctionArgs } from '@remix-run/node';
import { useActionData, useFetcher } from '@remix-run/react';
import React, { Dispatch, SetStateAction, useState } from 'react';
import Container from '~/components/layout/container/container';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { toast } from '~/components/ui/use-toast';
import { bankTransactionImporterEntity } from '~/domain/bank-transaction-importer/bank-transaction-importer.entity.server';
import { OfxParser, OfxRawTransaction } from '~/domain/bank-transaction-importer/ofx-parser';
import { prismaIt } from '~/lib/prisma/prisma-it.server';
import { cn } from '~/lib/utils';
import { badRequest, ok } from '~/utils/http-response.server';
import { jsonParse, jsonStringify } from '~/utils/json-helper';

interface IImporterNotification {
    status: 'idle' | 'success' | 'error' | 'submitting'
    message: string | null
}

export async function action({ request }: LoaderFunctionArgs) {
    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    if (_action === "import") {
        const records = jsonParse(values.data as string)

        if (!records) {
            return badRequest("Nenhum registro encontrado")
        }

        const [err, result] = await prismaIt(bankTransactionImporterEntity.importMany(records))

        console.log({ err, result })

        if (err) {
            return badRequest(err)
        }

        return ok({
            result: result,
        })
    }

    return null
}

export default function BankStatementImporterPage() {
    const [transactions, setTransactions] = useState<OfxRawTransaction[]>([]);


    const actionData = useActionData<typeof action>()
    const status = actionData?.status
    const message = actionData?.message

    if (status && status === 200) {
        toast({
            title: "OK",
            description: message,
        })
    }

    if (status && status !== 200) {
        toast({
            title: "Erro",
            description: message,
        })
    }

    return (
        <Container>
            <div className='flex flex-col gap-4'>
                <h1 className="text-2xl font-bold mb-6">Importador de Extrato Bancário</h1>
                <div className='border rounded-md p-4 grid grid-cols-8 items-center'>
                    <span className="font-semibold col-span-3 text-lg">1. Seleçionar o arquivo</span>
                    <div className="col-span-5">
                        <BankStatementUploader
                            transactions={transactions}
                            setTransactions={setTransactions}
                        />
                    </div>
                </div>
                <div className='border rounded-md p-4 grid grid-cols-8 items-center'>
                    <span className="font-semibold col-span-3 text-lg">2. Importar transações</span>
                    <div className="col-span-5">
                        <BankStatementImporter transactions={transactions} />
                    </div>
                </div>

                <div className='border rounded-md p-4 grid grid-cols-8 items-center'>
                    <span className="font-semibold col-span-3 text-lg">3. Processar</span>
                    <div className="col-span-5">

                    </div>
                </div>

            </div>
        </Container>
    )
}

interface BankStatementUploaderProps {
    transactions: OfxRawTransaction[]
    setTransactions: (transactions: OfxRawTransaction[]) => void
}

function BankStatementUploader({ transactions, setTransactions }: BankStatementUploaderProps) {
    const [notification, setNotification] = useState<IImporterNotification>({
        status: "idle",
        message: "Aguardando arquivo",
    });
    const [parseErrorTagsRendered, setParseErrorTagsRendered] = useState<string[]>([]);

    const actionData = useActionData<typeof action>()
    const status = actionData?.status
    const message = actionData?.message

    if (status && status === 200) {
        toast({
            title: "OK",
            description: message,
        })
    }

    if (status && status !== 200) {
        toast({
            title: "Erro",
            description: message,
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

    return (
        <div className="flex flex-col">
            <Input
                type="file"
                accept=".ofx"
                onChange={handleFileUpload}
                className='mb-4'
            />

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
            <div className='flex justify-between items-center'>
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
    );
}


interface BankStatementImporterProps {
    transactions: OfxRawTransaction[]
}

function BankStatementImporter({ transactions }: BankStatementImporterProps) {
    const [notification, setNotification] = useState<IImporterNotification>({
        status: "idle",
        message: "Aguardando o submissão.",
    });

    const fetcher = useFetcher({
        key: "importer-bank-statement",
    });

    const submitData = () => {
        setNotification({
            status: "submitting",
            message: "Transações importadas.",
        })
        fetcher.submit({
            data: jsonStringify(transactions) as string,
            _action: "import",
        }, { method: "post" })
    }

    return (
        <div className='flex flex-col gap-4'>
            <Button onClick={submitData}
                disabled={transactions.length === 0}
            >Importar</Button>
            <NotificationImporterRenderer status={notification.status} message={notification.message} />
        </div>

    )
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


interface NotificationImporterProps extends IImporterNotification {
}

function NotificationImporterRenderer({ status, message }: NotificationImporterProps) {
    return (
        <div className="flex gap-4 items-center ">
            <span className="font-semibold text-sm">Status:</span>
            <span className={
                cn(
                    "font-semibold text-sm",
                    status === "error" && "text-red-500",
                    status === "success" && "text-green-500",
                    (status === "idle" || status === "submitting") && "text-gray-500",
                )
            }>{message}</span>
        </div>
    )
}
