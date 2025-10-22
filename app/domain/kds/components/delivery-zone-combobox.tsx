// shadcn/ui – Combobox (Popover + Command)
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "~/components/ui/popover";
import {
  Command,
  CommandList,
  CommandEmpty,
  CommandInput,
  CommandGroup,
  CommandItem,
} from "~/components/ui/command";
import { ChevronsUpDown, Check } from "lucide-react";
import { useState, useMemo } from "react";
import { Button } from "~/components/ui/button";

/* ===========================
   Tipos locais
   =========================== */
type DeliveryZoneOption = { id: string; name: string };


export default function DeliveryZoneCombobox({
  options,
  value,
  onChange,
  placeholder = "Selecionar zona",
  disabled = false,
  className = "w-[220px]",
}: {
  options: DeliveryZoneOption[];
  value: string | null | undefined;
  onChange: (next: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const selected = useMemo(
    () => options.find((o) => o.id === value) || null,
    [options, value]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={`justify-between h-9 ${className} ${disabled ? "opacity-60 pointer-events-none" : ""}`}
        >
          <span className="truncate">
            {selected ? selected.name : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[320px]">
        <Command shouldFilter={true}>
          <CommandInput placeholder="Digite o nome da zona..." />
          <CommandEmpty>Nenhuma zona encontrada.</CommandEmpty>
          <CommandList>
            <CommandGroup heading="Zonas">
              {/* Opção para limpar */}
              <CommandItem
                value="(sem zona)"
                onSelect={() => { onChange(null); setOpen(false); }}
              >
                <Check className={`mr-2 h-4 w-4 ${value == null ? "opacity-100" : "opacity-0"}`} />
                (sem zona)
              </CommandItem>
              {options.map((opt) => (
                <CommandItem
                  key={opt.id}
                  value={opt.name}
                  onSelect={() => { onChange(opt.id); setOpen(false); }}
                >
                  <Check className={`mr-2 h-4 w-4 ${value === opt.id ? "opacity-100" : "opacity-0"}`} />
                  {opt.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}