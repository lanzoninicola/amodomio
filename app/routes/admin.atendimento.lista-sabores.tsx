import { Await, Link, defer, useActionData, useLoaderData } from "@remix-run/react";
import Container from "~/components/layout/container/container";
import { MenuItemWithAssociations, menuItemPrismaEntity } from "~/domain/cardapio/menu-item.prisma.entity.server";
import { Suspense, useState } from "react";
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
import { Car, CopyIcon, ExpandIcon } from "lucide-react";
import OptionTab from "~/components/layout/option-tab/option-tab";
import MenuItemSwitchActivationSubmit from "~/domain/cardapio/components/menu-item-switch-activation.tsx/menu-item-switch-activation-submit";
import { MenuItemSellingPriceVariation } from "@prisma/client";
import { Badge } from "~/components/ui/badge";
import formatDecimalPlaces from "~/utils/format-decimal-places";
import formatMoneyString from "~/utils/format-money-string";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";

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
            const activeItems = items.filter(item => item.active === true)
            const [filteredItems, setFilteredItems] = useState<MenuItemWithAssociations[]>(activeItems.filter(i => i.visible === true) || [])
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

            const allActiveItemsWithProfitFilter = applyProfitFilter(activeItems)
            const displayedItemsBase = applyProfitFilter(
              selectedLetter && !isSearching ? activeItems : filteredItems
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
                <div className="grid grid-cols-1 md:grid-cols-8 gap-4 items-center bg-slate-50 px-4 py-2">
                  <h1 className="text-lg font-bold tracking-tighter md:text-lg col-span-2">
                    Lista de sabores
                  </h1>
                  <CardapioItemSearch items={items} setFilteredItems={setFilteredItems} setIsSearching={setIsSearching} />

                  <div className="col-span-full flex flex-wrap items-center justify-center gap-4 text-center">
                    <span className="text-xs text-muted-foreground">Faixa de lucro</span>
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="profit-critical"
                          checked={profitRanges.critical}
                          onCheckedChange={(value) =>
                            setProfitRanges((prev) => ({ ...prev, critical: Boolean(value) }))
                          }
                        />
                        <Label htmlFor="profit-critical" className="text-xs">
                          Crítico (&lt; 0)
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="profit-low"
                          checked={profitRanges.low}
                          onCheckedChange={(value) =>
                            setProfitRanges((prev) => ({ ...prev, low: Boolean(value) }))
                          }
                        />
                        <Label htmlFor="profit-low" className="text-xs">
                          Baixo (0 a 10)
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="profit-medium"
                          checked={profitRanges.medium}
                          onCheckedChange={(value) =>
                            setProfitRanges((prev) => ({ ...prev, medium: Boolean(value) }))
                          }
                        />
                        <Label htmlFor="profit-medium" className="text-xs">
                          Médio (10 a 15)
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="profit-priority"
                          checked={profitRanges.priority}
                          onCheckedChange={(value) =>
                            setProfitRanges((prev) => ({ ...prev, priority: Boolean(value) }))
                          }
                        />
                        <Label htmlFor="profit-priority" className="text-xs">
                          Prioridade (&gt; 15)
                        </Label>
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
                <p className="text-xs text-left">{spv.MenuItemSize.nameAbbreviated}: <span className="font-semibold font-mono">{formatMoneyString(spv.priceAmount)}</span></p>
              </li>
            )
          })
        }
      </ul>

      <p className="text-xs text-muted-foreground line-clamp-2 text-left">{item.ingredients}</p>
      <Separator className="my-3" />

      <div className="flex justify-end">
        {/* <MenuItemSwitchActivationSubmit menuItem={item} active={active} setActive={setActive} cnLabel="text-[12px]" cnContainer="md:justify-start" /> */}
        <MenuItemSwitchVisibilitySubmit menuItem={item} cnLabel="text-[12px]" cnContainer="justify-items-end" />
      </div>
    </div>
  )
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
  setFilteredItems,
  setIsSearching,
}: {
  items: MenuItemWithAssociations[],
  setFilteredItems: React.Dispatch<React.SetStateAction<MenuItemWithAssociations[]>>,
  setIsSearching: React.Dispatch<React.SetStateAction<boolean>>
}) {
  const [search, setSearch] = useState("")
  const [includeHidden, setIncludeHidden] = useState(false)

  const applySearch = (value: string, shouldIncludeHidden: boolean) => {
    if (!value) {
      setIsSearching(false)
      return setFilteredItems(
        items
          .filter(item => item.active === true)
          .filter(item => (shouldIncludeHidden ? true : item.visible === true))
      )
    }

    setIsSearching(true)

    const searchedItems = items
      .filter(item => item.active === true)
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

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setSearch(value)
    applySearch(value, includeHidden)
  }

  return (
    <div className="flex flex-col md:flex-row gap-2 md:gap-4 items-center w-full col-span-4">
      <Input
        name="search"
        className="w-full md:w-[60%] py-4 text-lg bg-white"
        placeholder="Pesquisar no cardápio..."
        onChange={handleSearch}
        value={search}
      />
      <div className="flex items-center gap-2 self-start md:self-auto">
        <Switch
          id="search-hidden-flavors"
          checked={includeHidden}
          onCheckedChange={(value) => {
            const nextValue = !!value
            setIncludeHidden(nextValue)
            applySearch(search, nextValue)
          }}
        />
        <Label htmlFor="search-hidden-flavors" className="text-xs text-muted-foreground">
          Incluir sabores ocultos na busca
        </Label>
      </div>
    </div>
  )
}
