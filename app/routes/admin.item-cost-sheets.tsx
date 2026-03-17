import { Link, Outlet } from "@remix-run/react";
import { ChevronLeft, PlusCircle } from "lucide-react";
import Container from "~/components/layout/container/container";

export default function ItemCostSheetsOutlet() {
  return (
    <Container fullWidth className="mt-12 px-4">
      <div className="flex flex-col gap-6">
        <section className="space-y-5 border-b border-slate-200/80 pb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Link
                to="/admin/item-cost-sheets"
                className="inline-flex items-center gap-1.5 font-semibold text-slate-700 transition hover:text-slate-950"
              >
                <span className="flex size-5 items-center justify-center rounded-full border border-slate-200 text-slate-500">
                  <ChevronLeft size={12} />
                </span>
                voltar
              </Link>
              <span className="text-slate-300">/</span>
              <span className="font-medium text-slate-900">fichas de custo</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="backfill"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Backfill sabores
              </Link>
              <Link
                to="new"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-black px-4 text-sm font-semibold text-white transition hover:bg-blue-500"
              >
                <PlusCircle size={15} />
                Nova ficha
              </Link>
            </div>
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Fichas de custo</h1>
            <p className="max-w-3xl text-sm text-slate-500">
              Índice das fichas vinculadas a itens, seguindo a lógica de variações definida no item vinculado.
            </p>
          </div>
        </section>

        <Outlet />
      </div>
    </Container>
  );
}
