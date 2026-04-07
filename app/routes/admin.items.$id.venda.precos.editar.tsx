import { useOutletContext } from "@remix-run/react";
import { NativeItemSellingPriceCard } from "~/components/admin/native-item-selling-price-card";
import type { AdminItemVendaPrecosOutletContext } from "./admin.items.$id.venda.precos";

export default function AdminItemVendaPrecosEditarRoute() {
  const { channels, editableVariations, pricingRows, nativeModelAvailable, item } =
    useOutletContext<AdminItemVendaPrecosOutletContext>();
  const enabledChannels = channels.filter((channel) => channel.enabledForItem);

  const pricingRowByKey = new Map(
    pricingRows.map((row) => [`${row.itemVariationId}::${row.itemSellingChannelId}`, row])
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">Editar preços</h2>
          <div className="text-xs text-slate-500">
            Source: Item. O custo usa a ficha técnica ativa vinculada à variação.
          </div>
        </div>
        <div
          className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${
            nativeModelAvailable
              ? "bg-emerald-100 text-emerald-700"
              : "bg-amber-100 text-amber-800"
          }`}
        >
          {nativeModelAvailable ? "Disponível" : "Indisponível"}
        </div>
      </div>

      {!nativeModelAvailable ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Esta edição ainda não está disponível nesta execução.
        </div>
      ) : enabledChannels.length === 0 ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Nenhum canal habilitado para este item. Vá na aba `Canais` para introduzi-lo em um canal antes de configurar preços.
        </div>
      ) : editableVariations.length === 0 ? (
        <div className="mt-4 text-sm text-slate-500">
          Nenhuma variação ativa vinculada a este item.
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 bg-white px-3 py-2 text-left font-semibold text-slate-700">
                  Canal
                </th>
                {editableVariations.map((itemVariation) => (
                  <th
                    key={itemVariation.id}
                    className="min-w-[320px] px-3 py-2 text-left font-semibold text-slate-700"
                  >
                    <div>{itemVariation.Variation?.name || "Sem variação"}</div>
                    <div className="text-[11px] font-normal text-slate-400">
                      {itemVariation.Variation?.code || itemVariation.id}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {enabledChannels.map((channel) => (
                <tr key={channel.key}>
                  <td className="sticky left-0 border-t border-slate-100 bg-white px-3 py-3 align-top">
                    <div className="font-medium text-slate-900">{channel.name}</div>
                    <div className="text-xs text-slate-500">{channel.key}</div>
                  </td>
                  {editableVariations.map((itemVariation) => {
                    const pricingRow = channel.id
                      ? pricingRowByKey.get(`${itemVariation.id}::${channel.id}`)
                      : null;

                    return (
                      <td
                        key={itemVariation.id}
                        className="border-t border-slate-100 px-3 py-3 align-top"
                      >
                        {!channel.id || !pricingRow ? (
                          <div className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-xs text-slate-400">
                            Canal sem cadastro no banco.
                          </div>
                        ) : (
                          <NativeItemSellingPriceCard
                            action=".."
                            itemId={item.id}
                            itemVariationId={itemVariation.id}
                            itemSellingChannelId={channel.id}
                            variationLabel={
                              pricingRow.isReference
                                ? `${pricingRow.variationName} · referência`
                                : pricingRow.variationName
                            }
                            channelLabel={channel.name}
                            currentRow={pricingRow.currentRow}
                            computedSellingPriceBreakdown={pricingRow.computedSellingPriceBreakdown}
                            activeSheetId={pricingRow.activeSheetId}
                            activeSheetName={pricingRow.activeSheetName}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
