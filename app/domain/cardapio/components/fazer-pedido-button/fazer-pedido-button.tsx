import { ArrowRight } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import ExternalLink from '~/components/primitives/external-link/external-link';
import GLOBAL_LINKS from '~/domain/website-navigation/global-links.constant';
import useBrandColors from '~/hooks/use-brand-colors';
import { cn } from '~/lib/utils';

type Variant = 'primary' | 'secondary' | 'accent';
type Size = 'sm' | 'md' | 'lg';

interface FazerPedidoButtonProps {
    cnLabel?: string;            // compat
    cnContainer?: string;        // compat (vira className no link)
    className?: string;          // extra class
    label?: string;              // texto do botão
    size?: Size;                 // sm | md | lg
    loading?: boolean;
    disabled?: boolean;
    iconRight?: React.ReactNode; // override do ícone
    variant?: Variant;
    externalLinkURL?: string;
    ariaLabel?: string;
}

export default function FazerPedidoButton({
    cnLabel,
    cnContainer,
    className,
    label = 'Fazer pedido',
    size = 'md',
    loading = false,
    disabled = false,
    iconRight,
    variant = 'primary',
    externalLinkURL = GLOBAL_LINKS.cardapioFallbackURL.href,
    ariaLabel,
}: FazerPedidoButtonProps) {
    const brandColors = useBrandColors();

    const variantClasses = useMemo(() => {
        const base =
            'rounded-sm shadow-md transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-black/20';
        const byVariant: Record<Variant, string> = {
            primary: 'bg-black text-white hover:bg-black/90',
            secondary: 'bg-white text-black border border-black/10 hover:bg-black/5',
            accent: 'text-white hover:opacity-95',
        };
        return cn(base, byVariant[variant]);
    }, [variant]);

    const sizeClasses = useMemo(() => {
        const paddings: Record<Size, string> = {
            sm: 'px-4 py-2',
            md: 'px-4 py-2.5',
            lg: 'px-7 py-3',
        };
        const text: Record<Size, string> = {
            sm: 'text-[13px]',
            md: 'text-[15px]',
            lg: 'text-[16px]',
        };
        return `${paddings[size]} ${text[size]}`;
    }, [size]);

    const dynamicStyle =
        variant === 'accent'
            ? { backgroundColor: brandColors.accent.green, color: 'white' }
            : undefined;

    const computedAriaLabel = ariaLabel ?? 'Abrir cardápio digital da A Modo Mio';
    const isInteractive = !disabled && !loading;

    return (
        <ExternalLink
            to={externalLinkURL}
            ariaLabel={computedAriaLabel}
            rel="noopener noreferrer"
            className={cn(
                'block w-full font-neue',
                variantClasses,
                sizeClasses,
                (disabled || loading) && 'opacity-60 pointer-events-none',
                cnContainer,
                className
            )}
            style={dynamicStyle}
            aria-busy={loading || undefined}
            onClick={(e) => {
                if (!isInteractive) e.preventDefault();
            }}
        >
            <div className="flex items-center justify-between gap-4">
                <span
                    className={cn(
                        'uppercase tracking-wide font-semibold',
                        size === 'lg' ? 'text-base' : 'text-sm',
                        cnLabel
                    )}
                >
                    {loading ? 'Carregando…' : label}
                </span>
                {iconRight ?? <BouncingArrow variant={variant} paused={!isInteractive} />}
            </div>
        </ExternalLink>
    );
}

interface BouncingArrowProps {
    variant?: Variant;
    paused?: boolean;
}

const BouncingArrow: React.FC<BouncingArrowProps> = ({ variant, paused }) => {
    const [isBouncing, setIsBouncing] = useState(false);
    const intervalRef = useRef<number | null>(null);

    useEffect(() => {
        const prefersReduced =
            typeof window !== 'undefined' &&
            window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

        const start = () => {
            intervalRef.current = window.setInterval(() => {
                setIsBouncing(true);
                window.setTimeout(() => setIsBouncing(false), 900);
            }, 4000);
        };

        const onVisibilityChange = () => {
            if (document.hidden && intervalRef.current) {
                window.clearInterval(intervalRef.current);
                intervalRef.current = null;
            } else if (!document.hidden && !intervalRef.current && !prefersReduced && !paused) {
                start();
            }
        };

        if (!prefersReduced && !paused) start();
        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            if (intervalRef.current) window.clearInterval(intervalRef.current);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [paused]);

    const color = variant === 'primary' || variant === 'accent' ? 'white' : '#3d5f76';

    return (
        <ArrowRight
            color={color}
            className={cn(
                isBouncing ? 'animate-bounce' : '',
                'motion-reduce:animate-none transition-transform'
            )}
            aria-hidden="true"
        />
    );
};
