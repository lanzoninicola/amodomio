import { useFetcher, useOutletContext } from "@remix-run/react";
import { Check, Copy, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { NativeItemSellingPriceCard } from "~/components/admin/native-item-selling-price-card";
import { Button } from "~/components/ui/button";
import { SearchableSelect } from "~/components/ui/searchable-select";
import { toast } from "~/components/ui/use-toast";
import { buildAdminItemsMeta } from "~/domain/item/admin-items-meta";
import type { AdminItemVendaPrecosOutletContext } from "./admin.items.$id.venda.precos";

export const meta = buildAdminItemsMeta("Editar preços de venda");

function ChannelPriceRow(props: {
  channel: AdminItemVendaPrecosOutletContext["channels"][number];
  itemId: string;
  editableVariations: AdminItemVendaPrecosOutletContext["editableVariations"];
  pricingRowByKey: Map<
    string,
    AdminItemVendaPrecosOutletContext["pricingRows"][number]
  >;
  allItems: AdminItemVendaPrecosOutletContext["allItems"];
  dnaHelpUrl: string | null;
  profitPriceHelpUrl: string | null;
}) {
  const fetcher = useFetcher<any>();
  const formId = `channel-prices-form-${props.channel.id}`;
  const [showCopyFrom, setShowCopyFrom] = useState(false);
  const [sourceItemId, setSourceItemId] = useState("");
  const sourceItemOptions = useMemo(
    () =>
      props.allItems.map((item) => {
        const label = item.name || "[sem nome]";

        return {
          value: item.id,
          label,
          searchText: `${label} ${item.id}`,
        };
      }),
    [props.allItems]
  );

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;

    if (fetcher.data?.status === 200) {
      toast({ title: "Ok", description: fetcher.data.message });
      return;
    }

    if (fetcher.data?.status && fetcher.data.status >= 400) {
      toast({
        title: "Erro",
        description: fetcher.data.message,
        variant: "destructive",
      });
    }
  }, [fetcher.data, fetcher.state]);

  return (
    <tr>
      <td className="sticky left-0 border-t border-slate-100 bg-white px-3 py-3 align-top">
        {props.channel.id ? (
          <fetcher.Form
            id={formId}
            method="post"
            action=".."
            className="space-y-2"
          >
            <input
              type="hidden"
              name="_action"
              value="upsert-native-price-batch"
            />
            <input type="hidden" name="itemId" value={props.itemId} />
            <input
              type="hidden"
              name="itemSellingChannelId"
              value={props.channel.id}
            />
          </fetcher.Form>
        ) : null}
        <div className="font-medium text-slate-900">{props.channel.name}</div>
        <div className="text-xs text-slate-500">{props.channel.key}</div>
        {props.channel.id ? (
          <div className="mt-3 flex flex-col gap-2">
            <Button
              type="submit"
              form={formId}
              size="sm"
              className="w-full justify-start gap-2 text-[12px] font-semibold uppercase"
              disabled={fetcher.state !== "idle"}
            >
              <Save size={14} />
              Salvar
            </Button>
            {props.channel.key !== "cardapio" ? (
              <Button
                type="submit"
                form={formId}
                name="_intent"
                value="copy-cardapio-and-save"
                variant="secondary"
                size="sm"
                className="w-full justify-start text-[11px] uppercase tracking-wide text-blue-700"
                disabled={fetcher.state !== "idle"}
              >
                Copiar preços do cardápio
              </Button>
            ) : null}
            {props.allItems.length > 0 ? (
              <div className="flex flex-col gap-1">
                <Button
                  type="button"
                  variant={showCopyFrom ? "default" : "outline"}
                  size="sm"
                  className={`w-full justify-start gap-2 text-[11px] uppercase tracking-wide ${
                    showCopyFrom
                      ? "bg-violet-700 text-white hover:bg-violet-800"
                      : "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 hover:text-violet-800"
                  }`}
                  disabled={fetcher.state !== "idle"}
                  onClick={() => {
                    setShowCopyFrom((prev) => !prev);
                    setSourceItemId("");
                  }}
                >
                  <Copy size={14} />
                  Replicar de outro sabor
                </Button>
                {showCopyFrom ? (
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <SearchableSelect
                      value={sourceItemId}
                      onValueChange={setSourceItemId}
                      options={sourceItemOptions}
                      placeholder="Escolha o sabor"
                      searchPlaceholder="Buscar sabor..."
                      emptyText="Nenhum sabor encontrado."
                      triggerClassName="h-8 w-48 min-w-0 max-w-[12rem] text-[11px]"
                      contentClassName="w-64"
                      inputClassName="h-8 text-[11px]"
                      listClassName="max-h-[min(18rem,calc(100vh-12rem))] overflow-y-auto"
                      itemClassName="text-[11px]"
                    />
                    <Button
                      type="button"
                      size="icon"
                      className="h-8 w-8 bg-violet-700 text-white hover:bg-violet-800"
                      disabled={!sourceItemId || fetcher.state !== "idle"}
                      title="Replicar preços"
                      aria-label="Replicar preços do sabor selecionado"
                      onClick={() => {
                        const fd = new FormData();
                        fd.append("_action", "upsert-native-price-batch");
                        fd.append("_intent", "copy-from-item-and-save");
                        fd.append("itemId", props.itemId);
                        fd.append("itemSellingChannelId", props.channel.id!);
                        fd.append("sourceItemId", sourceItemId);
                        props.editableVariations.forEach((v) =>
                          fd.append("itemVariationIds", v.id)
                        );
                        fetcher.submit(fd, { method: "post", action: ".." });
                        setShowCopyFrom(false);
                        setSourceItemId("");
                      }}
                    >
                      <Check size={16} />
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </td>
      {props.editableVariations.map((itemVariation) => {
        const pricingRow = props.channel.id
          ? props.pricingRowByKey.get(
              `${itemVariation.id}::${props.channel.id}`
            )
          : null;

        return (
          <td
            key={itemVariation.id}
            className="border-t border-slate-100 px-3 py-3 align-top"
          >
            {!props.channel.id || !pricingRow ? (
              <div className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-xs text-slate-400">
                Canal sem cadastro no banco.
              </div>
            ) : (
              <>
                <input
                  type="hidden"
                  form={formId}
                  name="itemVariationIds"
                  value={itemVariation.id}
                />
                <NativeItemSellingPriceCard
                  formId={formId}
                  itemId={props.itemId}
                  itemVariationId={itemVariation.id}
                  itemSellingChannelId={props.channel.id}
                  variationLabel={
                    pricingRow.isReference
                      ? `${pricingRow.variationName} · referência`
                      : pricingRow.variationName
                  }
                  channelLabel={props.channel.name}
                  currentRow={pricingRow.currentRow}
                  computedSellingPriceBreakdown={
                    pricingRow.computedSellingPriceBreakdown
                  }
                  activeSheetId={pricingRow.activeSheetId}
                  activeSheetName={pricingRow.activeSheetName}
                  dnaHelpUrl={props.dnaHelpUrl}
                  profitPriceHelpUrl={props.profitPriceHelpUrl}
                  priceInputName={`priceAmount:${itemVariation.id}`}
                  showSingleSubmitButton={false}
                  showPublishedToggle={false}
                  recommendedPriceMode="display"
                />
              </>
            )}
          </td>
        );
      })}
    </tr>
  );
}

export default function AdminItemVendaPrecosEditarRoute() {
  const {
    channels,
    editableVariations,
    pricingRows,
    nativeModelAvailable,
    item,
    allItems,
    dnaHelpUrl,
    profitPriceHelpUrl,
  } = useOutletContext<AdminItemVendaPrecosOutletContext>();
  const enabledChannels = channels.filter((channel) => channel.enabledForItem);

  const pricingRowByKey = new Map(
    pricingRows.map((row) => [
      `${row.itemVariationId}::${row.itemSellingChannelId}`,
      row,
    ])
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">
            Editar preços
          </h2>
          <div className="text-xs text-slate-500">
            Source: Item. O custo usa a ficha técnica ativa vinculada à
            variação.
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
          Nenhum canal habilitado para este item. Vá na aba `Canais` para
          introduzi-lo em um canal antes de configurar preços.
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
                <ChannelPriceRow
                  key={channel.key}
                  channel={channel}
                  itemId={item.id}
                  editableVariations={editableVariations}
                  pricingRowByKey={pricingRowByKey}
                  allItems={allItems}
                  dnaHelpUrl={dnaHelpUrl}
                  profitPriceHelpUrl={profitPriceHelpUrl}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
