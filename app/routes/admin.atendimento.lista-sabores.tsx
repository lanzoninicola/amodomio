import { Await, Form, Link, defer, useActionData, useLoaderData } from "@remix-run/react";
import Container from "~/components/layout/container/container";
import { MenuItemWithAssociations, menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { Suspense, useEffect, useState } from "react";
import { Input } from "~/components/ui/input";
import { mapPriceVariationsLabel } from "~/domain/cardapio/fn.utils";
import CopyButton from "~/components/primitives/copy-button/copy-button";
import Loading from "~/components/loading/loading";
import MenuItemSwitchVisibilitySubmit from "~/domain/cardapio/components/menu-item-switch-visibility/menu-item-switch-visibility-submit";
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { badRequest, ok } from "~/utils/http-response.server";
import { prismaIt } from "~/lib/prisma/prisma-it.server";
import tryit from "~/utils/try-it";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";
import { toast } from "~/components/ui/use-toast";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { DialogTitle } from "@radix-ui/react-dialog";
import { CopyIcon, Download, ExpandIcon, ExternalLink, Images, PlayCircle, Star } from "lucide-react";
import OptionTab from "~/components/layout/option-tab/option-tab";
import MenuItemSwitchActivationSubmit from "~/domain/cardapio/components/menu-item-switch-activation.tsx/menu-item-switch-activation-submit";
import { MenuItemSellingPriceVariation } from "@prisma/client";
import { Badge } from "~/components/ui/badge";
import formatDecimalPlaces from "~/utils/format-decimal-places";
import formatMoneyString from "~/utils/format-money-string";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import { MoneyInput } from "~/components/money-input/MoneyInput";
import toFixedNumber from "~/utils/to-fixed-number";
import prismaClient from "~/lib/prisma/client.server";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";

export const meta: MetaFunction = () => [
  { title: "Lista de sabores | Admin" },
  { name: "robots", content: "noindex" },
];


export const loader = async () => {

  const cardapioItems = menuItemPrismaEntity.findAll()

  return defer({
    cardapioItems,
  })
}

export async function action({ request }: LoaderFunctionArgs) {

  let formData = await request.formData();
  const { _action, ...values } = Object.fromEntries(formData);

  if (_action === "menu-item-visibility-change") {
    const id = values?.id as string

    const [errItem, item] = await prismaIt(menuItemPrismaEntity.findById(id));

    if (errItem) {
      return badRequest(errItem)
    }

    if (!item) {
      return badRequest("Item não encontrado")
    }

    const [err, result] = await tryit(menuItemPrismaEntity.update(id, {
      visible: !item.visible
    }))

    if (err) {
      return badRequest(err)
    }

    const returnedMessage = !item.visible === true ? `Sabor "${item.name}" visivel no cardápio` : `Sabor "${item.name}" não visivel no cardápio`;

    return ok(returnedMessage);
  }

  if (_action === "menu-item-activation-change") {
    const id = values?.id as string

    const [errItem, item] = await prismaIt(menuItemPrismaEntity.findById(id));

    if (errItem) {
      return badRequest(errItem)
    }

    if (!item) {
      return badRequest("Item não encontrado")
    }

    const [err, result] = await tryit(menuItemPrismaEntity.softDelete(id))

    if (err) {
      return badRequest(err)
    }

    const returnedMessage = !item.active === true ? `Sabor "${item.name}" ativado` : `Sabor "${item.name}" desativado`;

    return ok(returnedMessage);
  }

  if (_action === "menu-item-selling-price-quick-update") {
    const menuItemId = values?.menuItemId as string;

    if (!menuItemId) {
      return badRequest("Item não encontrado");
    }

    const [errVariations, variations] = await prismaIt(
      prismaClient.menuItemSellingPriceVariation.findMany({
        where: {
          menuItemId,
          MenuItemSellingChannel: {
            key: "cardapio",
          },
        },
        include: {
          MenuItemSize: true,
        },
      })
    );

    if (errVariations) {
      return badRequest(errVariations);
    }

    const nextValuesByAbbreviation = {
      IN: toFixedNumber(values?.priceIN, 2),
      PE: toFixedNumber(values?.pricePE, 2),
      ME: toFixedNumber(values?.priceME, 2),
      FA: toFixedNumber(values?.priceFA, 2),
    } as const;

    const updates = (variations || [])
      .map((variation) => {
        const abbr = String(variation?.MenuItemSize?.nameAbbreviated || "").toUpperCase();
        const nextValue = nextValuesByAbbreviation[abbr as keyof typeof nextValuesByAbbreviation];

        if (nextValue === undefined || Number.isNaN(nextValue)) {
          return null;
        }

        return prismaClient.menuItemSellingPriceVariation.update({
          where: {
            id: variation.id,
          },
          data: {
            priceAmount: nextValue,
            previousPriceAmount: Number(variation.priceAmount ?? 0),
            updatedBy: "admin.atendimento.lista-sabores",
            updatedAt: new Date(),
          },
        });
      })
      .filter(Boolean) as any[];

    if (updates.length === 0) {
      return badRequest("Nenhuma variação de preço encontrada para atualizar");
    }

    const [errUpdate] = await prismaIt(prismaClient.$transaction(updates));

    if (errUpdate) {
      return badRequest(errUpdate);
    }

    return ok("Preços de venda atualizados com sucesso");
  }

  return null

}


export default function AdminAtendimentoListaSabores() {
  const { cardapioItems } = useLoaderData<typeof loader>()


  const actionData = useActionData<typeof action>();

  if (actionData && actionData.status > 399) {
    toast({
      title: "Erro",
      description: actionData.message,
    });
  }

  if (actionData && actionData.status === 200) {
    toast({
      title: "Ok",
      description: actionData.message,
    });
  }

  return (
    <Container className="md:max-w-none">



      <Suspense fallback={<Loading />}>
        <Await resolve={cardapioItems}>
          {(cardapioItems) => {

            if (!cardapioItems || cardapioItems.length === 0) {
              return (
                <div className="flex flex-col gap-4 items-center">
                  <h1 className="text-lg font-bold leading-tight tracking-tighter md:text-lg lg:leading-[1.1]">
                    Nenhum sabor cadastrado
                  </h1>
                  <p className="text-sm text-muted-foreground">Cadastre um sabor para começar</p>
                </div>
              )
            }




            const [items] = useState<MenuItemWithAssociations[]>(cardapioItems) // original completo
            const [includeUpcoming, setIncludeUpcoming] = useState(false)
            const activeItems = items.filter(item => item.active === true)
            const activeItemsForDisplay = activeItems.filter((item) =>
              includeUpcoming ? true : item.upcoming !== true
            )
            const [filteredItems, setFilteredItems] = useState<MenuItemWithAssociations[]>(
              activeItemsForDisplay.filter((item) => item.visible === true)
            )
            const [profitRanges, setProfitRanges] = useState({
              critical: false,
              low: false,
              medium: false,
              priority: false,
            })

            const [isSearching, setIsSearching] = useState(false)
            const [selectedLetter, setSelectedLetter] = useState<string | null>(null)


            const [visible, setVisible] = useState(false)
            const [active, setActive] = useState(false)

            const hasProfitFilter = Object.values(profitRanges).some(Boolean)

            const applyProfitFilter = (list: MenuItemWithAssociations[]) => {
              if (!hasProfitFilter) return list

              return list.filter((item) => {
                const profitPerc = getProfitPercForItem(item)

                if (profitPerc === null) return false
                if (profitPerc < 0) return profitRanges.critical
                if (profitPerc <= 10) return profitRanges.low
                if (profitPerc <= 15) return profitRanges.medium
                return profitRanges.priority
              })
            }

            const allActiveItemsWithProfitFilter = applyProfitFilter(activeItemsForDisplay)
            const displayedItemsBase = applyProfitFilter(
              selectedLetter && !isSearching ? activeItemsForDisplay : filteredItems
            )
            const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")
            const availableLetters = new Set(
              allActiveItemsWithProfitFilter
                .map((item) => getInitialLetter(item.name))
                .filter((letter): letter is string => !!letter)
            )

            const displayedItems = selectedLetter
              ? displayedItemsBase.filter((item) => getInitialLetter(item.name) === selectedLetter)
              : displayedItemsBase

            // @ts-ignore
            return (
              <div className="flex flex-col gap-4">
                <div className="rounded-2xl bg-gradient-to-br from-slate-50 via-white to-slate-100/70 p-4">
                  <div>
                    <h1 className="text-lg font-bold tracking-tight text-slate-900">
                      Lista de sabores
                    </h1>
                  </div>

                  <div className="rounded-xl bg-white/60">
                    <CardapioItemSearch
                      items={items}
                      includeUpcoming={includeUpcoming}
                      setIncludeUpcoming={setIncludeUpcoming}
                      setFilteredItems={setFilteredItems}
                      setIsSearching={setIsSearching}
                    />
                    <Separator className="my-3 bg-slate-200/80" />
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <div className="flex items-center pr-2">
                        <span className="text-sm font-semibold text-slate-800">Faixa de lucro</span>
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <div className="flex items-center gap-2 rounded-full border border-red-200 bg-red-50/80 px-3 py-1">
                          <Checkbox
                            id="profit-critical"
                            checked={profitRanges.critical}
                            onCheckedChange={(value) =>
                              setProfitRanges((prev) => ({ ...prev, critical: Boolean(value) }))
                            }
                          />
                          <Label htmlFor="profit-critical" className="text-xs font-medium text-slate-700">
                            Crítico (&lt; 0)
                          </Label>
                        </div>
                        <div className="flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50/80 px-3 py-1">
                          <Checkbox
                            id="profit-low"
                            checked={profitRanges.low}
                            onCheckedChange={(value) =>
                              setProfitRanges((prev) => ({ ...prev, low: Boolean(value) }))
                            }
                          />
                          <Label htmlFor="profit-low" className="text-xs font-medium text-slate-700">
                            Baixo (0 a 10)
                          </Label>
                        </div>
                        <div className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50/80 px-3 py-1">
                          <Checkbox
                            id="profit-medium"
                            checked={profitRanges.medium}
                            onCheckedChange={(value) =>
                              setProfitRanges((prev) => ({ ...prev, medium: Boolean(value) }))
                            }
                          />
                          <Label htmlFor="profit-medium" className="text-xs font-medium text-slate-700">
                            Médio (10 a 15)
                          </Label>
                        </div>
                        <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/80 px-3 py-1">
                          <Checkbox
                            id="profit-priority"
                            checked={profitRanges.priority}
                            onCheckedChange={(value) =>
                              setProfitRanges((prev) => ({ ...prev, priority: Boolean(value) }))
                            }
                          />
                          <Label htmlFor="profit-priority" className="text-xs font-medium text-slate-700">
                            Prioridade (&gt; 15)
                          </Label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>


                <div className="flex flex-col items-center">
                  <div className="mb-4 flex flex-wrap items-center justify-center gap-2 rounded-md border bg-white px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setSelectedLetter(null)}
                      className={cn(
                        "text-xs font-semibold px-2 py-1 rounded",
                        selectedLetter === null ? "bg-slate-900 text-white" : "hover:bg-slate-100"
                      )}
                    >
                      Todos
                    </button>
                    {alphabet.map((letter) => {
                      const isAvailable = availableLetters.has(letter)
                      const isSelected = selectedLetter === letter

                      if (!isAvailable) {
                        return (
                          <span
                            key={letter}
                            className="text-xs font-semibold text-muted-foreground/50 px-1.5 py-1"
                          >
                            {letter}
                          </span>
                        )
                      }

                      return (
                        <button
                          type="button"
                          key={letter}
                          onClick={() => setSelectedLetter((prev) => prev === letter ? null : letter)}
                          className={cn(
                            "text-xs font-semibold px-1.5 py-1 rounded",
                            isSelected ? "bg-slate-900 text-white" : "hover:bg-slate-100"
                          )}
                        >
                          {letter}
                        </button>
                      )
                    })}
                  </div>

                  <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-4">
                    {
                      displayedItems.map((item) => {
                        return (
                          <CardapioItem
                            key={item.id}
                            item={item}
                            setVisible={setVisible}
                            visible={visible}
                            active={active}
                            setActive={setActive}
                            isSearching={isSearching || !!selectedLetter}
                          />

                        )
                      })
                    }

                  </ul>



                </div>
              </div>
            )
          }}
        </Await>
      </Suspense>
    </Container>
  )
}





interface CardapioItemProps {
  item: MenuItemWithAssociations
  visible: boolean,
  setVisible: React.Dispatch<React.SetStateAction<boolean>>
  active: boolean
  setActive: React.Dispatch<React.SetStateAction<boolean>>
  showExpandButton?: boolean
  isSearching?: boolean
}

function CardapioItem({ item, setVisible, visible, active, setActive, showExpandButton = true, isSearching = false }: CardapioItemProps) {
  const profitPerc = getProfitPercForItem(item);
  const profitBadge = getProfitBadgeConfig(profitPerc);
  const [isQuickPriceDialogOpen, setIsQuickPriceDialogOpen] = useState(false);

  return (
    <div
      className={
        cn(
          "border rounded-lg p-4",
          item?.visible === false && "border-red-500/50 bg-red-500/10",
        )
      }
      key={item.id}
    >
      <div className="flex flex-col  mb-2">

        <div className="flex justify-between items-center">
          <div className="flex flex-col gap-1">
            <h2 className="text-xs uppercase font-semibold tracking-wide">
              <Link
                to={`/admin/gerenciamento/cardapio/${item.id}/main`}
                target="_blank"
                rel="noreferrer"
                className="hover:underline"
              >
                {item.name}
              </Link>
            </h2>
            <div className="flex flex-wrap gap-1">
              <Badge
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 w-max",
                  profitBadge.className
                )}
              >
                {profitBadge.label}
              </Badge>
              {item.upcoming === true && (
                <Badge className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 w-max bg-blue-100 text-blue-700">
                  Lancamento futuro
                </Badge>
              )}
            </div>
          </div>
          <div className="flex gap-2 items-center">
            {isSearching && (
              <Badge
                variant={item.visible ? "secondary" : "destructive"}
                className="text-[10px] font-semibold uppercase tracking-wide"
              >
                {item.visible ? "Visível" : "Oculto"}
              </Badge>
            )}
            {
              <CardapioItemGalleryDialog item={item} />
            }
            {
              showExpandButton === true && (
                <CardapioItemDialog key={item.id} triggerComponent={
                  <ExpandIcon size={16} />
                }>
                  <CardapioItem item={item} setVisible={setVisible} visible={visible} active={active} setActive={setActive} showExpandButton={false} isSearching={isSearching} />
                </CardapioItemDialog>
              )
            }

            {item.visible ? (
              <CopyButton
                // label="Copiar elenco para imprimir"
                classNameLabel="text-sm md:text-xs "
                classNameButton="border-none text-sm md:text-xs p-1 mr-0 h-max hover:bg-black/20 hover:text-white"
                textToCopy={`*${item.name}*: ${item.ingredients}`}
                variant="outline"
              />
            ) : (
              <HiddenFlavorCopyWarningDialog item={item} />
            )}
          </div>
        </div>


      </div>

      <ul className="grid grid-cols-4 items-end mb-2">
        {
          item.MenuItemSellingPriceVariation.filter(spv => spv.priceAmount > 0).map((spv) => {
            return (
              <li className="flex flex-col" key={spv.id}>
                <button
                  type="button"
                  onClick={() => setIsQuickPriceDialogOpen(true)}
                  className="text-xs text-left hover:underline"
                >
                  {spv.MenuItemSize.nameAbbreviated}: <span className="font-semibold font-mono">{formatMoneyString(spv.priceAmount)}</span>
                </button>
              </li>
            )
          })
        }
      </ul>

      <QuickSellPriceDialog
        item={item}
        open={isQuickPriceDialogOpen}
        onOpenChange={setIsQuickPriceDialogOpen}
      />

      <p className="text-xs text-muted-foreground line-clamp-2 text-left">{item.ingredients}</p>
      <Separator className="my-3" />

      <div className="flex justify-end">
        {/* <MenuItemSwitchActivationSubmit menuItem={item} active={active} setActive={setActive} cnLabel="text-[12px]" cnContainer="md:justify-start" /> */}
        <MenuItemSwitchVisibilitySubmit menuItem={item} cnLabel="text-[12px]" cnContainer="justify-items-end" />
      </div>
    </div>
  )
}

type GalleryAsset = {
  id: string;
  url: string;
  thumbnailUrl: string;
  kind: "image" | "video";
  label: string;
  isPrimary: boolean;
};

function CardapioItemGalleryDialog({ item }: { item: MenuItemWithAssociations }) {
  const assets = getGalleryAssets(item);
  const [showVideos, setShowVideos] = useState(false);
  const visibleAssets = assets.filter((asset) => showVideos || asset.kind !== "video");
  const [selectedAssetId, setSelectedAssetId] = useState<string>(visibleAssets[0]?.id ?? "");

  useEffect(() => {
    setShowVideos(false);
  }, [item.id]);

  useEffect(() => {
    setSelectedAssetId((current) => {
      if (visibleAssets.some((asset) => asset.id === current)) return current;
      return visibleAssets[0]?.id ?? "";
    });
  }, [visibleAssets]);

  if (assets.length === 0) {
    return (
      <TooltipProvider delayDuration={120}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Button
                type="button"
                variant="outline"
                disabled
                className="border-none text-sm md:text-xs p-1 mr-0 h-max opacity-40"
              >
                <Images size={16} />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            Nenhuma imagem disponivel
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const selectedAsset =
    visibleAssets.find((asset) => asset.id === selectedAssetId) ?? visibleAssets[0] ?? null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="border-none text-sm md:text-xs p-1 mr-0 h-max hover:bg-black/20 hover:text-white"
        >
          <Images size={16} />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl border-0 bg-white p-0 overflow-hidden shadow-xl">
        <div className="rounded-[28px] bg-white p-8">
          <div className="flex flex-col gap-6">
            <div className="min-w-0">
              <DialogTitle className="truncate text-2xl font-semibold tracking-tight text-slate-900">
                {item.name}
              </DialogTitle>
              <p className="mt-1 text-sm text-slate-500">
                Visualize as imagens e videos do item e baixe qualquer arquivo direto pela galeria.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id={`gallery-show-videos-${item.id}`}
                checked={showVideos}
                onCheckedChange={(value) => setShowVideos(Boolean(value))}
              />
              <Label
                htmlFor={`gallery-show-videos-${item.id}`}
                className="text-sm text-slate-600"
              >
                Mostrar videos
              </Label>
            </div>

            <div className="w-full max-w-full overflow-x-auto overflow-y-hidden pb-4">
              {visibleAssets.length === 0 ? (
                <div className="rounded-3xl bg-slate-50 px-6 py-10 text-sm text-slate-500">
                  Nenhuma imagem disponivel com os videos ocultos. Ative "Mostrar videos" para exibir os arquivos de video.
                </div>
              ) : (
                <div className="flex w-max min-w-0 gap-8 pl-1 pr-8">
                  {visibleAssets.map((asset) => {
                    const isSelected = asset.id === selectedAsset?.id;

                    return (
                      <div
                        key={asset.id}
                        className={cn(
                          "group relative block h-[230px] w-[230px] shrink-0 overflow-hidden rounded-[28px] bg-slate-50 text-left transition",
                          isSelected
                            ? "shadow-lg shadow-slate-300/70"
                            : "hover:shadow-md hover:shadow-slate-200/80"
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedAssetId(asset.id)}
                          className="absolute inset-0"
                          aria-label={`Selecionar ${asset.label}`}
                        >
                          {asset.kind === "video" ? (
                            <>
                              <img
                                src={asset.thumbnailUrl}
                                alt={asset.label}
                                className="h-full w-full object-cover"
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/15">
                                <PlayCircle size={42} className="text-white drop-shadow-sm" />
                              </div>
                            </>
                          ) : (
                            <img
                              src={asset.thumbnailUrl}
                              alt={asset.label}
                              className="h-full w-full object-cover"
                            />
                          )}
                        </button>
                        <div className="absolute bottom-4 right-4 flex items-center gap-2">
                          <ExpandAssetButton asset={asset} />
                          <DownloadAssetButton asset={asset} itemName={item.name} floating iconOnly />
                        </div>
                        {asset.isPrimary && (
                          <div className="absolute bottom-4 left-4 rounded-full bg-amber-400 p-2 text-slate-950 shadow-sm">
                            <Star size={16} className="fill-current" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div aria-hidden="true" className="w-2 shrink-0" />
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ExpandAssetButton({ asset }: { asset: GalleryAsset }) {
  const handleOpen = () => {
    if (typeof window === "undefined") return;
    window.open(asset.url, "_blank", "noopener,noreferrer");
  };

  return (
    <Button
      type="button"
      variant="outline"
      className="h-9 w-9 rounded-full border border-white/10 bg-black/95 p-0 text-white shadow-lg shadow-black/40 backdrop-blur hover:bg-black hover:text-white"
      onClick={(event) => {
        event.stopPropagation();
        handleOpen();
      }}
      aria-label={`Expandir ${asset.label}`}
    >
      <ExternalLink size={16} />
    </Button>
  );
}

function DownloadAssetButton({
  asset,
  itemName,
  floating = false,
  iconOnly = false,
}: {
  asset: GalleryAsset;
  itemName: string;
  floating?: boolean;
  iconOnly?: boolean;
}) {
  const downloadUrl = `/admin/media/download?src=${encodeURIComponent(asset.url)}&filename=${encodeURIComponent(
    buildAssetFilename(itemName, asset)
  )}`;

  return (
    <Button
      type="button"
      variant="outline"
      className={cn(
        "shrink-0 gap-2",
        floating && "border border-white/10 bg-black/95 text-white shadow-lg shadow-black/40 backdrop-blur hover:bg-black hover:text-white",
        iconOnly && "h-9 w-9 rounded-full p-0"
      )}
      onClick={(event) => {
        event.stopPropagation();
        if (typeof document === "undefined") return;
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = buildAssetFilename(itemName, asset);
        document.body.appendChild(link);
        link.click();
        link.remove();
      }}
    >
      <Download size={16} />
      {!iconOnly && "Baixar"}
    </Button>
  );
}

function QuickSellPriceDialog({
  item,
  open,
  onOpenChange,
}: {
  item: MenuItemWithAssociations;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const pricesByAbbreviation = item.MenuItemSellingPriceVariation.reduce<Record<string, number>>((acc, variation) => {
    const abbreviation = String(variation?.MenuItemSize?.nameAbbreviated || "").toUpperCase();
    if (!abbreviation) return acc;
    acc[abbreviation] = Number(variation.priceAmount ?? 0);
    return acc;
  }, {});

  const sizeFields = [
    { abbreviation: "IN", label: "Individual", inputName: "priceIN" },
    { abbreviation: "PE", label: "Pequena", inputName: "pricePE" },
    { abbreviation: "ME", label: "Media", inputName: "priceME" },
    { abbreviation: "FA", label: "Familia", inputName: "priceFA" },
  ] as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogTitle className="text-base font-semibold">
          Atualizar preco de venda
        </DialogTitle>
        <p className="mt-1 inline-flex w-fit rounded-md bg-slate-900 px-2.5 py-1 text-sm font-semibold uppercase tracking-wide text-white">
          {item.name}
        </p>

        <Form method="post" className="mt-3 flex flex-col gap-4">
          <input type="hidden" name="_action" value="menu-item-selling-price-quick-update" />
          <input type="hidden" name="menuItemId" value={item.id} />

          <div className="grid grid-cols-4 gap-3">
            {sizeFields.map((size) => (
              <label key={size.abbreviation} className="flex flex-col gap-0 text-xs font-semibold text-muted-foreground">
                <span>
                  {size.label} ({size.abbreviation})
                </span>
                <span>
                  R$ {formatMoneyString(pricesByAbbreviation[size.abbreviation] ?? 0)}
                </span>
                <MoneyInput
                  name={size.inputName}
                  defaultValue={pricesByAbbreviation[size.abbreviation] ?? 0}
                  className="w-full text-black font-medium mt-2 font-mono text-lg"
                />
              </label>
            ))}
          </div>

          <Button type="submit" className="w-full">
            Salvar
          </Button>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function getProfitBadgeConfig(profitPerc: number | null) {
  if (profitPerc === null) {
    return {
      label: "Sem margem",
      className: "bg-slate-100 text-slate-600",
    };
  }

  if (profitPerc < 0) {
    return {
      label: "🔴 Lucro Crítico (< 0)",
      className: "bg-red-500 text-white",
    };
  }

  if (profitPerc <= 10) {
    return {
      label: "🟠 Lucro Baixo (0 a 10)",
      className: "bg-orange-500 text-white",
    };
  }

  if (profitPerc <= 15) {
    return {
      label: "🟡 Lucro Médio (10 a 15)",
      className: "bg-amber-400 text-amber-950",
    };
  }

  return {
    label: "🟢 Prioridade de Venda (> 15)",
    className: "bg-emerald-500 text-white",
  };
}

function getGalleryAssets(item: MenuItemWithAssociations): GalleryAsset[] {
  const visibleAssets = (item.MenuItemGalleryImage ?? [])
    .filter((asset) => asset.visible !== false && Boolean(asset.secureUrl))
    .sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

  return visibleAssets.map((asset, index) => {
    const isVideo =
      String(asset.kind || "").toLowerCase() === "video" ||
      /\.(mp4|mov|webm|m4v|ogg|ogv)(\?|$)/i.test(String(asset.secureUrl || ""));

    return {
      id: asset.id,
      url: String(asset.secureUrl || ""),
      thumbnailUrl: String(asset.thumbnailUrl || asset.secureUrl || ""),
      kind: isVideo ? "video" : "image",
      isPrimary: Boolean(asset.isPrimary),
      label:
        asset.displayName ||
        asset.originalFileName ||
        `${isVideo ? "Video" : "Imagem"} ${index + 1}`,
    };
  });
}

function buildAssetFilename(itemName: string, asset: GalleryAsset) {
  const safeItemName = itemName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  const urlWithoutQuery = asset.url.split("?")[0] || "";
  const extFromUrl = urlWithoutQuery.includes(".")
    ? urlWithoutQuery.split(".").pop()
    : asset.kind === "video"
      ? "mp4"
      : "jpg";

  return `${safeItemName || "item"}-${asset.id.slice(0, 8)}.${extFromUrl}`;
}

function getProfitPercForItem(item: MenuItemWithAssociations) {
  const profitVariation = item.MenuItemSellingPriceVariation?.find(
    (variation) => variation.MenuItemSize?.key === "pizza-medium"
  );

  return profitVariation ? Number(profitVariation.profitActualPerc ?? 0) : null;
}

function getInitialLetter(value?: string | null) {
  if (!value) return null;

  const normalized = value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  const firstChar = normalized.charAt(0);

  return /[A-Z]/.test(firstChar) ? firstChar : null;
}

interface CardapioItemDialogProps {
  children?: React.ReactNode;
  triggerComponent?: React.ReactNode;
}

function HiddenFlavorCopyWarningDialog({ item }: { item: MenuItemWithAssociations }) {
  const isUpcoming = item.upcoming === true

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="border-none text-sm md:text-xs p-1 mr-0 h-max hover:bg-black/20 hover:text-white"
        >
          <CopyIcon size={16} className="text-black" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogTitle className="text-base font-semibold">
          {isUpcoming ? "Lancamento futuro" : "Sabor pausado"}
        </DialogTitle>
        <p className="text-sm text-muted-foreground">
          {isUpcoming
            ? "Este sabor e um lancamento futuro e nao esta disponivel agora no cardapio."
            : "Este sabor esta pausado e nao esta disponivel no cardapio."}
        </p>
        <DialogClose asChild>
          <Button type="button" variant="secondary" className="mt-2 w-full">
            Fechar
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  )
}

function CardapioItemDialog({ children, triggerComponent }: CardapioItemDialogProps) {

  return (
    <Dialog >
      <DialogTrigger asChild className="w-full">
        <button>
          {triggerComponent}
        </button>
      </DialogTrigger>
      <DialogContent className="p-0 bg-transparent border-none">
        <div className="bg-white p-4">
          <DialogTitle className="text-lg font-bold leading-tight tracking-tighter md:text-lg lg:leading-[1.1] mb-4">
            Detalhes do sabor
          </DialogTitle>
          {children}
          <DialogClose asChild>
            <div className="w-full mt-6">
              <Button type="button" variant="secondary" className="w-full" >
                <span className=" tracking-wide font-semibold uppercase">Fechar</span>
              </Button>
            </div>

          </DialogClose>
        </div>

      </DialogContent>

    </Dialog>
  )
}



function CardapioItemSearch({
  items,
  includeUpcoming,
  setIncludeUpcoming,
  setFilteredItems,
  setIsSearching,
}: {
  items: MenuItemWithAssociations[],
  includeUpcoming: boolean,
  setIncludeUpcoming: React.Dispatch<React.SetStateAction<boolean>>,
  setFilteredItems: React.Dispatch<React.SetStateAction<MenuItemWithAssociations[]>>,
  setIsSearching: React.Dispatch<React.SetStateAction<boolean>>
}) {
  const [search, setSearch] = useState("")
  const [includeHidden, setIncludeHidden] = useState(false)

  const applySearch = (
    value: string,
    shouldIncludeHidden: boolean,
    shouldIncludeUpcoming: boolean,
  ) => {
    const baseItems = items
      .filter((item) => item.active === true)
      .filter((item) => (shouldIncludeUpcoming ? true : item.upcoming !== true))

    if (!value) {
      setIsSearching(false)
      return setFilteredItems(
        baseItems.filter((item) => (shouldIncludeHidden ? true : item.visible === true))
      )
    }

    setIsSearching(true)

    const searchedItems = baseItems
      .filter((item) => (shouldIncludeHidden ? true : item.visible === true))
      .filter(item => {
        const tags = item?.tags?.public || []

        return (
          item.name?.toLowerCase().includes(value.toLowerCase()) ||
          item.ingredients?.toLowerCase().includes(value.toLowerCase()) ||
          item.description?.toLowerCase().includes(value.toLowerCase()) ||
          tags.some(t => t?.toLowerCase().includes(value.toLowerCase()))
        )
      })

    setFilteredItems(searchedItems)
  }

  useEffect(() => {
    applySearch(search, includeHidden, includeUpcoming)
  }, [search, includeHidden, includeUpcoming, items])

  return (

    <div className="flex flex-col gap-3">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,0.95fr)_minmax(460px,1.05fr)] xl:items-end">
        <div className="max-w-3xl">
          <Label htmlFor="search-flavors" className="text-sm font-semibold text-slate-800">
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <span className="shrink-0 md:min-w-[140px]">Buscar no cardapio</span>
              <Input
                id="search-flavors"
                name="search"
                className="h-10 w-full rounded-lg border-slate-200 bg-white text-sm shadow-sm"
                placeholder="Pesquisar por nome, ingredientes ou tags..."
                onChange={(event) => setSearch(event.target.value)}
                value={search}
              />
            </div>
          </Label>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <label
            htmlFor="search-hidden-flavors"
            className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-lg bg-slate-50/70 px-3 py-2"
          >
            <div className="space-y-0.5">
              <span className="block text-sm font-medium text-slate-800">Sabores ocultos</span>
              <span className="block text-xs text-muted-foreground">
                Inclui itens pausados no resultado da busca
              </span>
            </div>
            <Switch
              id="search-hidden-flavors"
              checked={includeHidden}
              onCheckedChange={(value) => setIncludeHidden(!!value)}
            />
          </label>

          <label
            htmlFor="search-upcoming-flavors"
            className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-lg bg-slate-50/70 px-3 py-2"
          >
            <div className="space-y-0.5">
              <span className="block text-sm font-medium text-slate-800">Lancamentos futuros</span>
              <span className="block text-xs text-muted-foreground">
                Mostra itens marcados como futuros lancamentos
              </span>
            </div>
            <Switch
              id="search-upcoming-flavors"
              checked={includeUpcoming}
              onCheckedChange={(value) => setIncludeUpcoming(!!value)}
            />
          </label>
        </div>
      </div>
    </div>

  )
}
