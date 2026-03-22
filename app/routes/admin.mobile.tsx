import { Link, Outlet, useLocation } from "@remix-run/react";
import { CalendarDays, Camera, Images, Package, Pizza, ReceiptText, Search } from "lucide-react";

export default function AdminMobileLayout() {
  const { pathname } = useLocation();
  const isHome = pathname === "/admin/mobile";
  const isEstoque = pathname.startsWith("/admin/mobile/estoque-massa");
  const isProgramacao = pathname.startsWith("/admin/mobile/programacao-diaria");
  const isAssetsBatch = pathname.startsWith("/admin/mobile/cardapio-assets-batch");
  const isCosts = pathname.startsWith("/admin/mobile/custos");
  const isItemCostSurvey = pathname.startsWith("/admin/mobile/levantamento-custo-item");
  const isStockPhotoEntry = pathname.startsWith("/admin/mobile/entrada-estoque-foto");
  const isImportStockMovementsBatch = pathname.startsWith("/admin/mobile/import-stock-movements");
  const pageTitle = isEstoque
    ? "Estoque de massa"
    : isProgramacao
      ? "Programação diária"
      : isAssetsBatch
        ? "Assets do cardápio"
        : isImportStockMovementsBatch
          ? "Lote de estoque"
        : isStockPhotoEntry
          ? "Entrada por foto"
        : isItemCostSurvey
          ? "Levantamento de custo"
        : isCosts
          ? "Consulta de custos"
        : "Atalhos";

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

            <Link
              to="/admin/mobile/cardapio-assets-batch"
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <Images className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-900">Assets do cardápio</span>
                <span className="block text-xs text-slate-600">Upload e organização de capa/galeria</span>
              </span>
            </Link>

            <Link
              to="/admin/mobile/custos"
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                <Search className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-900">Consulta de custos</span>
                <span className="block text-xs text-slate-600">Buscar produto e ver custos por fornecedor</span>
              </span>
            </Link>

            <Link
              to="/admin/mobile/levantamento-custo-item"
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-orange-700">
                <ReceiptText className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-900">Levantamento de custo</span>
                <span className="block text-xs text-slate-600">Registrar custo observado de um item</span>
              </span>
            </Link>

            <Link
              to="/admin/mobile/entrada-estoque-foto"
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <Camera className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-900">Entrada por foto</span>
                <span className="block text-xs text-slate-600">Estruturar cupom ou documento fiscal com ChatGPT e criar lote</span>
              </span>
            </Link>

            <Link
              to="/admin/mobile/import-stock-movements"
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
                <Package className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-900">Importação de estoque</span>
                <span className="block text-xs text-slate-600">Abrir lote e resolver pendências no celular</span>
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
