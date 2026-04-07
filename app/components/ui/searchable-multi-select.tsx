import { useEffect, useMemo, useRef, useState } from "react"
import { Check, ChevronDown, X } from "lucide-react"
import { cn } from "~/lib/utils"
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "~/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover"

export type SearchableMultiSelectOption = {
  value: string
  label: string
  searchText?: string
}

type SearchableMultiSelectProps = {
  values: string[]
  onValuesChange: (values: string[]) => void
  options: SearchableMultiSelectOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  triggerClassName?: string
  contentClassName?: string
}

export function SearchableMultiSelect({
  values,
  onValuesChange,
  options,
  placeholder = "Selecionar itens",
  searchPlaceholder = "Buscar...",
  emptyText = "Nenhum item encontrado.",
  triggerClassName,
  contentClassName,
}: SearchableMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0
  }, [search])

  const selectedOptions = useMemo(
    () => options.filter((option) => values.includes(option.value)),
    [options, values],
  )

  function toggleValue(nextValue: string) {
    if (values.includes(nextValue)) {
      onValuesChange(values.filter((value) => value !== nextValue))
      return
    }

    onValuesChange([...values, nextValue])
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "min-h-11 inline-flex w-full items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700",
            triggerClassName,
          )}
          title={selectedOptions.map((option) => option.label).join(", ") || placeholder}
        >
          <span className="min-w-0 flex-1 text-left">
            {selectedOptions.length > 0 ? (
              <span className="flex flex-wrap gap-2">
                {selectedOptions.map((option) => (
                  <span
                    key={option.value}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
                  >
                    <span className="max-w-[180px] truncate">{option.label}</span>
                    <span
                      role="button"
                      tabIndex={0}
                      className="rounded-full p-0.5 hover:bg-slate-200"
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        onValuesChange(values.filter((value) => value !== option.value))
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return
                        event.preventDefault()
                        event.stopPropagation()
                        onValuesChange(values.filter((value) => value !== option.value))
                      }}
                    >
                      <X size={12} />
                    </span>
                  </span>
                ))}
              </span>
            ) : (
              <span className="text-slate-400">{placeholder}</span>
            )}
          </span>
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
          <CommandList ref={listRef} className="max-h-[280px]">
            <CommandEmpty>{emptyText}</CommandEmpty>
            {options.map((option) => {
              const selected = values.includes(option.value)

              return (
                <CommandItem
                  key={option.value}
                  value={option.searchText || option.label}
                  onSelect={() => {
                    toggleValue(option.value)
                    setSearch("")
                  }}
                >
                  <Check size={14} className={selected ? "opacity-100 mr-2" : "opacity-0 mr-2"} />
                  <span className="truncate">{option.label}</span>
                </CommandItem>
              )
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
