import { ArrowRight } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import ExternalLink from '~/components/primitives/external-link/external-link';
import TextSlideInUp from '~/components/text-slide-in-up/text-slide-in-up';
import GLOBAL_LINKS from '~/domain/website-navigation/global-links.constant';
import { cn } from '~/lib/utils';



interface FazerPedidoButtonProps {
    cnLabel?: string;
    variant?: "primary" | "secondary" | "accent"
}

export default function FazerPedidoButton({ cnLabel, variant = "primary" }: FazerPedidoButtonProps) {



    return (
        <div className={
            cn(
                "w-full font-body-website rounded-sm",
                variant === 'primary' && 'bg-brand-blue text-white',
                variant === 'secondary' && 'bg-white text-brand-blue',
                variant === 'accent' && 'bg-brand-blue/50 text-black'

            )
        }>

            <ExternalLink
                to={GLOBAL_LINKS.mogoCardapio.href}
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
            color={variant === 'primary' ? 'white' : '#3d5f76'}
            className={isBouncing ? 'animate-bounce' : ''}
        />
    );
};