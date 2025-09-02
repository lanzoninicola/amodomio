import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { DecimalLike } from "~/domain/kds";


type BaseProps = {
  id?: string
  name: string;
  defaultValue?: DecimalLike | null;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  readOnly?: boolean;
};

function toNumber(v?: DecimalLike | null) {
  const n =
    v == null
      ? 0
      : typeof v === "number"
        ? v
        : Number((v as any)?.toString?.() ?? `${v}`);
  return Number.isFinite(n) ? n : 0;
}

/** Limita magnitude para evitar overflow visual */
const MAX_MAGNITUDE = 1_000_000_000_000; // 1e12

/** Handler genérico de teclado no estilo "calculadora" */
function useDigitKeyboard(setUnits: React.Dispatch<React.SetStateAction<number>>, disabled?: boolean) {
  return function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;
    const k = e.key;
    if (k === "Enter") return;

    if (k === "Backspace") {
      e.preventDefault();
      setUnits((u) => Math.floor(u / 10));
      return;
    }
    if (k === "Delete") {
      e.preventDefault();
      setUnits(0);
      return;
    }
    if (/^\d$/.test(k)) {
      e.preventDefault();
      setUnits((u) => {
        const next = u * 10 + Number(k);
        // evita crescer indefinidamente
        return next % (MAX_MAGNITUDE * 10);
      });
      return;
    }
    if (k === "Tab" || k.startsWith("Arrow") || k === "Home" || k === "End") return;

    e.preventDefault();
  };
}

/* ===========================
 * IntegerInput
 * =========================== */
export function IntegerInput({
  name,
  defaultValue,
  placeholder,
  className = "w-24",
  disabled = false,
  onChange,
  readOnly = false,
  ...props
}: BaseProps) {
  // "units" já é o valor inteiro (sem escala)
  const initial = Math.max(0, Math.round(toNumber(defaultValue)));
  const [units, setUnits] = useState<number>(initial);

  useEffect(() => setUnits(Math.max(0, Math.round(toNumber(defaultValue)))), [defaultValue]);

  const onKeyDown = useDigitKeyboard(setUnits, disabled);

  const display = useMemo(() => {
    return Math.min(units, MAX_MAGNITUDE).toLocaleString("pt-BR", {
      maximumFractionDigits: 0,
    });
  }, [units]);

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        value={display}
        onKeyDown={onKeyDown}
        onChange={onChange ? (e) => onChange(Number(e.target.value)) : () => { }}
        disabled={disabled}
        className={`${className} h-9 border rounded px-2 py-1 text-right ${disabled ? "bg-gray-50 text-gray-400" : ""
          }`}
        placeholder={placeholder}
        {...props}
      />
      <input type="hidden" name={name} value={String(units)} />
    </div>
  );
}

/* ===========================
 * DecimalInput (configurável)
 * =========================== */
type DecimalInputProps = BaseProps & {
  /** Casas decimais (padrão 2, mesmo comportamento do MoneyInput) */
  fractionDigits?: number;

};

export function DecimalInput({
  name,
  defaultValue,
  placeholder,
  className = "w-24",
  disabled = false,
  fractionDigits = 2,
  onChange,
  readOnly = false,
}: DecimalInputProps) {
  // escala 10^fractionDigits (ex.: 2 casas => 100)
  const scale = useMemo(() => Math.pow(10, Math.max(0, Math.floor(fractionDigits))), [fractionDigits]);

  // Armazenamos em "units" o valor inteiro já escalado (ex.: 12,34 => 1234)
  const initialUnits = Math.max(0, Math.round(toNumber(defaultValue) * scale));
  const [units, setUnits] = useState<number>(initialUnits);

  useEffect(() => {
    setUnits(Math.max(0, Math.round(toNumber(defaultValue) * scale)));
  }, [defaultValue, scale]);

  const onKeyDown = useDigitKeyboard(setUnits, disabled);

  const value = units / scale;

  const display = useMemo(() => {
    return Math.min(value, MAX_MAGNITUDE).toLocaleString("pt-BR", {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
  }, [value, fractionDigits]);

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        value={display}
        onKeyDown={onKeyDown}
        onChange={onChange ? (e) => onChange(Number(e.target.value)) : () => { }}
        disabled={disabled}
        className={`${className} h-9 border rounded px-2 py-1 text-right ${disabled ? "bg-gray-50 text-gray-400" : ""
          }`}
        placeholder={placeholder}
        readOnly={readOnly}
      />
      <input type="hidden" name={name} value={value.toFixed(fractionDigits)} />
    </div>
  );
}
