import { Separator } from "@radix-ui/react-separator"
import { cn } from "~/lib/utils"
import { MenuItemWithAssociations } from "../../menu-item.prisma.entity.server"
import { Button } from "~/components/ui/button"

import * as React from "react"
import { ChevronsUpDown, Check } from "lucide-react"
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover"
import { Command, CommandInput, CommandGroup, CommandItem, CommandEmpty } from "~/components/ui/command"
import formatDecimalPlaces from "~/utils/format-decimal-places"
import formatMoneyString from "~/utils/format-money-string"




interface CardapioItemPriceProps {
    prices: MenuItemWithAssociations["MenuItemSellingPriceVariation"]
    showValuta?: boolean
    cnLabel?: string
    cnValue?: string
}

export function CardapioItemPrice({ prices, cnLabel, cnValue, showValuta = true }: CardapioItemPriceProps) {

    const lastIndex = prices.length - 1
    const colsNumber = prices.filter(p => p.showOnCardapio === true).length

    return (
        <div className={
            cn(
                "grid gap-x-6",
                isNaN(colsNumber) ? "grid-cols-3" : `grid-cols-${colsNumber}`
            )
        }>
            {
                prices.filter(p => p.showOnCardapio === true)
                    .sort((a, b) => a.MenuItemSize.sortOrderIndex - b.MenuItemSize.sortOrderIndex)
                    .map((p, idx) => {

                        return (

                            <div key={p.id} className={
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
                                }>{p?.MenuItemSize?.nameShort}</span>
                                <div className={
                                    cn(
                                        "flex items-end gap-[2px] text-muted-foreground",
                                        cnValue
                                    )
                                }>
                                    {showValuta && <span className="text-[12px]">R$</span>}
                                    <span className="text-[13px]">{p?.priceAmount}</span>
                                </div>
                            </div>
                        )


                    })
            }

        </div>
    )
}



type PriceVar = NonNullable<MenuItemWithAssociations["MenuItemSellingPriceVariation"]>[number]

interface CardapioItemPriceSelectProps {
    prices: MenuItemWithAssociations["MenuItemSellingPriceVariation"]
    label?: string
    defaultSelectedId?: string
    showCurrency?: boolean
    className?: string
    onSelect?: (variation: PriceVar) => void
}

export function CardapioItemPriceSelect({
    prices,
    label = "Tamanho",
    defaultSelectedId,
    showCurrency = true,
    className,
    onSelect,
}: CardapioItemPriceSelectProps) {
    const [open, setOpen] = React.useState(false)

    const list = React.useMemo(() => {
        return (prices ?? [])
            .filter(p => p.showOnCardapio)
            .sort((a, b) => (a.MenuItemSize?.sortOrderIndex ?? 0) - (b.MenuItemSize?.sortOrderIndex ?? 0))
    }, [prices])

    const [current, setCurrent] = React.useState<PriceVar | null>(() => {
        if (!list.length) return null
        const found = list.find(p => p.id === defaultSelectedId)
        return found ?? list[2]
    })

    function handleSelect(v: PriceVar) {
        setCurrent(v)
        setOpen(false)
        onSelect?.(v)
    }

    const triggerText = current
        ? (
            <div className="flex justify-between items-center w-full font-neue font-normal text-xs tracking-wide truncate">
                <span>{current.MenuItemSize?.nameShort}</span>
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
                            const text = `${p.MenuItemSize?.nameShort} • ${showCurrency ? "R$ " : ""}${p.priceAmount}`
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
                                        {/* <span className="font-medium leading-tight">{p.MenuItemSize?.name ?? p.MenuItemSize?.nameShort}</span> */}
                                        <span className="text-xs">{p.MenuItemSize?.nameShort}</span>
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
