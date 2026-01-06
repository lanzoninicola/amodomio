import { Donut, Proportions, User, Users } from "lucide-react";
import React from "react";

import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";

export type SizesSelection = "individual" | "pequeno" | "medio" | "familia";

export const SIZE_ORDER: SizesSelection[] = ["individual", "pequeno", "medio", "familia"];

export const sizeConfig: Record<
    SizesSelection,
    {
        label: string;
        serves: string;
        flavors: string;
        dims: string;
        donuts: number;
        imgW: string;
    }
> = {
    individual: {
        label: "Individual",
        serves: "Serve até 1 pessoa",
        flavors: "Máximo 1 sabor",
        dims: "aprox. 25x15cm",
        donuts: 1,
        imgW: "w-[50px]",
    },
    pequeno: {
        label: "Pequeno",
        serves: "Serve até 1 pessoa",
        flavors: "Máximo 1 sabor",
        dims: "aprox. metade de uma média",
        donuts: 1,
        imgW: "w-[60px]",
    },
    medio: {
        label: "Médio",
        serves: "Serve até 2 pessoas",
        flavors: "Máximo 2 sabores",
        dims: "aprox. 40x20cm (8 fatias)",
        donuts: 2,
        imgW: "w-[80px]",
    },
    familia: {
        label: "Família",
        serves: "Serve até 6 pessoas",
        flavors: "Máximo 4 sabores",
        dims: "aprox. 60x40cm (16 fatias)",
        donuts: 4,
        imgW: "w-[120px]",
    },
};

interface CardapioSizesContentProps {
    initialSize?: SizesSelection;
    hideTitle?: boolean;
    className?: string;
}

export function CardapioSizesContent({
    initialSize = "individual",
    hideTitle = false,
    className,
}: CardapioSizesContentProps) {
    const [currentSize, setCurrentSize] = React.useState<SizesSelection>(initialSize);

    const onKeySelect: React.KeyboardEventHandler<HTMLButtonElement> = (e) => {
        if (e.key === "Enter" || e.key === " ") {
            (e.currentTarget as HTMLButtonElement).click();
            e.preventDefault();
        }
    };

    function ButtonSelection({ size }: { size: SizesSelection }) {
        const cfg = sizeConfig[size];
        const active = currentSize === size;

        return (
            <button
                type="button"
                role="tab"
                aria-pressed={active}
                aria-selected={active}
                onKeyDown={onKeySelect}
                onClick={() => setCurrentSize(size)}
                className={cn(
                    "group relative flex flex-col items-center justify-center gap-y-4 rounded-xl border transition h-[130px]",
                    "hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/40",
                    active ? "border-brand-blue bg-brand-blue/5" : "border-zinc-200 bg-white"
                )}
            >
                <img
                    src="/images/cardapio-web-app/pizza-placeholder-sm.png"
                    alt={`Tamanho ${cfg.label}`}
                    className={cn(cfg.imgW, "h-auto")}
                    draggable={false}
                />
                <span className="mt-2 font-neue text-sm font-semibold tracking-wide uppercase">
                    {cfg.label}
                </span>

                {active && (
                    <span className="absolute -top-2 right-2 rounded-full bg-brand-blue px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
                        Selecionado
                    </span>
                )}
            </button>
        );
    }

    const current = sizeConfig[currentSize];

    return (
        <div className={cn("h-full overflow-auto py-4", className)}>
            {!hideTitle && (
                <div className="mb-6">
                    <h3 className="font-neue text-2xl font-semibold tracking-tight">Tamanhos disponíveis</h3>
                    <span className="text-sm text-zinc-600">Selecione o tamanho para visualizar os detalhes</span>
                </div>
            )}

            <div role="tablist" aria-label="Selecionar tamanho" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {SIZE_ORDER.map((s) => (
                    <ButtonSelection key={s} size={s} />
                ))}
            </div>

            <Separator className="my-6" />

            <div className="mx-auto flex max-w-sm flex-col items-center gap-y-2 text-center">
                <h4 className="mb-2 font-neue text-lg font-semibold uppercase ">Tamanho {current.label}</h4>

                <div className="grid grid-cols-3 gap-x-4 font-neue">
                    <div className="flex flex-col items-center gap-2 leading-tight text-sm">
                        {currentSize === "familia" || currentSize === "medio" ? <Users size={32} /> : <User size={32} />}
                        <span>{current.serves}</span>
                    </div>

                    <div className="flex flex-col items-center gap-2 leading-tight text-sm">
                        <div className="flex gap-1">
                            {Array.from({ length: current.donuts }).map((_, i) => (
                                <Donut key={i} size={32} />
                            ))}
                        </div>
                        <span>{current.flavors}</span>
                    </div>

                    <div className="flex flex-col items-center gap-2 leading-tight text-sm">
                        <Proportions size={32} />
                        <span>{current.dims}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
