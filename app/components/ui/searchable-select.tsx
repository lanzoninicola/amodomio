import { useMemo, useRef, useEffect, useState } from "react"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "~/lib/utils"
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "~/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover"

export type SearchableSelectOption = {
  value: string
  label: string
  searchText?: string
}

type SearchableSelectProps = {
  value: string
  onValueChange: (value: string) => void
  options: SearchableSelectOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  triggerClassName?: string
  contentClassName?: string
  renderOption?: (option: SearchableSelectOption, selected: boolean) => React.ReactNode
}

export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = "Selecionar",
  searchPlaceholder = "Buscar...",
  emptyText = "Nenhum item encontrado.",
  triggerClassName,
  contentClassName,
  renderOption,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0
  }, [search])

  const selected = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  )

  const label = selected?.label ?? placeholder

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "h-9 inline-flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 min-w-[180px] max-w-[260px]",
            triggerClassName,
          )}
          title={label}
        >
          <span className="truncate">{label}</span>
          <ChevronDown size={14} className="shrink-0 text-slate-500" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn("p-0 w-[320px] max-w-[calc(100vw-2rem)]", contentClassName)}
      >
        <Command>
          <CommandInput
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList ref={listRef} className="max-h-[240px]">
            <CommandEmpty>{emptyText}</CommandEmpty>
            {options.map((option) => (
              <CommandItem
                key={option.value}
                value={option.searchText || option.label}
                onSelect={() => {
                  onValueChange(option.value)
                  setOpen(false)
                  setSearch("")
                }}
              >
                {renderOption ? (
                  renderOption(option, value === option.value)
                ) : (
                  <>
                    <Check size={14} className={value === option.value ? "opacity-100 mr-2" : "opacity-0 mr-2"} />
                    <span className="truncate">{option.label}</span>
                  </>
                )}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
