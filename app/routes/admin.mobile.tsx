import { Link, Outlet, useLocation } from "@remix-run/react";
import { CalendarDays, Pizza } from "lucide-react";

export default function AdminMobileLayout() {
  const { pathname } = useLocation();
  const isHome = pathname === "/admin/mobile";
  const isEstoque = pathname.startsWith("/admin/mobile/estoque-massa");
  const isProgramacao = pathname.startsWith("/admin/mobile/programacao-diaria");
  const pageTitle = isEstoque ? "Estoque de massa" : isProgramacao ? "Programação diária" : "Atalhos";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-md px-4 pb-6 pt-4">
        <header className="mb-4">
          {isHome ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Admin Mobile</p>
              <h1 className="text-xl font-bold text-slate-900">Atalhos da cozinha</h1>
            </>
          ) : (
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
              <h1 className="text-sm font-semibold text-slate-900">{pageTitle}</h1>
              <Link
                to="/admin/mobile"
                className="inline-flex items-center rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700"
              >
                Voltar
              </Link>
            </div>
          )}
        </header>

        {isHome ? (
          <main className="space-y-3">
            <Link
              to="/admin/mobile/estoque-massa"
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <Pizza className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-900">Estoque de massa</span>
                <span className="block text-xs text-slate-600">Ajustar saldo do dia</span>
              </span>
            </Link>

            <Link
              to="/admin/mobile/programacao-diaria"
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                <CalendarDays className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-900">Programação diária</span>
                <span className="block text-xs text-slate-600">Previsão de produção por tamanho</span>
              </span>
            </Link>
          </main>
        ) : (
          <main>
            <Outlet />
          </main>
        )}
      </div>
    </div>
  );
}
