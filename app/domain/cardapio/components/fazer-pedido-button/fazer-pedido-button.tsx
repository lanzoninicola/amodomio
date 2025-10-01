import { ArrowRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import ExternalLink from '~/components/primitives/external-link/external-link';
import GLOBAL_LINKS from '~/domain/website-navigation/global-links.constant';
import useBrandColors from '~/hooks/use-brand-colors';
import { cn } from '~/lib/utils';



interface FazerPedidoButtonProps {
    cnLabel?: string;
    variant?: "primary" | "secondary" | "accent"
    externalLinkURL?: string
}

export default function FazerPedidoButton({
    cnLabel,
    variant = "primary",
    externalLinkURL = GLOBAL_LINKS.cardapioFallbackURL.href
}: FazerPedidoButtonProps) {
    const brandColors = useBrandColors()

    let style = {}

    if (variant === 'accent') {
        style = {
            ...style,
            backgroundColor: brandColors.accent.green,
            color: 'white'
        }
    }



    return (
        <div className={
            cn(
                "w-full font-neue rounded-sm shadow-md",
                variant === 'primary' && 'bg-black text-white',
                variant === 'secondary' && 'bg-white text-black',
            )
        }
            style={style}

        >

            <ExternalLink
                to={externalLinkURL}
                ariaLabel="Cardápio digital pizzaria A Modo Mio"
            >
                <div className='flex items-center justify-between px-4 py-2'>
                    <span className={
                        cn(
                            "uppercase tracking-wide font-semibold",
                            cnLabel
                        )
                    }>
                        Fazer pedido
                    </span>
                    <BouncingArrow variant={variant} />
                </div>
            </ExternalLink>

        </div>
    );
}

interface BouncingArrow {
    variant?: FazerPedidoButtonProps["variant"]
}

const BouncingArrow = ({ variant }: BouncingArrow) => {
    const [isBouncing, setIsBouncing] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => {
            setIsBouncing(true);
            setTimeout(() => setIsBouncing(false), 1000); // Controls the duration of the bounce
        }, 4000); // Controls how often the bounce happens

        return () => clearInterval(interval); // Cleanup the interval on component unmount
    }, []);

    return (
        <ArrowRight
            color={variant === 'primary' || variant === 'accent' ? 'white' : '#3d5f76'}
            className={isBouncing ? 'animate-bounce' : ''}
        />
    );
};