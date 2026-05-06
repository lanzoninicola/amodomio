import { cn } from "~/lib/utils"
import { MenuItemWithAssociations } from "../../menu-item.prisma.entity.server"
import { Button } from "~/components/ui/button"
import { PublicCardapioVariation } from "~/domain/cardapio/cardapio-items-source.server"

import * as React from "react"
import { ChevronsUpDown, Check } from "lucide-react"
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover"
import { Command, CommandGroup, CommandItem, CommandEmpty } from "~/components/ui/command"
import formatMoneyString from "~/utils/format-money-string"




interface CardapioItemPriceProps {
    prices?: MenuItemWithAssociations["MenuItemSellingPriceVariation"]
    variations?: PublicCardapioVariation[]
    showValuta?: boolean
    cnLabel?: string
    cnValue?: string
}

function normalizePublicVariations(
    prices?: MenuItemWithAssociations["MenuItemSellingPriceVariation"],
    variations?: PublicCardapioVariation[]
) {
    if (variations?.length) {
        return variations
            .filter((variation) => variation.showOnCardapio)
            .sort((a, b) => a.sortOrderIndex - b.sortOrderIndex)
    }

    return (prices ?? [])
        .filter((price) => price.showOnCardapio === true)
        .sort((a, b) => (a.MenuItemSize?.sortOrderIndex ?? 0) - (b.MenuItemSize?.sortOrderIndex ?? 0))
        .map((price) => ({
            id: price.id,
            label: price?.MenuItemSize?.nameShort || price?.MenuItemSize?.name || "Sem variacao",
            priceAmount: Number(price?.priceAmount || 0),
            sortOrderIndex: Number(price?.MenuItemSize?.sortOrderIndex || 0),
            showOnCardapio: Boolean(price?.showOnCardapio),
        }))
}

export function CardapioItemPrice({ prices, variations, cnLabel, cnValue, showValuta = true }: CardapioItemPriceProps) {
    const visibleVariations = normalizePublicVariations(prices, variations)
    const lastIndex = visibleVariations.length - 1
    const colsNumber = visibleVariations.length

    if (visibleVariations.length === 0) {
        return null
    }

    return (
        <div className={
            cn(
                "grid gap-x-6",
                isNaN(colsNumber) ? "grid-cols-3" : `grid-cols-${colsNumber}`
            )
        }>
            {
                visibleVariations.map((variation, idx) => {

                        return (

                            <div key={variation.id} className={
                                cn(
                                    "flex flex-col items-center gap-1",
                                    lastIndex === idx && "order-last"

                                )

                            }>
                                <span className={
                                    cn(
                                        "uppercase text-[12px] text-muted-foreground leading-[1.1]",
                                        cnLabel
                                    )
                                }>{variation.label}</span>
                                <div className={
                                    cn(
                                        "flex items-end gap-[2px] text-muted-foreground",
                                        cnValue
                                    )
                                }>
                                    {showValuta && <span className="text-[12px]">R$</span>}
                                    <span className="text-[13px]">{variation.priceAmount}</span>
                                </div>
                            </div>
                        )


                    })
            }

        </div>
    )
}



type PriceVar = ReturnType<typeof normalizePublicVariations>[number]

interface CardapioItemPriceSelectProps {
    prices?: MenuItemWithAssociations["MenuItemSellingPriceVariation"]
    variations?: PublicCardapioVariation[]
    label?: string
    defaultSelectedId?: string
    showCurrency?: boolean
    className?: string
    onSelect?: (variation: PriceVar) => void
}

export function CardapioItemPriceSelect({
    prices,
    variations,
    label = "Tamanho",
    defaultSelectedId,
    showCurrency = true,
    className,
    onSelect,
}: CardapioItemPriceSelectProps) {
    const [open, setOpen] = React.useState(false)

    const list = React.useMemo(() => {
        return normalizePublicVariations(prices, variations)
    }, [prices, variations])

    const [current, setCurrent] = React.useState<PriceVar | null>(() => {
        if (!list.length) return null
        const found = list.find(p => p.id === defaultSelectedId)
        return found ?? list[0] ?? null
    })

    React.useEffect(() => {
        if (!list.length) {
            setCurrent(null)
            return
        }

        const found = list.find(p => p.id === defaultSelectedId)
        setCurrent((prev) => {
            if (found) return found
            if (prev && list.some(p => p.id === prev.id)) return prev
            return list[0] ?? null
        })
    }, [defaultSelectedId, list])

    function handleSelect(v: PriceVar) {
        setCurrent(v)
        setOpen(false)
        onSelect?.(v)
    }

    const triggerText = current
        ? (
            <div className="flex justify-between items-center w-full font-neue font-normal text-xs tracking-wide truncate">
                <span>{current.label}</span>
                <span>{formatMoneyString(current.priceAmount)}</span>
            </div>
        )
        : label



    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className={cn(
                        "h-8 rounded-md px-2 border border-slate-200",
                        "inline-flex items-center justify-between gap-2",
                        className
                    )}
                >
                    {triggerText}
                    <ChevronsUpDown className="h-4 w-4 opacity-60" />
                </Button>
            </PopoverTrigger>

            <PopoverContent className="w-[180px] p-0" align="start">
                <Command shouldFilter>
                    <CommandEmpty>Nenhum tamanho encontrado.</CommandEmpty>
                    <CommandGroup className="max-h-[300px] overflow-auto">
                        {list.map((p) => {
                            const text = `${p.label} • ${showCurrency ? "R$ " : ""}${p.priceAmount}`
                            const selected = current?.id === p.id
                            return (
                                <CommandItem
                                    key={p.id}
                                    value={text}
                                    onSelect={() => handleSelect(p)}
                                    className="flex items-center gap-2"
                                >
                                    <Check className={cn("h-4 w-4", selected ? "opacity-100" : "opacity-0")} />
                                    <div className="grid grid-cols-2 gap-x-4 w-[160px] font-neue tracking-wide font-medium">
                                        <span className="text-xs">{p.label}</span>
                                        <span className="text-xs">{formatMoneyString(p.priceAmount)}</span>
                                    </div>
                                </CommandItem>
                            )
                        })}
                    </CommandGroup>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
