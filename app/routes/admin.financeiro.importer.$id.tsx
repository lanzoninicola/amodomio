import { ImportSessionRecordBankTransaction } from "@prisma/client";
import { LoaderFunctionArgs, defer } from "@remix-run/node";
import { Await, useLoaderData } from "@remix-run/react";
import dayjs from "dayjs";
import { Suspense } from "react";
import { bankTransactionImporterEntity } from "~/domain/importer/bank-transaction-importer.entity.server";
import getSearchParam from "~/utils/get-search-param";
import { lastUrlSegment } from "~/utils/url";


export async function loader({ request }: LoaderFunctionArgs) {

    const id = lastUrlSegment(request.url)

    if (!id) {
        return defer({ importSession: null })
    }

    const importSession = bankTransactionImporterEntity.findBySessionId(id);

    return defer({ importSession })
}


export default function SingleFinanceImporter() {
    const { importSession } = useLoaderData<typeof loader>();


    return (

        <div className="flex flex-col gap-4">
            <h1 className="text-xl font-semibold">Detalhes das importação</h1>
            <Suspense fallback={<span>Carregando...</span>}>

                <Await resolve={importSession}>
                    {(is) => {

                        if (!is) {
                            return <p className="text-sm text-muted-foreground">Nenhuma sessão encontrada.</p>;
                        }

                        return (

                            <div>
                                {/* @ts-ignore */}
                                {/* <p className="text-sm text-muted-foreground">Esta sessão foi criada em {dayjs(is.createdAt).format("DD/MM/YYYY HH:mm")}</p> */}

                                {
                                    is && (
                                        // @ts-ignore
                                        <ImportSessionsList importBankTransactions={is.ImportSessionRecordBankTransaction} />
                                    )
                                }
                            </div>
                        )
                    }}
                </Await>
            </Suspense>
        </div>
    )
}

function ImportSessionsList({ importBankTransactions }: { importBankTransactions: ImportSessionRecordBankTransaction[] }) {

    if (importBankTransactions.length === 0) {
        return <p className="text-sm text-muted-foreground">Nenhuma transação encontrada.</p>;
    }

    return (
        <table className="table table-zebra w-full">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Data</th>
                    <th>Valor</th>
                    <th>Descricão</th>
                </tr>
            </thead>
            <tbody>
                {importBankTransactions.map((importBankTransaction, index) => (
                    <tr key={importBankTransaction.id}>
                        <td>{index + 1}</td>
                        <td>{dayjs(importBankTransaction.createdAt).format("DD/MM/YYYY HH:mm")}</td>
                        <td>{importBankTransaction.amount}</td>
                        <td>{importBankTransaction.description}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    )
}