import { LoaderFunctionArgs } from '@remix-run/node';
import { useFetcher, useLoaderData } from '@remix-run/react';
import dayjs from 'dayjs';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Separator } from '~/components/ui/separator';
import { IImporterNotification, NotificationImporterRenderer } from '~/domain/importer/components/notification-importer-rendered';
import TransactionsList from '~/domain/importer/components/transactions-list';
import { OfxRawTransaction } from '~/domain/importer/ofx-parser';
import prismaClient from '~/lib/prisma/client.server';
import { ok } from '~/utils/http-response.server';
import { jsonStringify } from '~/utils/json-helper';

export async function loader({ request }: LoaderFunctionArgs) {

    const transactions = await prismaClient.importBankTransaction.findMany()

    return ok({ transactions })

}

export default function BankStatementProcessPage() {
    const loaderData = useLoaderData<typeof loader>()
    const transactions = loaderData.payload?.transactions || []

    const [notification, setNotification] = useState<IImporterNotification>({
        status: "idle",
        message: "Aguardando o submissão.",
    });

    const fetcher = useFetcher({
        key: "process-bank-statement",
    });

    const submispanata = () => {
        // setNotification({
        //     status: "submitting",
        //     message: "Transações importadas.",
        // })
        // fetcher.submit({
        //     data: jsonStringify(transactions) as string,
        //     _action: "indexing",
        // }, { method: "post" })
    }

    console.log({ transactions })

    return (
        <div className='flex flex-col gap-4'>
            <Button onClick={submispanata}
                disabled={transactions.length === 0}
            >Indicizar</Button>
            <NotificationImporterRenderer status={notification.status} message={notification.message} />
            <Separator className='my-4' />
            <div className='mb-24'>
                <h2 className='text-xl font-semibold mb-4'>Transações</h2>
                <div className='grid grid-cols-5 gap-1'>
                    <span className="border p-2 font-semibold text-xs">Tipo</span>
                    <span className="border p-2 font-semibold text-xs">Data</span>
                    <span className="border p-2 font-semibold text-xs">Valor</span>
                    <span className="border p-2 font-semibold text-xs">Descrição</span>
                    <span className="border p-2 font-semibold text-xs">Conta</span>
                </div>

                {transactions.map((transaction: OfxRawTransaction, index: number) => (
                    <div className='grid grid-cols-5  gap-1'>
                        <span className="border p-2 text-xs">{transaction.type}</span>
                        <span className="border p-2 text-xs">{dayjs(transaction.date).format("DD/MM/YYYY")}</span>
                        <span className="border p-2 text-xs">{transaction.amount}</span>
                        <span className="border p-2 text-xs">{transaction.description}</span>
                        <div className="border p-2 text-xs">
                            <Select name="sub-categories" required>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecionar..." />
                                </SelectTrigger>
                                <SelectContent >
                                    <SelectGroup >
                                        <SelectItem value="1">Conta Corrente</SelectItem>
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                ))}
            </div>
        </div>

    )

}