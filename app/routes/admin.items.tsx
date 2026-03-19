import { Link, Outlet } from "@remix-run/react";
import { ChevronLeft, PlusCircle } from "lucide-react";
import Container from "~/components/layout/container/container";

export default function AdminItemsOutlet() {
  return (
    <Container fullWidth className="mt-12 px-4">
      <div className="flex flex-col gap-6">
        <section className="space-y-5 border-b border-slate-200/80 pb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Link
                to="/admin/items"
                className="inline-flex items-center gap-1.5 font-semibold text-slate-700 transition hover:text-slate-950"
              >
                <span className="flex size-5 items-center justify-center rounded-full border border-slate-200 text-slate-500">
                  <ChevronLeft size={12} />
                </span>
                voltar
              </Link>
              <span className="text-slate-300">/</span>
              <span className="font-medium text-slate-900">itens</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/admin/import-stock-nf"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Importar movimentação NF
              </Link>
              <Link
                to="new"
                reloadDocument
                className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-black px-4 text-sm font-semibold text-white transition hover:bg-blue-500"
              >
                <PlusCircle size={15} />
                Novo item
              </Link>
            </div>
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Itens</h1>
            <p className="max-w-3xl text-sm text-slate-500">
              Cadastro operacional de insumos, semiacabados, produtos finais e suas relações com custo, venda e compra.
            </p>
          </div>
        </section>

        <Outlet />
      </div>
    </Container>
  );
}
