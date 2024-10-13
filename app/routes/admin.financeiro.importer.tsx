import { Outlet } from '@remix-run/react';
import Container from '~/components/layout/container/container';



export default function BankStatementImporterPage() {
    return (
        <Container>
            <div className='flex flex-col gap-4'>
                <h1 className="text-2xl font-bold mb-16">Importações do Extrato Bancário</h1>
                <Outlet />
            </div>
        </Container>
    )
}












