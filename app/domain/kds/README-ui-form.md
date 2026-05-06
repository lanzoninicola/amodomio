# README — UI Form KDS (Order Detail)

Este documento descreve o contrato de payload do formulário da linha do KDS e o fluxo UI → FormData → action.

## Documentação UI — KDS Order Detail (linha do formulário)

**Contexto**
Cada pedido do KDS é exibido como uma linha com inputs inline e dialogs auxiliares. O form é responsável por edição rápida e envio ao backend.

**Componentes principais (com arquivo)**

- `MoneyInput` (`app/components/money-input/MoneyInput.tsx`): input monetário com teclado numérico e hidden field.
- `SizeSelector` (`app/domain/kds/components/SizeSelector.tsx`): seletor de tamanhos com botões e “Zerar”.
- `DeliveryZoneCombobox` (`app/domain/kds/components/delivery-zone-combobox`): combobox de zonas quando delivery está ativo.
- `DetailsDialog` (`app/domain/kds/components/DetailsDialog.tsx`): detalhes + status + cliente.

**Campos visíveis na linha**

- Comanda (input numérico)
- Pedido (R$) + ícone de cartão
- Tamanhos (botões F/M/P/I/FT)
- Canal (select)
- Delivery (switch + zona + valor moto)
- Retirada (switch)
- Detalhes (botão)
- Ações (salvar / excluir)

**Campos ocultos enviados no submit**

- `_action`, `id`, `date`
- `commandNumber`, `orderAmount`, `motoValue`
- `hasMoto`, `takeAway`, `isCreditCard`
- `sizeF`, `sizeM`, `sizeP`, `sizeI`, `sizeFT`
- `channel`, `deliveryZoneId`
- `customerName`, `customerPhone`, `status` (quando alterados no dialog)

**Regras de negócio frontend**

- Delivery (`hasMoto`) e Retirada (`takeAway`) são mutuamente exclusivos.
- `DeliveryZoneCombobox` só habilita quando `hasMoto = true`.
- `motoValue` só habilita quando `hasMoto = true`.
- `SizeSelector` incrementa tamanhos e mantém hidden inputs sincronizados.
- `MoneyInput` aplica máscara numérica e envia valor formatado no hidden field.
- `DetailsDialog` permite editar status e dados do cliente e dispara submit manual.

**Screenshots (opcional)**

- `docs/images/kds-row-form.png` (linha do pedido)
- `docs/images/kds-details-dialog.png` (dialog de detalhes)

**Mapa campo → componente → payload**

| UI                | Componente             | Payload                                      |
| ----------------- | ---------------------- | -------------------------------------------- |
| Comanda           | `CommandNumberInput`   | `commandNumber`                              |
| Pedido (R$)       | `MoneyInput`           | `orderAmount`                                |
| Cartão (ícone)    | `CreditCard` toggle    | `isCreditCard`                               |
| Tamanhos          | `SizeSelector`         | `sizeF`, `sizeM`, `sizeP`, `sizeI`, `sizeFT` |
| Canal             | `Select`               | `channel`                                    |
| Delivery (switch) | `Switch`               | `hasMoto`                                    |
| Delivery zone     | `DeliveryZoneCombobox` | `deliveryZoneId`                             |
| Moto (R$)         | `MoneyInput`           | `motoValue`                                  |
| Retirada (switch) | `Switch`               | `takeAway`                                   |
| Detalhes          | `DetailsDialog`        | `status`, `customerName`, `customerPhone`    |

**Codigo dos componentes principais (referencia)**

MoneyInput (`app/components/money-input/MoneyInput.tsx`):
```tsx
import { useEffect, useState } from "react";
import type { DecimalLike } from "../../domain/kds/types";
import { cn } from "~/lib/utils";
type Props = {
  name: string;
  defaultValue?: DecimalLike | null;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  readOnly?: boolean;
  onValueChange?: (value: number) => void;
};
function toCents(v?: DecimalLike | null) {
  const n = v == null ? 0 : typeof v === "number" ? v : Number((v as any)?.toString?.() ?? `${v}`);
  return Math.max(0, Math.round((Number.isFinite(n) ? n : 0) * 100));
}
export function MoneyInput({ name, defaultValue, placeholder, className, disabled = false, readOnly = false, onValueChange, ...props }: Props) {
  const [cents, setCents] = useState<number>(toCents(defaultValue));
  useEffect(() => setCents(toCents(defaultValue)), [defaultValue]);
  const display = (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (disabled || readOnly) return;
    const k = e.key;
    if (k === "Enter") return;
    if (k === "Backspace") {
      e.preventDefault();
      setCents((c) => {
        const next = Math.floor(c / 10);
        onValueChange?.(next / 100);
        return next;
      });
      return;
    }
    if (k === "Delete" || k === "Del" || e.code === "Delete") {
      e.preventDefault();
      setCents(() => {
        const next = 0;
        onValueChange?.(next / 100);
        return next;
      });
      return;
    }
    if (/^\\d$/.test(k)) {
      e.preventDefault();
      setCents((c) => {
        const next = (c * 10 + Number(k)) % 1000000000;
        onValueChange?.(next / 100);
        return next;
      });
      return;
    }
    if (k === "Tab" || k.startsWith("Arrow") || k === "Home" || k === "End") return;
    e.preventDefault();
  }
  return (<div className="relative">
    <input type="text" inputMode="numeric" value={display} onKeyDown={onKeyDown} onChange={() => { }} disabled={disabled}
      readOnly={readOnly || false}
      className={
        cn(
          "w-24 h-9 border rounded px-2 py-1 text-right",
          disabled ? "bg-gray-50 text-gray-400" : "",
          readOnly && "border-none",
          className
        )
      }
      placeholder={placeholder}
      {...props}
    />
    <input type="hidden" name={name} value={(cents / 100).toFixed(2)} />
  </div>);
}
```

SizeSelector (`app/domain/kds/components/SizeSelector.tsx`):
```tsx
import { Badge } from "@/components/ui/badge";
import type { SizeCounts } from "../types";
import { defaultSizeCounts } from "../types";

export function SizeSelector({
  counts,
  onChange,
  disabled,
  limit,
}: {
  counts: SizeCounts;
  onChange: (next: SizeCounts) => void;
  disabled?: boolean;
  limit?: Partial<Record<keyof SizeCounts, number>>;
}) {
  function inc(k: keyof SizeCounts) {
    if (disabled) return;
    const max = limit?.[k];
    if (typeof max === "number" && counts[k] >= max) return;
    onChange({ ...counts, [k]: counts[k] + 1 });
  }

  function reset() {
    if (disabled) return;
    onChange(defaultSizeCounts());
  }

  return (
    <div className="flex items-center gap-3">
      {(["F", "M", "P", "I", "FT"] as (keyof SizeCounts)[]).map((k) => {
        const max = limit?.[k];
        const title = max != null ? `${k} (ate ${max})` : k === "FT" ? "FATIA" : String(k);

        return (
          <button
            key={k}
            type="button"
            onClick={() => inc(k)}
            className={`w-10 h-10 rounded-full border flex items-center justify-center text-sm font-semibold
        ${counts[k] > 0 ? "bg-blue-800 text-white" : "bg-white"} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            disabled={disabled}
            title={title}
          >
            {k}
            {counts[k] > 0 && <span className="ml-1">{counts[k]}</span>}
          </button>
        );
      })}
      <Badge
        variant="secondary"
        onClick={reset}
        className={`ml-1 cursor-pointer ${disabled ? "opacity-50 pointer-events-none" : ""}`}
      >
        Zerar
      </Badge>
    </div>
  );
}
```

## 1) Contrato de payload (saveRow)

Origem: `rowFx.Form` em `app/routes/admin.kds.atendimento.$date.grid.tsx`.

Payload enviado via `FormData`:

```json
{
  "_action": "saveRow",
  "id": "uuid",
  "date": "YYYY-MM-DD",
  "commandNumber": "123",
  "orderAmount": "89.90",
  "motoValue": "6.00",
  "hasMoto": "on",
  "takeAway": "",
  "sizeF": "0",
  "sizeM": "1",
  "sizeP": "2",
  "sizeI": "0",
  "sizeFT": "0",
  "channel": "CARDÁPIO",
  "deliveryZoneId": "ZONE_ID_AQUI",
  "isCreditCard": "on",
  "customerName": "João Silva",
  "customerPhone": "41999998888",
  "status": "novoPedido"
}
```

Notas:

- `commandNumber` pode ser vazio quando `isVendaLivre` (no backend).
- Campos booleanos são enviados como `"on"` ou `""`.
- `orderAmount` e `motoValue` são strings formatadas com 2 casas decimais.
- `size*` são strings numéricas.
- `status` é enviado principalmente via `DetailsDialog` (mudança de status ou salvar).

## 2) Diagrama de fluxo (UI → FormData → Action)

```text
[Usuário interage com UI]
        |
        v
[Estados locais atualizados]
  - cmdLocal (comanda)
  - sizes (F/M/P/I/FT)
  - hasMoto / takeAway
  - deliveryZoneId
  - isCreditCard
  - customerName / customerPhone
        |
        v
[Hidden inputs sincronizados]
  - commandNumber
  - sizeF..sizeFT
  - deliveryZoneId
  - isCreditCard
  - hasMoto / takeAway
        |
        v
[Submit do form]
  - Botão "Salvar" (rowFx.Form)
  - Ou submit manual no DetailsDialog
        |
        v
[Action "saveRow" (server)]
  - valida comanda
  - calcula status auto
  - persiste dados no KDS
  - retorna JSON ok/erro
```

## 3) Regras principais no frontend

- `hasMoto` (Delivery) e `takeAway` (Retirada) são mutuamente exclusivos.
- `DeliveryZoneCombobox` só habilita quando `hasMoto = true`.
- `motoValue` só habilita quando `hasMoto = true`.
- `SizeSelector` incrementa tamanhos e atualiza `sizeF..sizeFT`.
- `MoneyInput` converte teclado numérico para valor monetário e envia hidden com `name`.
- `DetailsDialog` permite editar `status`, `customerName` e `customerPhone`.
