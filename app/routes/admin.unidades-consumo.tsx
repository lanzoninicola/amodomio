import { Link, Outlet } from "@remix-run/react";
import { ChevronLeft } from "lucide-react";
import Container from "~/components/layout/container/container";

export default function AdminUnidadesConsumoOutlet() {
  return (
    <Container fullWidth className=" px-4">
      <div className="flex flex-col gap-6">
        <section className="space-y-5 border-b border-slate-200/80 pb-5">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link
              to="/admin"
              className="inline-flex items-center gap-1.5 font-semibold text-slate-700 transition hover:text-slate-950"
            >
              <span className="flex size-5 items-center justify-center rounded-full border border-slate-200 text-slate-500">
                <ChevronLeft size={12} />
              </span>
              voltar
            </Link>
            <span className="text-slate-300">/</span>
            <span className="font-medium text-slate-900">unidades de consumo</span>
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Unidades de consumo</h1>
            <p className="max-w-3xl text-sm text-slate-500">
              Cadastro de unidades, visibilidade por item e conversões base entre medidas.
            </p>
          </div>
        </section>

        <Outlet />
      </div>
    </Container>
  );
}
