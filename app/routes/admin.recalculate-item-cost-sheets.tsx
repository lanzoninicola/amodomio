import { Link, Outlet } from "@remix-run/react";
import { ChevronLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";

function HowItWorks() {
  return (
    <div className="space-y-4 text-sm text-slate-600">
      <ol className="list-decimal space-y-1.5 pl-4">
        <li>
          <strong>Filtrar</strong> fichas raiz por nome, item ou status.
        </li>
        <li>
          <strong>Selecionar</strong> as fichas desejadas na tabela. Por padrão,
          as fichas com composição já vêm marcadas.
        </li>
        <li>
          <strong>Recalcular</strong> uma ficha individualmente pelo botão na
          linha, ou recalcular em lote pelas fichas selecionadas.
        </li>
      </ol>
      <p className="text-xs text-slate-500">
        A operação recompõe componentes do tipo{" "}
        <code className="rounded bg-slate-100 px-1 font-mono">recipe</code> e{" "}
        <code className="rounded bg-slate-100 px-1 font-mono">recipeSheet</code>
        , atualiza os totais por variação e republica snapshots ativos quando
        houver mudança.
      </p>
    </div>
  );
}

export default function AdminItemCostSheetsRecalculatePage() {
  return (
    <div className="space-y-6">
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
            <span className="font-medium text-slate-900">recalcular fichas técnicas</span>
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <button
                type="button"
                className="text-sm font-medium text-blue-600 transition hover:text-blue-700 hover:underline"
              >
                Como funciona
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Como funciona o recálculo das fichas técnicas</DialogTitle>
                <DialogDescription>
                  Explicação do processo de recálculo em lote.
                </DialogDescription>
              </DialogHeader>
              <HowItWorks />
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-slate-950">
            Recalcular fichas técnicas
          </h1>
        </div>
      </section>

      <Outlet />
    </div>
  );
}
