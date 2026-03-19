import { Link, useOutletContext } from "@remix-run/react";
import type { AdminItemVendaOutletContext } from "./admin.items.$id.venda";

function formatPercent(value: number) {
  return `${Number(value || 0).toFixed(2)}%`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

export default function AdminItemVendaCanaisRoute() {
  const { channels, linkedMenuItems } = useOutletContext<AdminItemVendaOutletContext>();

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {channels.map((channel) => (
          <section key={channel.key} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{channel.name}</h3>
                <p className="mt-1 text-xs text-slate-600">{channel.description}</p>
              </div>
              <span
                className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                  channel.isConfigured ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                }`}
              >
                {channel.isConfigured ? "Configurado" : "Sem cadastro"}
              </span>
            </div>

            <dl className="mt-4 space-y-2 text-sm text-slate-700">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Chave</dt>
                <dd className="font-mono text-xs uppercase">{channel.key}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Nome no banco</dt>
                <dd className="text-right">{channel.dbName || "-"}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Taxa fixa</dt>
                <dd>{formatCurrency(channel.feeAmount)}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Taxa %</dt>
                <dd>{formatPercent(channel.taxPerc)}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Pagamento online</dt>
                <dd>{formatPercent(channel.onlinePaymentTaxPerc)}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Margem alvo</dt>
                <dd>{formatPercent(channel.targetMarginPerc)}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Tipo</dt>
                <dd>{channel.isMarketplace ? "Marketplace" : "Canal direto"}</dd>
              </div>
            </dl>
          </section>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Menu items vinculados</h2>
            <p className="text-sm text-slate-600">{linkedMenuItems.length} vínculo(s) que podem expor preço público.</p>
          </div>
          <Link to="../precos" className="text-sm underline">
            Ver preços públicos
          </Link>
        </div>

        <div className="mt-4 space-y-2">
          {linkedMenuItems.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum menu item vinculado a este item.</p>
          ) : (
            linkedMenuItems.map((menuItem) => (
              <div key={menuItem.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 p-3">
                <div>
                  <div className="font-medium text-slate-900">{menuItem.name}</div>
                  <div className="text-xs text-slate-500">{menuItem.id}</div>
                </div>
                <div className="flex gap-2 text-[11px] font-semibold uppercase tracking-wide">
                  <span className={`rounded-full px-2 py-1 ${menuItem.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                    {menuItem.active ? "Ativo" : "Inativo"}
                  </span>
                  <span className={`rounded-full px-2 py-1 ${menuItem.visible ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                    {menuItem.visible ? "Visível" : "Oculto"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
