import { Link, Outlet } from '@remix-run/react';
import { ChevronLeft, PlusCircle } from 'lucide-react';
import Container from '~/components/layout/container/container';

export default function AdminImportStockMovementsOutlet() {
  return (
    <Container fullWidth className="mt-12 px-4">
      <div className="flex flex-col gap-6">
        <section className="space-y-5 border-b border-slate-200/80 pb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Link
                to="/admin/import-stock-movements"
                className="inline-flex items-center gap-1.5 font-semibold text-slate-700 transition hover:text-slate-950"
              >
                <span className="flex size-5 items-center justify-center rounded-full border border-slate-200 text-slate-500">
                  <ChevronLeft size={12} />
                </span>
                voltar
              </Link>
              <span className="text-slate-300">/</span>
              <span className="font-medium text-slate-900">importação de movimentações</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/admin/global-cost-history"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Histórico global de custos
              </Link>
              <Link
                to="/admin/stock-movements"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Ver movimentações
              </Link>
              <Link
                to="new"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-black px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                <PlusCircle size={15} />
                Nova importação
              </Link>
            </div>
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Importação de movimentações de estoque</h1>
            <p className="max-w-3xl text-sm text-slate-500">
              Gerencie lotes de importação de entradas de estoque, acompanhe o que já foi aplicado em visão global e abra um lote específico para revisar as linhas antes da importação.
            </p>
          </div>
        </section>

        <Outlet />
      </div>
    </Container>
  );
}
