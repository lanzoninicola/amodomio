import { ArrowRight } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import ExternalLink from '~/components/primitives/external-link/external-link';
import TextSlideInUp from '~/components/text-slide-in-up/text-slide-in-up';
import GLOBAL_LINKS from '~/domain/website-navigation/global-links.constant';
import useStoreOpeningStatus from '~/hooks/use-store-opening-status';
import { cn } from '~/lib/utils';

const labels = ["🚨 ESTAMOS FECHADOS 🚨", "HORÁRIO DE ATENDIMENTO", "QUA-DOM 18:00-22:00"];

interface FazerPedidoButtonProps {
    cnLabel?: string;
}

export default function FazerPedidoButton({ cnLabel }: FazerPedidoButtonProps) {

    const isStoreOpen = useStoreOpeningStatus()

    return (
        <div className={
            cn(
                "w-full font-body-website rounded-sm ",
                isStoreOpen ? 'bg-green-500' : 'bg-green-200',
            )
        }>

            {isStoreOpen ? (
                <ExternalLink
                    to={GLOBAL_LINKS.mogoCardapio.href}
                    ariaLabel="Cardápio digital pizzaria A Modo Mio"
                >
                    <div className='flex items-center justify-between px-4 py-2'>
                        <span className={
                            cn(
                                "uppercase tracking-wide font-semibold text-black px-4",
                                cnLabel
                            )
                        }>
                            Fazer pedido
                        </span>
                        <ArrowRight color="black" />
                    </div>
                </ExternalLink>
            ) : (
                <TextSlideInUp
                    items={labels}
                    slideCondition={isStoreOpen}
                    cnHeight="h-10"
                />
            )}

        </div>
    );
}

