import type { LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useLocation } from "@remix-run/react";
import { FileText, Store, Tags } from "lucide-react";
import { loadItemSellingOverview } from "~/domain/item/item-selling-overview.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";
import { lastUrlSegment } from "~/utils/url";

const vendaNavigation = [
  { name: "Comercial", href: "comercial", icon: FileText },
  { name: "Canais", href: "canais", icon: Store },
  { name: "Precos", href: "precos", icon: Tags },
  { name: "Tags", href: "tags", icon: Tags },
];

export async function loader({ params }: LoaderFunctionArgs) {
  try {
    const id = params.id;
    if (!id) return badRequest("Item inválido");

    const overview = await loadItemSellingOverview({
      itemId: id,
    });

    if (!overview) return badRequest("Item não encontrado");

    return ok({
      ...overview,
    });
  } catch (error) {
    return serverError(error);
  }
}

export type AdminItemVendaOutletContext = {
  item: {
    id: string;
    name: string;
    canSell: boolean;
  };
  sellingSource: "native";
  nativePricingReady: boolean;
  nativePublication: {
    canSell: boolean;
    hasAnyNativePrice: boolean;
    hasAnyPublishedPrice: boolean;
    slug: string | null;
    visibleFlag: boolean;
    upcoming: boolean;
    publishedChannelKeys: string[];
    totalPriceEntries: number;
    publishedPriceEntries: number;
    visible: boolean;
  };
  legacyPublications: Array<{
    id: string;
    name: string;
    active: boolean;
    visible: boolean;
    sortOrderIndex: number;
    publishedChannelKeys: string[];
  }>;
  sellingMatrix: Array<{
    id: string;
    name: string;
    active: boolean;
    visible: boolean;
    variations: Array<{
      id: string;
      key: string | null;
      name: string;
      fullName: string;
      sortOrderIndex: number;
      channels: Record<
        string,
        Array<{
          id: string;
          priceAmount: number;
          showOnCardapio: boolean;
          updatedAt: string | null;
          channelName: string | null;
          sourceMenuItemId: string;
          sourceMenuItemName: string;
          sourceMenuItemActive: boolean;
          sourceMenuItemVisible: boolean;
        }>
      >;
    }>;
  }>;
  channels: Array<
    {
      key: string;
      name: string;
      description?: string | null;
      id: string | null;
      dbName: string | null;
      enabledForItem: boolean;
      visibleForItem: boolean;
      feeAmount: number;
      taxPerc: number;
      onlinePaymentTaxPerc: number;
      targetMarginPerc: number;
      isMarketplace: boolean;
      isConfigured: boolean;
      nativeActivePublications: number;
      legacyActivePublications: number;
      activePublications: number;
      totalPriceEntries: number;
    }
  >;
};

export default function AdminItemVendaLayout() {
  const loaderData = useLoaderData<typeof loader>();
  const location = useLocation();
  const payload = (loaderData?.payload || {}) as AdminItemVendaOutletContext;
  const activeSubtab = lastUrlSegment(location.pathname);
  const item = payload.item;
  const legacyPublications = payload.legacyPublications || [];
  const nativePublication = payload.nativePublication || {
    canSell: false,
    hasAnyNativePrice: false,
    hasAnyPublishedPrice: false,
    slug: null,
    visibleFlag: false,
    upcoming: false,
    publishedChannelKeys: [],
    totalPriceEntries: 0,
    publishedPriceEntries: 0,
    visible: false,
  };
  const sellingSource = payload.sellingSource || "native";
  const nativePricingReady = payload.nativePricingReady || false;
  const basePath = `/admin/items/${item?.id}/venda`;

  if (!item) {
    return <div className="p-4 text-sm text-muted-foreground">{loaderData?.message || "Item não encontrado."}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-950">Venda</h2>
          <div
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
              item.canSell ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"
            }`}
          >
            {item.canSell ? "Pode vender" : "Venda desabilitada"}
          </div>
        </div>

        <nav className="border-b border-slate-100">
          <div className="flex items-center gap-5 overflow-x-auto text-sm">
            {vendaNavigation.map((navItem) => {
              const Icon = navItem.icon;
              const isActive = activeSubtab === navItem.href;

              return (
                <Link
                  key={navItem.href}
                  to={`${basePath}/${navItem.href}`}
                  className={`inline-flex shrink-0 items-center gap-2 border-b-2 pb-2.5 font-medium transition ${
                    isActive
                      ? "border-slate-950 text-slate-950"
                      : "border-transparent text-slate-400 hover:text-slate-700"
                  }`}
                >
                  <Icon size={14} />
                  {navItem.name}
                </Link>
              );
            })}
          </div>
        </nav>

        {!item.canSell ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            A venda deste item está desativada na aba Principal.
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="font-medium text-slate-700">Fonte:</span>
          <span>Item</span>
          <span>· preços nativos: {nativePublication.totalPriceEntries}</span>
          <span>· publicados nativos: {nativePublication.publishedPriceEntries}</span>
          {!nativePricingReady ? <span>· publicações legadas: {legacyPublications.length}</span> : null}
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Disponibilidade nativa</div>
            <div className="mt-2 text-sm font-medium text-slate-900">
              {item.canSell ? "Item liberado para venda" : "Venda nativa desabilitada"}
            </div>
            <div className="mt-1 text-xs text-slate-500">Controlado por `Item.canSell`.</div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Publicação nativa</div>
            <div className="mt-2 text-sm font-medium text-slate-900">
              {nativePublication.hasAnyPublishedPrice ? "Há preço publicado" : "Sem preço publicado"}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Visível no fluxo nativo: {nativePublication.visible ? "sim" : "não"}.
              {` Canal cardápio: ${nativePublication.visibleFlag ? "visível" : "oculto"}.`}
              {nativePublication.upcoming ? " Marcado como lançamento futuro." : ""}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Bridge legada</div>
            <div className="mt-2 text-sm font-medium text-slate-900">
              {legacyPublications.length > 0 ? `${legacyPublications.length} vínculo(s)` : "Sem bridge ativa"}
            </div>
            <div className="mt-1 text-xs text-slate-500">Mantida apenas para compatibilidade residual, sem dirigir a venda nativa.</div>
          </div>
        </div>
      </div>

      <Outlet context={payload} />
    </div>
  );
}
