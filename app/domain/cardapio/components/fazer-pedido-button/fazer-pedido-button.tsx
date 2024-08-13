import { ArrowRight } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import ExternalLink from '~/components/primitives/external-link/external-link';
import TextSlideInUp from '~/components/text-slide-in-up/text-slide-in-up';
import GLOBAL_LINKS from '~/domain/website-navigation/global-links.constant';
import { cn } from '~/lib/utils';



interface FazerPedidoButtonProps {
    cnLabel?: string;
    enabled?: boolean
}

export default function FazerPedidoButton({ cnLabel, enabled = true }: FazerPedidoButtonProps) {



    return (
        <div className="w-full font-body-website rounded-sm bg-brand-blue">

            <ExternalLink
                to={GLOBAL_LINKS.mogoCardapio.href}
                ariaLabel="Cardápio digital pizzaria A Modo Mio"
            >
                <div className='flex items-center justify-between px-4 py-2'>
                    <span className={
                        cn(
                            "uppercase tracking-wide font-semibold text-white",
                            cnLabel
                        )
                    }>
                        Fazer pedido
                    </span>
                    <ArrowRight color="white" />
                </div>
            </ExternalLink>

        </div>
    );
}

