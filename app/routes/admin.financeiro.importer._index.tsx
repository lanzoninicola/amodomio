import { Suspense } from 'react';
import { OfxRawTransaction } from '~/domain/importer/ofx-parser';
import { Await, Link, defer, useLoaderData } from '@remix-run/react';
import { LoaderFunctionArgs } from '@remix-run/node';
import { bankTransactionImporterEntity } from '~/domain/importer/bank-transaction-importer.entity.server';
import { ImportSession } from '@prisma/client';
import dayjs from 'dayjs';
import { Button } from '~/components/ui/button';



export async function loader({ request }: LoaderFunctionArgs) {

    const importSessions = bankTransactionImporterEntity.findAllSessions();

    return defer({ importSessions })
}

export async function action({ request }: LoaderFunctionArgs) {
    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);
    return null
}

export default function BankStatementIndexPage() {
    const { importSessions } = useLoaderData<typeof loader>();


    return (

        <Suspense fallback={<span>Carregando...</span>}>

            <Await resolve={importSessions}>
                {(is) => {

                    // @ts-ignore
                    return <ImportSessionsList importSessions={is ?? []} />
                }}
            </Await>
        </Suspense>
    )
}


function ImportSessionsList({ importSessions }: { importSessions: ImportSession[] }) {

    console.log({ importSessions })

    if (importSessions.length === 0) {
        return <p className="text-sm text-muted-foreground">Nenhuma sessão encontrada.</p>;
    }

    return (
        <ul className='flex flex-col gap-4'>

            {importSessions.map((importSession, index) => {
                return (
                    <li key={index}>
                        <div className='rounded-lg border grid grid-cols-3 items-center gap-4 p-4'>
                            <div className='flex flex-col'>
                                {/* @ts-ignore */}
                                <span className='font-semibold text-sm'>{importSession.ImportProfile.name}</span>
                                <span className='text-xs text-muted-foreground'>{importSession.id}</span>
                            </div>
                            <div className='flex flex-col'>
                                {/* @ts-ignore */}
                                <p className='text-sm'>Registros importados: <span className='font-semibold text-sm'>{importSession.ImportSessionRecordBankTransaction.length}</span></p>
                                <p className='text-sm'>Em data: <span className='font-semibold text-sm'>{dayjs(importSession.createdAt).format("DD/MM/YYYY HH:mm")}</span></p>
                            </div>
                            <div className='flex justify-end'>

                                <Link to={importSession.id}>
                                    <Button>
                                        <span className='text-xs font-semibold uppercase tracking-wider'>Visualizar</span>
                                    </Button>
                                </Link>
                            </div>


                        </div>
                    </li>
                )
            })}

        </ul>
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