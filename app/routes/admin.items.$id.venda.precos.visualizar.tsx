import { useOutletContext } from "@remix-run/react";
import type { AdminItemVendaPrecosOutletContext } from "./admin.items.$id.venda.precos";

function formatCurrency(value: number | null | undefined) {
  if (value == null) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

export default function AdminItemVendaPrecosVisualizarRoute() {
  const { channels, sellingMatrix } = useOutletContext<AdminItemVendaPrecosOutletContext>();
  const publication = sellingMatrix[0] || null;
  const enabledChannels = channels.filter((channel) => channel.enabledForItem);

  return (
    <div className="space-y-4">
      {!publication ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Item não encontrado.</div>
      ) : enabledChannels.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Nenhum canal habilitado para este item. Vá em `Canais` para introduzi-lo em pelo menos um canal.
        </div>
      ) : (
          <section key={publication.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="mt-1 text-base font-semibold text-slate-900">{publication.name}</div>
                <div className="text-xs text-slate-500">{publication.id}</div>
                <div className="mt-2 text-xs text-slate-500">Fonte: Item</div>
              </div>
              <div className="flex gap-2 text-[11px] font-semibold uppercase tracking-wide">
                <span className={`rounded-full px-2 py-1 ${publication.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                  {publication.active ? "Ativo" : "Inativo"}
                </span>
                <span className={`rounded-full px-2 py-1 ${publication.visible ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                  {publication.visible ? "Visível" : "Oculto"}
                </span>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0 text-sm">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-white px-3 py-2 text-left font-semibold text-slate-700">Variação</th>
                    {enabledChannels.map((channel) => (
                      <th key={channel.key} className="px-3 py-2 text-left font-semibold text-slate-700">
                        <div>{channel.name}</div>
                        <div className="text-[11px] font-normal uppercase tracking-wide text-slate-400">{channel.key}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {publication.variations.length === 0 ? (
                    <tr>
                      <td colSpan={enabledChannels.length + 1} className="px-3 py-4 text-slate-500">
                        Nenhuma variação nativa encontrada para este item.
                      </td>
                    </tr>
                  ) : (
                    publication.variations.map((variation) => (
                      <tr key={variation.id}>
                        <td className="sticky left-0 border-t border-slate-100 bg-white px-3 py-3 align-top">
                          <div className="font-medium text-slate-900">{variation.name}</div>
                          <div className="text-xs text-slate-500">{variation.fullName}</div>
                        </td>
                        {enabledChannels.map((channel) => {
                          const priceRecords = variation.channels[channel.key] || [];

                          return (
                            <td key={channel.key} className="border-t border-slate-100 px-3 py-3 align-top">
                              {priceRecords.length > 0 ? (
                                <div className="space-y-2">
                                  {priceRecords.map((priceRecord) => {
                                    const isPublic = Boolean(priceRecord.showOnCardapio);

                                    return (
                                      <div key={priceRecord.id} className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-2">
                                        <div className={`font-semibold ${isPublic ? "text-slate-900" : "text-slate-400"}`}>
                                          {formatCurrency(priceRecord.priceAmount)}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                          {isPublic ? "Publicado" : "Nao publico"}
                                        </div>
                                        <div className="mt-1 text-[11px] text-slate-400">Origem: Item</div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400">Sem preço</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
      )}
    </div>
  );
}
