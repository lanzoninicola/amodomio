import { useOutletContext } from "@remix-run/react";
import { buildAdminItemsMeta } from "~/domain/item/admin-items-meta";
import type { AdminItemVendaPrecosOutletContext } from "./admin.items.$id.venda.precos";

export const meta = buildAdminItemsMeta("Visualizar preços de venda");

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
        <section key={publication.id} className="">


          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-white px-3 py-2 text-left font-semibold text-slate-700">Canal</th>
                  {publication.variations.map((variation) => (
                    <th key={variation.id} className="px-3 py-2 text-left font-semibold text-slate-700">
                      <div>{variation.name}</div>
                      <div className="text-[11px] font-normal text-slate-400">{variation.fullName}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {publication.variations.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-3 py-4 text-slate-500">
                      Nenhuma variação nativa encontrada para este item.
                    </td>
                  </tr>
                ) : (
                  enabledChannels.map((channel) => (
                    <tr key={channel.key}>
                      <td className="sticky left-0 border-t border-slate-100 bg-white px-3 py-3 align-top">
                        <div className="font-medium text-slate-900">{channel.name}</div>
                        <div className="text-xs text-slate-500">{channel.key}</div>
                      </td>
                      {publication.variations.map((variation) => {
                        const priceRecords = variation.channels[channel.key] || [];

                        return (
                          <td key={variation.id} className="border-t border-slate-100 px-3 py-3 align-top">
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
