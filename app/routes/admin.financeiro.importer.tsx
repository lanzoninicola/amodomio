import { Outlet } from '@remix-run/react';
import { useState } from 'react';
import Container from '~/components/layout/container/container';
import { toast } from '~/components/ui/use-toast';
import { OfxRawTransaction } from '~/domain/importer/ofx-parser';





export default function BankStatementImporterPage() {
    return (
        <Container>
            <div className='flex flex-col gap-4'>
                <h1 className="text-2xl font-bold mb-16">Importador de Extrato Bancário</h1>
                <Outlet />
                {/* <div className='border rounded-md p-4 grid grid-cols-8 items-center'>
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
                </div> */}

            </div>
        </Container>
    )
}












