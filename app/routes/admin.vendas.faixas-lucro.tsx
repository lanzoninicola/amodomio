import type { LoaderFunctionArgs } from "@remix-run/node";
import { Form, Link, useLoaderData, useNavigation } from "@remix-run/react";
import { ok, serverError } from "~/utils/http-response.server";
import prismaClient from "~/lib/prisma/client.server";
import { cn } from "~/lib/utils";

type MarginBand = "negative" | "0-5" | "5-10" | "10-15" | "above-15" | "no-data";

function getMarginBand(perc: number | null): MarginBand {
  if (perc === null) return "no-data";
  if (perc < 0) return "negative";
  if (perc < 5) return "0-5";
  if (perc < 10) return "5-10";
  if (perc < 15) return "10-15";
  return "above-15";
}

const BAND_CONFIG: Record<MarginBand, { label: string; bg: string; text: string; border: string }> = {
  negative:  { label: "< 0%",   bg: "bg-red-600",     text: "text-white",        border: "border-red-700" },
  "0-5":     { label: "0–5%",   bg: "bg-red-100",     text: "text-red-800",      border: "border-red-200" },
  "5-10":    { label: "5–10%",  bg: "bg-yellow-100",  text: "text-yellow-900",   border: "border-yellow-200" },
  "10-15":   { label: "10–15%", bg: "bg-blue-100",    text: "text-blue-900",     border: "border-blue-200" },
  "above-15":{ label: "> 15%",  bg: "bg-emerald-100", text: "text-emerald-900",  border: "border-emerald-200" },
  "no-data": { label: "–",      bg: "bg-slate-50",    text: "text-slate-400",    border: "border-slate-200" },
};

type Channel = { id: string; key: string; name: string };

type ItemRow = {
  itemId: string;
  name: string;
  channels: Record<string, { perc: number | null; band: MarginBand }>;
};

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const db = prismaClient as any;
    const url = new URL(request.url);
    const variationCode = String(url.searchParams.get("variation") || "").trim();

    const [channels, variations, priceRows] = await Promise.all([
      db.itemSellingChannel.findMany({
        orderBy: [{ sortOrderIndex: "asc" }, { name: "asc" }],
        select: { id: true, key: true, name: true },
      }),
      db.variation.findMany({
        where: { kind: "size", deletedAt: null },
        orderBy: [{ sortOrderIndex: "asc" }, { name: "asc" }],
        select: { id: true, code: true, name: true },
      }),
      db.itemSellingPriceVariation.findMany({
        where: { published: true },
        select: {
          itemId: true,
          itemSellingChannelId: true,
          profitActualPerc: true,
          Item: { select: { name: true, active: true } },
          ItemVariation: {
            select: {
              Variation: { select: { code: true, name: true } },
            },
          },
        },
      }),
    ]);

    let rows = (priceRows || []).filter((r: any) => r.Item?.active);

    if (variationCode && variationCode !== "__all__") {
      rows = rows.filter(
        (r: any) => r.ItemVariation?.Variation?.code === variationCode
      );
    }

    // pivot: item × channel → min (worst) margin
    const pivotMap = new Map<string, Map<string, number | null>>();
    const itemNames = new Map<string, string>();

    for (const row of rows) {
      const itemId = String(row.itemId || "");
      const channelId = String(row.itemSellingChannelId || "");
      const perc = row.profitActualPerc != null ? Number(row.profitActualPerc) : null;

      itemNames.set(itemId, row.Item?.name || itemId);
      if (!pivotMap.has(itemId)) pivotMap.set(itemId, new Map());

      const chMap = pivotMap.get(itemId)!;
      const existing = chMap.get(channelId);
      if (existing === undefined) {
        chMap.set(channelId, perc);
      } else if (perc !== null && (existing === null || perc < existing)) {
        chMap.set(channelId, perc);
      }
    }

    const items: ItemRow[] = Array.from(pivotMap.entries())
      .map(([itemId, chMap]) => ({
        itemId,
        name: itemNames.get(itemId) || itemId,
        channels: Object.fromEntries(
          Array.from(chMap.entries()).map(([chId, perc]) => [
            chId,
            { perc, band: getMarginBand(perc) },
          ])
        ),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

    return ok({ channels, variations, items, filters: { variation: variationCode || "__all__" } });
  } catch (error) {
    return serverError(error);
  }
}

export default function AdminVendasFaixasLucroPage() {
  const data = useLoaderData<typeof loader>();
  const payload = (data?.payload || {}) as {
    channels: Channel[];
    variations: Array<{ id: string; code: string; name: string }>;
    items: ItemRow[];
    filters: { variation: string };
  };
  const navigation = useNavigation();
  const { channels = [], variations = [], items = [], filters } = payload;
  const isLoading = navigation.state !== "idle";

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          Faixas de lucro por sabor
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Menor margem publicada de cada sabor em todos os canais de venda.
          Clique em uma célula para editar os preços do canal.
        </p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-500 mr-1">Faixas:</span>
        {(Object.entries(BAND_CONFIG) as [MarginBand, typeof BAND_CONFIG[MarginBand]][]).map(
          ([key, cfg]) => (
            <span
              key={key}
              className={cn(
                "rounded-full border px-3 py-0.5 text-xs font-semibold",
                cfg.bg, cfg.text, cfg.border
              )}
            >
              {cfg.label}
            </span>
          )
        )}
      </div>

      {/* Filter */}
      <Form method="get" className="flex items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-600">Tamanho</span>
          <select
            name="variation"
            defaultValue={filters?.variation || "__all__"}
            className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400"
          >
            <option value="__all__">Todos os tamanhos</option>
            {variations.map((v) => (
              <option key={v.id} value={v.code}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="h-9 inline-flex items-center rounded-xl bg-slate-950 px-4 text-sm font-medium text-white"
        >
          {isLoading ? "..." : "Filtrar"}
        </button>
      </Form>

      {/* Matrix */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 min-w-[200px]">
                Sabor
              </th>
              {channels.map((ch) => (
                <th
                  key={ch.id}
                  className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-600 min-w-[120px]"
                >
                  {ch.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={channels.length + 1}
                  className="py-16 text-center text-slate-400 text-sm"
                >
                  Nenhum item publicado encontrado.
                </td>
              </tr>
            ) : (
              items.map((item, idx) => (
                <tr
                  key={item.itemId}
                  className={cn(
                    "border-b border-slate-100 last:border-0 hover:bg-slate-50/80 transition-colors",
                    idx % 2 === 0 ? "bg-white" : "bg-slate-50/30"
                  )}
                >
                  <td className="sticky left-0 z-10 bg-inherit px-4 py-2.5 font-medium text-slate-800 text-xs uppercase tracking-wide">
                    {item.name}
                  </td>
                  {channels.map((ch) => {
                    const entry = item.channels[ch.id];
                    const band = entry?.band ?? "no-data";
                    const perc = entry?.perc ?? null;
                    const cfg = BAND_CONFIG[band];
                    return (
                      <td key={ch.id} className="px-2 py-2 text-center">
                        <Link
                          to={`/admin/gerenciamento/cardapio/sell-price-management/${ch.key}/edit-items`}
                          title={`Editar preços — ${ch.name}`}
                          className={cn(
                            "inline-flex items-center justify-center rounded-full border px-2.5 py-0.5",
                            "text-xs font-semibold min-w-[58px] transition-opacity hover:opacity-70",
                            cfg.bg, cfg.text, cfg.border
                          )}
                        >
                          {perc !== null ? `${Number(perc).toFixed(1)}%` : "–"}
                        </Link>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400">
        {items.length} sabores · {channels.length} canais
      </p>
    </div>
  );
}
