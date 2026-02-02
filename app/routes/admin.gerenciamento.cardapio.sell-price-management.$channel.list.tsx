import * as React from "react";
import { Separator } from "~/components/ui/separator";
import { MenuItemWithSellPriceVariations } from "~/domain/cardapio/menu-item.types";
import { cn } from "~/lib/utils";
import formatDecimalPlaces from "~/utils/format-decimal-places";
import { Size } from "~/domain/size/size.model.server";
import { LoaderFunctionArgs } from "@remix-run/node";
import { defer } from "@remix-run/react";
import { authenticator } from "~/domain/auth/google.server";
import { menuItemSellingPriceHandler } from "~/domain/cardapio/menu-item-selling-price-handler.server";

import prismaClient from "~/lib/prisma/client.server";
import { badRequest } from "~/utils/http-response.server";
import { menuItemSizePrismaEntity } from "~/domain/cardapio/menu-item-size.entity.server";
import { Await, useLoaderData } from "@remix-run/react";
import { Suspense, useEffect, useState } from "react";
import Loading from "~/components/loading/loading";
import { MenuItemsFilters } from "~/domain/cardapio/components/menu-items-filters/menu-items-filters";
import AlertsCostsAndSellPrice from "~/domain/cardapio/components/alerts-cost-and-sell-price/alerts-cost-and-sell-price";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogTrigger
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";


export async function loader({ request, params }: LoaderFunctionArgs) {
  const sellingChannelKey = params.channel as string;
  const currentSellingChannel = await prismaClient.menuItemSellingChannel.findFirst({
    where: {
      key: sellingChannelKey,
    },
  })

  if (!currentSellingChannel) {
    return badRequest(`Can not find selling channel with key ${sellingChannelKey}`)
  }

  const menuItemsWithSellPriceVariations = menuItemSellingPriceHandler.loadMany({
    channelKey: currentSellingChannel.key,
  })

  const user = authenticator.isAuthenticated(request);


  const menuItemGroups = prismaClient.menuItemGroup.findMany({
    where: {
      deletedAt: null,
      visible: true
    }
  })

  const menuItemCategories = prismaClient.category.findMany({
    where: {
      type: "menu"
    }
  })

  const sizes = menuItemSizePrismaEntity.findAll()

  const returnedData = Promise.all([
    menuItemsWithSellPriceVariations,
    user,
    currentSellingChannel,
    menuItemGroups,
    menuItemCategories,
    sizes
  ]);

  return defer({
    returnedData
  })
}


// --- Tipos mínimos para não quebrar a build (ajuste se já houver seus tipos) ---
type Size = { name: string };

type Variation = {
  sizeName: string;
  priceAmount?: number | null;
  profitActualPerc?: number | null;
  computedSellingPriceBreakdown?: {
    minimumPrice?: {
      priceAmount?: { breakEven?: number | null } | null;
    } | null;
  } | null;
};

type MenuItemRow = {
  name: string;
  sellPriceVariations?: Variation[];
  upcoming?: boolean;
};

type ExportRenderedDialogProps = {
  items: MenuItemRow[];     // os itens já filtrados/renderizados
  sizes: Size[];            // a ordem dos tamanhos do header
  channelKey: string;       // currentSellingChannel.key
  trigger?: React.ReactNode; // opcional: para usar um botão próprio
  className?: string;
};

type FieldKey = "price" | "breakEven" | "profit";
type Selection = Record<string, { price: boolean; breakEven: boolean; profit: boolean }>;

export function ExportRenderedDialog(props: ExportRenderedDialogProps) {
  const { items, sizes, channelKey, trigger, className } = props;

  // --- Dialog / UI state ---
  const [open, setOpen] = React.useState(false);
  const [format, setFormat] = React.useState<"csv" | "json">("csv");
  const [separator, setSeparator] = React.useState<string>(";");

  // --- Seleção inicial por tamanho: tudo marcado ---
  const initialSelection = React.useMemo<Selection>(() => {
    const obj: Selection = {};
    sizes.forEach((s) => {
      obj[s.name] = { price: true, breakEven: true, profit: true };
    });
    return obj;
  }, [sizes]);

  const [selection, setSelection] = React.useState<Selection>(initialSelection);
  React.useEffect(() => setSelection(initialSelection), [initialSelection]);

  const allChecked = React.useMemo(
    () => sizes.every((s) => {
      const sel = selection[s.name];
      return sel?.price && sel?.breakEven && sel?.profit;
    }),
    [selection, sizes]
  );

  const toggleAll = (checked: boolean) => {
    const next: Selection = {};
    sizes.forEach((s) => (next[s.name] = { price: checked, breakEven: checked, profit: checked }));
    setSelection(next);
  };

  const toggleOne = (sizeName: string, field: FieldKey, checked: boolean) => {
    setSelection(prev => ({ ...prev, [sizeName]: { ...prev[sizeName], [field]: checked } }));
  };

  // --- Helpers ---
  const slugify = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

  const nowTag = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const beOf = (v?: Variation | null) =>
    v?.computedSellingPriceBreakdown?.minimumPrice?.priceAmount?.breakEven ?? null;

  // --- Export principal ---
  const onExport = () => {
    const sizeNames = sizes.map(s => s.name);
    const exportItems = items.filter((mi) => mi.upcoming !== true);

    if (format === "json") {
      const data = exportItems.map(mi => {
        const out: any = { sabor: mi.name };
        const map: Record<string, Variation> = {};
        mi.sellPriceVariations?.forEach(r => (map[r.sizeName] = r));

        sizeNames.forEach(sn => {
          const sel = selection[sn];
          if (!sel) return;
          const r = map[sn];
          const base = slugify(sn);
          if (sel.price) out[`${base}_preco`] = r?.priceAmount ?? null;
          if (sel.breakEven) out[`${base}_break_even`] = beOf(r);
          if (sel.profit) out[`${base}_lucro_perc`] = r?.profitActualPerc ?? null;
        });

        return out;
      });

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      downloadBlob(blob, `sell-price-${channelKey}-${nowTag()}.json`);
    } else {
      const headers: string[] = ["Sabor"];
      sizeNames.forEach(sn => {
        const sel = selection[sn];
        if (!sel) return;
        if (sel.price) headers.push(`${sn} Preco`);
        if (sel.breakEven) headers.push(`${sn} BreakEven`);
        if (sel.profit) headers.push(`${sn} Lucro%`);
      });

      const lines = exportItems.map(mi => {
        const map: Record<string, Variation> = {};
        mi.sellPriceVariations?.forEach(r => (map[r.sizeName] = r));

        const row: (string | number)[] = [mi.name];
        sizeNames.forEach(sn => {
          const sel = selection[sn];
          if (!sel) return;
          const r = map[sn];
          if (sel.price) row.push(r?.priceAmount ?? "");
          if (sel.breakEven) row.push(beOf(r) ?? "");
          if (sel.profit) row.push(r?.profitActualPerc ?? "");
        });

        return row.join(separator);
      });

      const csv = headers.join(separator) + "\n" + lines.join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      downloadBlob(blob, `sell-price-${channelKey}-${nowTag()}.csv`);
    }

    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className={className}>
            Exportar…
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Exportar dados</DialogTitle>
          <DialogDescription>Escolha as colunas e o formato do arquivo.</DialogDescription>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          A exportação inclui apenas itens não marcados como lançamento futuro (upcoming = false).
        </p>

        <div className="space-y-4">
          {/* Selecionar tudo */}
          <div className="flex items-center gap-2">
            <Checkbox id="allCols" checked={allChecked} onCheckedChange={(v) => toggleAll(!!v)} />
            <Label htmlFor="allCols">Selecionar todos</Label>
          </div>

          {/* Tamanhos e campos */}
          <div className="max-h-[50vh] overflow-auto border rounded-md p-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {sizes.map((s) => {
                const sn = s.name;
                const sel = selection[sn] ?? { price: false, breakEven: false, profit: false };
                return (
                  <div key={sn} className="border rounded p-3">
                    <div className="font-medium mb-2">{sn}</div>
                    <div className="flex flex-wrap gap-4">
                      <div className="flex items-center gap-2">
                        <Checkbox id={`${sn}-preco`} checked={sel.price}
                          onCheckedChange={(v) => toggleOne(sn, "price", !!v)} />
                        <Label htmlFor={`${sn}-preco`}>Preço</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox id={`${sn}-be`} checked={sel.breakEven}
                          onCheckedChange={(v) => toggleOne(sn, "breakEven", !!v)} />
                        <Label htmlFor={`${sn}-be`}>Break-even</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox id={`${sn}-lucro`} checked={sel.profit}
                          onCheckedChange={(v) => toggleOne(sn, "profit", !!v)} />
                        <Label htmlFor={`${sn}-lucro`}>Lucro %</Label>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Formato */}
          <div>
            <Label className="block mb-2">Formato</Label>
            <RadioGroup value={format} onValueChange={(v) => setFormat(v as "csv" | "json")} className="flex gap-6">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="csv" id="fmt-csv" />
                <Label htmlFor="fmt-csv">CSV</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="json" id="fmt-json" />
                <Label htmlFor="fmt-json">JSON</Label>
              </div>
            </RadioGroup>

            {format === "csv" && (
              <div className="mt-3">
                <Label htmlFor="sep" className="mr-2">Separador</Label>
                <select
                  id="sep"
                  className="border rounded px-2 py-1"
                  value={separator}
                  onChange={(e) => setSeparator(e.target.value)}
                >
                  <option value=";">;</option>
                  <option value=",">,</option>
                  <option value="\t">Tab</option>
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  Dica: no Excel pt-BR o “;” costuma abrir melhor.
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={onExport}>Exportar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminGerenciamentoCardapioSellPriceManagementSingleChannelList() {
  const { returnedData } = useLoaderData<typeof loader>();

  return (

    <Suspense fallback={<Loading />}>
      <Await resolve={returnedData}>
        {/* @ts-ignore */}
        {([menuItemsWithSellPriceVariations, user, currentSellingChannel, groups, categories, sizes]) => {
          const [items, setItems] = useState<MenuItemWithSellPriceVariations[]>(menuItemsWithSellPriceVariations || [])

          const BreakEvenAmount = ({ amount }: { amount: number }) => {
            return (
              <span className="text-[12px] uppercase text-muted-foreground font-mono ">{`R$${formatDecimalPlaces(amount)}`}</span>
            )

          }

          const ProfitPerc = ({ profitPerc }: { profitPerc: number }) => {
            return (
              <span className={
                cn(
                  "text-xs text-muted-foreground",
                  profitPerc > 10 && profitPerc < currentSellingChannel.targetMarginPerc && "text-orange-500 font-semibold",
                  profitPerc > 0 && profitPerc < 10 && "text-red-500 font-semibold",
                  profitPerc >= currentSellingChannel.targetMarginPerc && "text-green-500 font-semibold",
                  profitPerc < 0 && "text-red-500 font-semibold"
                )
              }>{profitPerc}%</span>
            )
          }

          const PriceInfo = ({ priceAmount, breakEvenAmount, profitPerc, sizeName, cnContainer }:
            { priceAmount: number, breakEvenAmount: number, profitPerc: number, sizeName: Size["name"], cnContainer: string }) => {

            const OtherChars = ({ children, ...props }: { children: React.ReactNode }) => {
              return (
                <span className="text-[12px] font-mono text-muted-foreground">{children}</span>
              )
            }

            return (
              <div className={cn("flex flex-col w-full", cnContainer)} >
                <span className="uppercase text-center md:hidden text-[11px] font-semibold">{sizeName}</span>
                <div className="flex flex-row gap-1 items-center md:grid md:grid-cols-2 md:gap-x-2">
                  <p className="text-sm font-mono text-center md:text-right ">{formatDecimalPlaces(priceAmount)}</p>
                  <div className="flex items-center">
                    <OtherChars>{`(`}</OtherChars>
                    <BreakEvenAmount amount={breakEvenAmount} />
                    <OtherChars>{`|`}</OtherChars>
                    <ProfitPerc profitPerc={profitPerc} />
                    <OtherChars>{`)`}</OtherChars>
                  </div>
                </div>
              </div>
            );
          }


          return (

            <div className="flex flex-col" >
              <div className="flex flex-col gap-2 py-2 md:py-0 md:grid md:grid-cols-8 md:items-center mb-4 bg-slate-50 px-1">
                <MenuItemsFilters
                  initialItems={menuItemsWithSellPriceVariations}
                  groups={groups}
                  categories={categories}
                  onItemsChange={(filtered) => setItems(filtered)}
                  cnContainer="col-span-6 md:col-span-6"
                />

                <div className="flex flex-col gap-2 py-2 md:py-0 md:grid md:grid-cols-4 md:items-center col-span-2 w-full" >

                  {/* Botão de Exportar */}
                  <ExportRenderedDialog
                    items={items}
                    sizes={sizes}
                    channelKey={currentSellingChannel.key}
                    trigger={<Button size="sm" className="bg-yellow-400 text-black col-span-3">Exportar dados (CSV / JSON)</Button>}
                  />

                  <AlertsCostsAndSellPrice items={items} cnContainer="col-span-1 flex justify-center md:justify-end w-full col-span-1" />
                </div>
              </div>


              <div className="md:h-[500px] overflow-y-scroll">
                <ul className="hidden md:grid md:grid-cols-6 md:mb-4 md:gap-x-2">
                  <li className="text-[11px] uppercase flex items-center">Sabor</li>
                  {sizes.map((s, i) => (
                    <li key={s.id} className={cn("flex flex-col items-center gap-[2px] text-[11px] uppercase",
                      i % 2 === 0 && "border-x"
                    )}>
                      <span className="font-semibold">{s.name}</span>
                      <span className="text-muted-foreground">R$ VV (BE - PR)</span>
                    </li>
                  ))}
                </ul>
                <Separator className="my-1" />
                <Separator className="mb-6" />
                <ul className="flex flex-col gap-2">
                  {items.map((menuItem: MenuItemWithSellPriceVariations) => (
                    <li key={menuItem.menuItemId} className="px-1 py-2 hover:bg-blue-100 hover:font-semibold">
                      <div className="flex flex-col w-full  items-center md:grid md:grid-cols-6 gap-x-4 md:items-start">
                        {/* Coluna 1: Nome do item */}
                        <span className="text-xs mb-2 md:mb-0 uppercase ">{menuItem.name}</span>

                        {/* Colunas 2 a 5: Preço por tamanho */}
                        {menuItem.sellPriceVariations.map((record, i) => {
                          const minimumPriceAmountWithoutProfit = record.computedSellingPriceBreakdown?.minimumPrice?.priceAmount.breakEven ?? 0

                          return (
                            <div key={record.id ?? i} className={
                              cn(
                                "flex flex-col items-center text-xs mb-2 md:mb-0",

                              )
                            }>
                              <PriceInfo
                                priceAmount={record.priceAmount}
                                breakEvenAmount={minimumPriceAmountWithoutProfit}
                                profitPerc={record?.profitActualPerc ?? 0}
                                sizeName={record.sizeName}
                                cnContainer={cn(i % 2 === 0 && "border-x")}
                              />

                              {/* {(record.computedSellingPriceBreakdown?.custoFichaTecnica ?? 0) === 0 && (
                      <div className="flex items-center mt-1 gap-1">
                        <AlertCircleIcon className="h-4 w-4 text-red-500" />
                        <span className="text-red-500 text-[10px] font-semibold leading-tight">
                          Custo não definido
                        </span>
                      </div>
                    )} */}
                            </div>
                          )
                        })}

                      </div>
                      {/* <Separator /> */}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )

        }}
      </Await>
    </Suspense>

  )

}



