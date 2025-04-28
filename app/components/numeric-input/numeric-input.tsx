import { Input } from "@/components/ui/input";
import { useState } from "react";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "~/lib/utils";

type NumericInputProps = ComponentPropsWithoutRef<typeof Input> & {
    decimalScale?: number; // quantos dígitos após a vírgula
};

export function NumericInput({ decimalScale = 2, ...props }: NumericInputProps) {
    const [value, setValue] = useState('');

    const formatToDecimal = (input: string) => {
        const numeric = input.replace(/\D/g, '');

        const divisor = 10 ** decimalScale;
        const number = parseInt(numeric || '0', 10);

        return (number / divisor).toLocaleString('pt-BR', {
            minimumFractionDigits: decimalScale,
            maximumFractionDigits: decimalScale,
        });
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        const formatted = formatToDecimal(raw);
        setValue(formatted);

        props.onChange?.(e);
    };


    return (
        <Input
            {...props}
            onChange={handleChange}
            inputMode="numeric"
            placeholder={props.placeholder ?? `0,${'0'.repeat(decimalScale)}`}
            className={cn(
                `text-right font-mono ${props.className ?? ''}`,
                props.className,
                props.readOnly && 'cursor-not-allowed border-none outline-none ',

            )}
        />
    );
}
