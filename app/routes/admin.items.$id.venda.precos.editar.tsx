import { Form, useOutletContext } from "@remix-run/react";
import { Input } from "~/components/ui/input";
import type { AdminItemVendaPrecosOutletContext } from "./admin.items.$id.venda.precos";

function formatCurrency(value: number | null | undefined) {
  if (value == null) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

export default function AdminItemVendaPrecosEditarRoute() {
  const { channels, editableVariations, nativeRows, nativeModelAvailable } =
    useOutletContext<AdminItemVendaPrecosOutletContext>();
  const enabledChannels = channels.filter((channel) => channel.enabledForItem);

  const nativeRowByKey = new Map(
    nativeRows.map((row: any) => [`${row.itemVariationId}::${row.itemSellingChannelId}`, row])
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">Editar preços</h2>
        </div>
        <div className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${nativeModelAvailable ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
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
        <div className="mt-4 text-sm text-slate-500">Nenhuma variação ativa vinculada a este item.</div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 bg-white px-3 py-2 text-left font-semibold text-slate-700">Variação do item</th>
                {enabledChannels.map((channel) => (
                  <th key={channel.key} className="px-3 py-2 text-left font-semibold text-slate-700">
                    <div>{channel.name}</div>
                    <div className="text-[11px] font-normal uppercase tracking-wide text-slate-400">{channel.key}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {editableVariations.map((itemVariation) => (
                <tr key={itemVariation.id}>
                  <td className="sticky left-0 border-t border-slate-100 bg-white px-3 py-3 align-top">
                    <div className="font-medium text-slate-900">{itemVariation.Variation?.name || "Sem variação"}</div>
                    <div className="text-xs text-slate-500">{itemVariation.Variation?.code || itemVariation.id}</div>
                    {itemVariation.isReference ? (
                      <div className="mt-1 text-[11px] uppercase tracking-wide text-emerald-700">Referência</div>
                    ) : null}
                  </td>
                  {enabledChannels.map((channel) => {
                    const disabled = !channel.id;
                    const currentRow = channel.id ? nativeRowByKey.get(`${itemVariation.id}::${channel.id}`) : null;

                    return (
                      <td key={channel.key} className="border-t border-slate-100 px-3 py-3 align-top">
                        {disabled ? (
                          <div className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-xs text-slate-400">
                            Canal sem cadastro no banco.
                          </div>
                        ) : (
                          <Form method="post" action=".." className="space-y-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
                            <input type="hidden" name="_action" value="upsert-native-price" />
                            <input type="hidden" name="itemVariationId" value={itemVariation.id} />
                            <input type="hidden" name="itemSellingChannelId" value={channel.id || ""} />

                            <div>
                              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                Preço
                              </label>
                              <Input
                                name="priceAmount"
                                inputMode="decimal"
                                defaultValue={currentRow ? String(currentRow.priceAmount) : ""}
                                placeholder="0,00"
                                className="h-9 bg-white"
                              />
                            </div>

                            <label className="flex items-center gap-2 text-xs text-slate-700">
                              <input type="checkbox" name="published" defaultChecked={Boolean(currentRow?.published)} />
                              Publicado no canal
                            </label>

                            {currentRow ? (
                              <div className="text-[11px] text-slate-400">Atual: {formatCurrency(currentRow.priceAmount)}</div>
                            ) : (
                              <div className="text-[11px] text-slate-400">Sem registro nativo</div>
                            )}

                            <button
                              type="submit"
                              className="inline-flex h-8 items-center justify-center rounded-md bg-slate-900 px-3 text-xs font-semibold text-white transition hover:bg-slate-700"
                            >
                              Salvar
                            </button>
                          </Form>
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
