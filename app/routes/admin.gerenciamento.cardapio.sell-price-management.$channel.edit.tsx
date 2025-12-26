import {
  Await,
  useActionData,
  useLoaderData,
  useFetcher,
  useFetcher as useCellFetcher,
} from "@remix-run/react";
import React, { Suspense, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { LoaderFunctionArgs, ActionFunctionArgs, defer } from "@remix-run/node";
import { toast } from "~/components/ui/use-toast";
import Loading from "~/components/loading/loading";
import {
  MenuItemWithSellPriceVariations,
  SellPriceVariation,
} from "~/domain/cardapio/menu-item.types";
import { cn } from "~/lib/utils";
import formatDecimalPlaces from "~/utils/format-decimal-places";
import { MenuItemsFilters } from "~/domain/cardapio/components/menu-items-filters/menu-items-filters";
import AlertsCostsAndSellPrice from "~/domain/cardapio/components/alerts-cost-and-sell-price/alerts-cost-and-sell-price";
import { MoneyInput } from "~/components/money-input/MoneyInput";
import { ok, badRequest } from "~/utils/http-response.server";
import prismaClient from "~/lib/prisma/client.server";
import { authenticator } from "~/domain/auth/google.server";
import { menuItemSellingPriceHandler } from "~/domain/cardapio/menu-item-selling-price-handler.server";
import { menuItemSizePrismaEntity } from "~/domain/cardapio/menu-item-size.entity.server";
import toFixedNumber from "~/utils/to-fixed-number";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import { menuItemSellingPriceUtilityEntity } from "~/domain/cardapio/menu-item-selling-price-utility.entity";
import {
  MenuItemSellingPriceVariationUpsertParams,
  menuItemSellingPriceVariationPrismaEntity,
} from "~/domain/cardapio/menu-item-selling-price-variation.entity.server";
import createUUID from "~/utils/uuid";
import { MenuItemSellingPriceVariationAudit } from "@prisma/client";
import { Dialog, DialogContent, DialogTrigger } from "~/components/ui/dialog";
import { Separator } from "~/components/ui/separator";

// ======= LOADER =======
export async function loader({ request, params }: LoaderFunctionArgs) {
  const sellingChannelKey = params.channel as string;
  const currentSellingChannel = await prismaClient.menuItemSellingChannel.findFirst({
    where: { key: sellingChannelKey },
  });
  if (!currentSellingChannel)
    return badRequest(`Can not find selling channel with key ${sellingChannelKey}`);

  const menuItemsWithSellPriceVariations = menuItemSellingPriceHandler.loadMany({
    channelKey: currentSellingChannel.key,
  });
  const user = authenticator.isAuthenticated(request);
  const menuItemGroups = prismaClient.menuItemGroup.findMany({
    where: { deletedAt: null, visible: true },
  });
  const menuItemCategories = prismaClient.category.findMany({ where: { type: "menu" } });
  const sizes = menuItemSizePrismaEntity.findAll();

  const returnedData = Promise.all([
    menuItemsWithSellPriceVariations,
    user,
    currentSellingChannel,
    menuItemGroups,
    menuItemCategories,
    sizes,
  ]);
  return defer({ returnedData });
}

// ======= ACTION =======
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const { _action, ...values } = Object.fromEntries(formData);

  if (_action === "upsert-by-user-input") {
    const menuItemSellPriceVariationId = values?.menuItemSellPriceVariationId as string;
    const menuItemSellingChannelId = values?.menuItemSellingChannelId as string;
    const menuItemSizeId = values?.menuItemSizeId as string;
    const menuItemId = values?.menuItemId as string;

    const priceAmount = toFixedNumber(values?.priceAmount, 2) || 0;

    const recipeCostAmount = toFixedNumber(values?.recipeCostAmount, 2) || 0;
    const packagingCostAmount = toFixedNumber(values?.packagingCostAmount, 2) || 0;
    const doughCostAmount = toFixedNumber(values?.doughCostAmount, 2) || 0;
    const wasteCostAmount = toFixedNumber(values?.wasteCostAmount, 2) || 0;
    const sellingPriceExpectedAmount = toFixedNumber(values?.sellingPriceExpectedAmount, 2) || 0;
    const profitExpectedPerc = toFixedNumber(values?.profitExpectedPerc, 2) || 0;

    const discountPercentage = isNaN(Number(values?.discountPercentage)) ? 0 : Number(values?.discountPercentage);
    const showOnCardapio = values?.showOnCardapio === "on" ? true : false;
    const updatedBy = (values?.updatedBy as string) || "";

    const dnaPerc =
      (await menuItemSellingPriceUtilityEntity.getSellingPriceConfig()).dnaPercentage || 0;

    const profitActualPerc = menuItemSellingPriceUtilityEntity.calculateProfitPercFromSellingPrice(
      priceAmount,
      {
        fichaTecnicaCostAmount: recipeCostAmount,
        packagingCostAmount,
        doughCostAmount,
        wasteCostAmount,
      },
      dnaPerc
    );

    const nextPrice: MenuItemSellingPriceVariationUpsertParams = {
      menuItemId,
      menuItemSellingChannelId,
      menuItemSizeId,
      priceAmount,
      priceExpectedAmount: sellingPriceExpectedAmount,
      profitActualPerc,
      profitExpectedPerc,
      discountPercentage,
      showOnCardapio,
      updatedBy,
      showOnCardapioAt: null,
    };

    const [err, result] = await prismaIt(
      menuItemSellingPriceVariationPrismaEntity.upsert(menuItemSellPriceVariationId, nextPrice)
    );
    if (!result) return badRequest(`Não foi possível atualizar o preço de venda`);

    // AUDIT
    const nextPriceAudit: MenuItemSellingPriceVariationAudit = {
      id: createUUID(),
      menuItemId,
      menuItemSellingChannelId,
      menuItemSizeId,
      doughCostAmount,
      packagingCostAmount,
      recipeCostAmount,
      wasteCostAmount,
      sellingPriceExpectedAmount,
      profitExpectedPerc,
      sellingPriceActualAmount: priceAmount,
      profitActualPerc,
      dnaPerc,
      updatedBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const [errAudit] = await prismaIt(
      prismaClient.menuItemSellingPriceVariationAudit.create({ data: nextPriceAudit })
    );
    if (err || errAudit)
      return badRequest(err || errAudit || `Não foi possível atualizar o preço de venda`);

    return ok(`O preço de venda foi atualizado com sucesso`);
  }

  return ok("Elemento atualizado com successo");
}

// ======= UI =======
type SizeLite = { id: string; key: string; name: string };

// compara duas listas superficialmente (id e tamanhos básicos) para evitar setState inútil
function shallowEqualItems(a: MenuItemWithSellPriceVariations[], b: MenuItemWithSellPriceVariations[]) {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].menuItemId !== b[i].menuItemId) return false;
    // opcional: também comparar quantidade de variações por item para reduzir falsos positivos
    if ((a[i].sellPriceVariations?.length || 0) !== (b[i].sellPriceVariations?.length || 0)) return false;
  }
  return true;
}

// célula memoizada para reduzir renders
const EditablePriceCell = React.memo(function EditablePriceCellInner({
  menuItem,
  size,
  userEmail,
  currentSellingChannelId,
}: {
  menuItem: MenuItemWithSellPriceVariations;
  size: SizeLite;
  userEmail?: string | null;
  currentSellingChannelId: string;
}) {
  const variation = menuItem.sellPriceVariations.find((sv) => sv.sizeId === size.id);
  const formRef = useRef<HTMLFormElement>(null);
  const cellFetcher = useCellFetcher();

  useEffect(() => {
    if (cellFetcher.data?.status > 399) toast({ title: "Erro", description: cellFetcher.data?.message });
    if (cellFetcher.data?.status === 200) toast({ title: "Salvo", description: cellFetcher.data?.message });
  }, [cellFetcher.data]);

  if (!variation) return <div className="text-[12px] text-muted-foreground text-center">—</div>;

  const cspb = variation.computedSellingPriceBreakdown;

  // principais
  const rec = Number(cspb?.minimumPrice?.priceAmount.withProfit ?? 0);
  const margemAlvo = Number(cspb?.channel?.targetMarginPerc ?? 0);
  const anterior = variation.previousPriceAmount ?? 0;
  const atual = variation.priceAmount ?? 0;
  const lucroPerc = variation.profitActualPerc ?? 0;
  const lucroValor = (atual * lucroPerc) / 100;

  // custos e mínimos
  const custoFT = Number(cspb?.custoFichaTecnica ?? 0);
  const custoDesperdicio = Number(cspb?.wasteCost ?? 0);
  const custoMassa = Number(cspb?.doughCostAmount ?? 0);
  const custoEmbalagem = Number(cspb?.packagingCostAmount ?? 0);
  const custoTotal = custoFT + custoDesperdicio + custoMassa + custoEmbalagem;

  const minBreakEven = Number(cspb?.minimumPrice?.priceAmount.breakEven ?? 0);

  const submitForm = (value?: number) => {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    if (value !== undefined) fd.set("priceAmount", String(value));
    fd.set("_action", "upsert-by-user-input");
    cellFetcher.submit(fd, { method: "post" });
  };

  const priceCellClass = (record?: SellPriceVariation) => {
    if (!record) return "";
    const minWithProfit = record.computedSellingPriceBreakdown?.minimumPrice?.priceAmount.withProfit ?? 0;
    const minBreak = record.computedSellingPriceBreakdown?.minimumPrice?.priceAmount.breakEven ?? 0;
    const p = record.priceAmount ?? 0;
    if (p > 0 && minBreak > p) return "bg-red-100";
    if (p > 0 && minWithProfit > p) return "bg-orange-100";
    return "bg-transparent";
  };

  return (
    <div
      className={cn(
        "rounded p-2",
        "border border-transparent hover:border-slate-200 transition-colors",
        priceCellClass(variation)
      )}
      data-role="editable-price-cell"
      data-mi={menuItem.menuItemId}
      data-size={variation.sizeId}
    >
      {/* Cabeçalho: tamanho + preço atual */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] uppercase tracking-wider font-neue">
          {variation.sizeName}
        </div>
        <div className="text-[11px] font-mono bg-slate-100 rounded px-1.5 py-0.5">
          R$ {formatDecimalPlaces(atual)}
        </div>
      </div>

      {/* Form da célula */}
      <form ref={formRef} method="post" className="flex flex-col gap-1">
        {/* Hidden exigidos pelo action */}
        <input type="hidden" name="menuItemId" value={menuItem.menuItemId} />
        <input type="hidden" name="menuItemSellPriceVariationId" value={variation.menuItemSellPriceVariationId ?? ""} />
        <input type="hidden" name="menuItemSellingChannelId" value={currentSellingChannelId} />
        <input type="hidden" name="menuItemSizeId" value={variation.sizeId ?? ""} />
        <input type="hidden" name="updatedBy" value={variation.updatedBy || userEmail || ""} />

        {/* custos individuais (servidor recalcula) */}
        <input type="hidden" name="recipeCostAmount" value={cspb?.custoFichaTecnica ?? 0} />
        <input type="hidden" name="packagingCostAmount" value={cspb?.packagingCostAmount ?? 0} />
        <input type="hidden" name="doughCostAmount" value={cspb?.doughCostAmount ?? 0} />
        <input type="hidden" name="wasteCostAmount" value={cspb?.wasteCost ?? 0} />

        {/* mínimos */}
        <input type="hidden" name="sellingPriceExpectedAmount" value={cspb?.minimumPrice?.priceAmount.withProfit ?? 0} />
        <input type="hidden" name="profitExpectedPerc" value={cspb?.channel?.targetMarginPerc ?? 0} />
        <input type="hidden" name="discountPercentage" value="0" />
        {variation.showOnCardapio && <input type="hidden" name="showOnCardapio" value="on" />}

        {/* Linha principal: input + botão SALVAR alinhados */}
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <MoneyInput name="priceAmount" defaultValue={variation.priceAmount} className="h-10 font-mono" />
          <button
            type="button"
            onClick={() => submitForm()}
            className={cn(
              "h-10 w-[112px]",
              "rounded border px-3 text-[11px] uppercase tracking-widest font-neue font-semibold border-slate-200",
              "hover:bg-slate-100 transition-colors",
              cellFetcher.state !== "idle" && "opacity-60 cursor-not-allowed"
            )}
            disabled={cellFetcher.state !== "idle"}
            title="Salvar preço"
          >
            {cellFetcher.state === "idle" ? "Salvar" : "Salvando..."}
          </button>
        </div>

        {/* Recomendado (mín. com lucro alvo) + aplicar */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            {`Val. rec. (lucro ${margemAlvo}%)`}
          </span>
          <button
            type="button"
            className="text-[11px] font-mono rounded px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200"
            onClick={() => submitForm(rec)}
            title="Aplicar recomendado"
          >
            {`R$ ${formatDecimalPlaces(rec)}`}
          </button>
        </div>

        {/* Mínimo break-even (pedido) */}
        <div className="text-[10px]">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Mínimo (Break-even):</span>
            <span className="font-mono">R$ {formatDecimalPlaces(minBreakEven)}</span>
          </div>
        </div>

        {/* Lucro atual (percentual e valor) */}
        <div className="text-[10px]">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Lucro atual:</span>
            <span className="font-mono">
              {formatDecimalPlaces(lucroPerc)}% | R$ {formatDecimalPlaces(lucroValor)}
            </span>
          </div>
        </div>

        {/* Anterior */}
        <div className="text-[10px]">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Anterior:</span>
            <span className="font-mono">R$ {formatDecimalPlaces(anterior || 0)}</span>
          </div>
        </div>

        {/* Custo total (label clicável abre dialog) */}
        <Dialog>
          <div className="text-[10px]">
            <div className="flex items-center justify-between">
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="text-left underline text-muted-foreground hover:opacity-80"
                  title="Ver detalhamento de custos"
                >
                  Custo total:
                </button>
              </DialogTrigger>
              <span className="font-mono">R$ {formatDecimalPlaces(custoTotal)}</span>
            </div>
          </div>

          {/* Dialog com detalhamento */}
          <DialogContent className="sm:max-w-[420px]">
            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-semibold">Detalhamento de custos</h4>
              <div className="grid grid-cols-2 text-[12px] gap-y-1">
                <span>Ficha Técnica</span>
                <span className="font-mono text-right">
                  {formatDecimalPlaces(custoFT)}
                </span>
                <span>Desperdício</span>
                <span className="font-mono text-right">
                  {formatDecimalPlaces(custoDesperdicio)}
                </span>
                <span>Custo Massa</span>
                <span className="font-mono text-right">
                  {formatDecimalPlaces(custoMassa)}
                </span>
                <span>Embalagens</span>
                <span className="font-mono text-right">
                  {formatDecimalPlaces(custoEmbalagem)}
                </span>
              </div>

              <Separator className="my-2" />
              <div className="grid grid-cols-2 text-[12px] gap-y-1">
                <span className="font-semibold">Custo total</span>
                <span className="font-mono text-right">
                  {formatDecimalPlaces(custoTotal)}
                </span>
                <span>Mín. c/ lucro (recomendado)</span>
                <span className="font-mono text-right">
                  {formatDecimalPlaces(rec)}
                </span>
                <span>Mín. break-even</span>
                <span className="font-mono text-right">
                  {formatDecimalPlaces(minBreakEven)}
                </span>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </form>
    </div>
  );
});

export default function AdminGerenciamentoCardapioSellPriceManagementSingleChannelEdit() {
  const { returnedData } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const fetcher = useFetcher();

  useEffect(() => {
    if (!actionData) return;
    if (actionData.status > 399) toast({ title: "Erro", description: actionData.message });
    else if (actionData.status === 200) toast({ title: "Ok", description: actionData.message });
  }, [actionData]);

  useEffect(() => {
    if (fetcher.data?.status > 399)
      toast({ title: "Erro", description: fetcher.data?.message || "Falha ao salvar" });
    if (fetcher.data?.status === 200)
      toast({ title: "Salvo", description: fetcher.data?.message || "Preço atualizado" });
  }, [fetcher.data]);

  return (
    <Suspense fallback={<Loading />}>
      <Await resolve={returnedData}>
        {/* @ts-ignore */}
        {([menuItemsWithSellPriceVariations, user, currentSellingChannel, groups, categories, sizes]) => {
          // estado local + setter seguro
          const [items, setItems] = useState<MenuItemWithSellPriceVariations[]>(
            menuItemsWithSellPriceVariations || []
          );

          const safeSetItems = useCallback((next: MenuItemWithSellPriceVariations[]) => {
            setItems(prev => (shallowEqualItems(prev, next) ? prev : next));
          }, []);

          const handleItemsChange = useCallback(
            (filtered: MenuItemWithSellPriceVariations[]) => safeSetItems(filtered),
            [safeSetItems]
          );

          const sizeColumns: SizeLite[] = useMemo(
            () => (sizes || []).map((s: any) => ({ id: s.id, key: s.key, name: s.name })),
            [sizes]
          );

          return (
            <div className="flex flex-col gap-3">
              {/* Filtros + Alertas */}
              <div className="flex flex-col gap-2 py-2 md:py-0 md:grid md:grid-cols-8 md:items-center mb-2 bg-slate-50 px-1">
                <MenuItemsFilters
                  initialItems={menuItemsWithSellPriceVariations}
                  groups={groups}
                  categories={categories}
                  onItemsChange={handleItemsChange}
                  cnContainer="col-span-7"
                />
                <AlertsCostsAndSellPrice
                  items={items}
                  cnContainer="col-span-1 flex justify-center md:justify-end w-full"
                />
              </div>

              {/* Tabela */}
              <div className="overflow-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white border-b">
                    <tr>
                      <th className="text-left px-3 py-2 w-[260px]">
                        Sabor ({currentSellingChannel.name})
                      </th>
                      {sizeColumns.map((sz) => (
                        <th key={sz.id} className="text-center px-2 py-2 min-w-[220px] font-neue">
                          {sz.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((mi) => (
                      <tr key={mi.menuItemId} className="border-b hover:bg-slate-50">
                        <td className="px-3 py-3 align-top">
                          <div className="flex flex-col">
                            <span className="font-semibold font-neue">{mi.name}</span>
                            <span className="text-[11px] text-muted-foreground">
                              ID: {mi.menuItemId.slice(0, 8)}…
                            </span>
                          </div>
                        </td>
                        {sizeColumns.map((sz) => (
                          <td key={sz.id} className="px-2 py-2 align-top">
                            <EditablePriceCell
                              menuItem={mi}
                              size={sz}
                              userEmail={user?.email}
                              currentSellingChannelId={currentSellingChannel.id}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        }}
      </Await>
    </Suspense>
  );
}
