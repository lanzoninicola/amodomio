import { ArrowRight } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import ExternalLink from '~/components/primitives/external-link/external-link';
import GLOBAL_LINKS from '~/domain/website-navigation/global-links.constant';
import useStoreOpeningStatus from '~/hooks/use-store-opening-status';
import { cn } from '~/lib/utils';

const labels = ["🚨 ESTAMOS FECHADOS 🚨", "HORÁRIO DE ATENDIMENTO 18:00 - 22:00"];

interface FazerPedidoButtonProps {
    cnLabel?: string;
}

export default function FazerPedidoButton({ cnLabel }: FazerPedidoButtonProps) {

    const isStoreOpen = useStoreOpeningStatus()

    const [currentLabelIndex, setCurrentLabelIndex] = useState(0);

    useEffect(() => {
        let interval: any;
        if (!isStoreOpen) {
            interval = setInterval(() => {
                setCurrentLabelIndex((prevIndex) => (prevIndex + 1) % labels.length);
            }, 3000); // Change label every 3 seconds
        } else {
            setCurrentLabelIndex(0); // Reset to first label when store opens
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isStoreOpen]);

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
                <div className="relative h-10 w-full">
                    <div
                        className="h-10 absolute top-0 left-0 right-0 transition-transform duration-500 ease-in-out overflow-hidden"

                    >
                        {labels.map((label, index) => (
                            <div
                                key={index}
                                className={cn(
                                    "h-10 w-full text-md font-semibold text-black grid place-items-center",
                                    index === currentLabelIndex && "animate-slide-in-up",
                                    cnLabel
                                )}
                                style={{ transform: `translateY(-${currentLabelIndex * 100}%)` }}
                            >
                                {label}
                            </div>
                        ))}
                    </div>
                </div>
            )}

        </div>
    );
}
