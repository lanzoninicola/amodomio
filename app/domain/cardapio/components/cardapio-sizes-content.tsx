import { Donut, Proportions, User, Users } from "lucide-react";
import React from "react";

import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";
import formatMoneyString from "~/utils/format-money-string";

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
        dims: "aprox. metade de uma pequena",
        donuts: 1,
        imgW: "w-[50px]",
    },
    pequeno: {
        label: "Pequeno",
        serves: "Serve até 2 pessoas",
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

interface CardapioSizesSectionsProps {
    hideTitle?: boolean;
    className?: string;
    sizes?: Array<{
        id: string;
        name: string;
        nameShort?: string | null;
        maxServeAmount?: number | null;
        maxServeAmountDescription?: string | null;
        maxToppingsAmount?: number | null;
        maxToppingsAmountDescription?: string | null;
        minPrice?: number | null;
        maxPrice?: number | null;
    }>;
}

export function CardapioSizesSections({ hideTitle = false, className, sizes }: CardapioSizesSectionsProps) {
    const sections = sizes?.length
        ? sizes.map((size) => {
            const serves =
                size.maxServeAmountDescription ||
                (size.maxServeAmount
                    ? `Serve até ${size.maxServeAmount} ${size.maxServeAmount === 1 ? "pessoa" : "pessoas"}`
                    : "Serve sob consulta");
            const flavors =
                size.maxToppingsAmountDescription ||
                (size.maxToppingsAmount
                    ? `Máximo ${size.maxToppingsAmount} sabores`
                    : "Máximo de sabores sob consulta");
            const priceText =
                size.minPrice != null
                    ? size.maxPrice != null && size.maxPrice !== size.minPrice
                        ? `de ${formatMoneyString(size.minPrice)} até ${formatMoneyString(size.maxPrice)}`
                        : `${formatMoneyString(size.minPrice)}`
                    : null;

            return {
                key: size.id,
                label: size.name,
                primary: serves,
                details: [flavors, priceText].filter(Boolean) as string[],
            };
        })
        : SIZE_ORDER.map((size) => {
            const info = sizeConfig[size];
            return {
                key: size,
                label: info.label,
                primary: info.serves,
                details: [info.flavors, info.dims],
            };
        });

    return (
        <div className={cn("h-full", className)}>
            {!hideTitle && (
                <div className="mb-6">
                    <h3 className="font-neue text-2xl font-semibold tracking-tight">Tamanhos disponíveis</h3>
                    <span className="text-sm text-zinc-600">Confira cada tamanho com pessoas, sabores e medidas</span>
                </div>
            )}

            <div className="divide-y divide-zinc-200 rounded-2xl bg-white/80 px-4 shadow-sm">
                {sections.map((section) => (
                    <div key={section.key} className="flex flex-col gap-3 py-5">
                        <span className="text-lg font-semibold text-brand-blue">{section.label}</span>
                        <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-zinc-900">
                            {section.primary}
                        </div>
                        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                            {section.details.map((detail, index) => (
                                <div
                                    key={`${section.key}-detail-${index}`}
                                    className={cn("text-zinc-700", index > 0 && "text-zinc-500 text-right")}
                                >
                                    {detail}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
