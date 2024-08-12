import { ArrowRight } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import ExternalLink from '~/components/primitives/external-link/external-link';
import GLOBAL_LINKS from '~/domain/website-navigation/global-links.constant';

const labels = ["ESTAMOS FECHADOS", "HORÁRIO DE ATENDIMENTO", "18:00 - 22:00"];

export default function FazerPedidoButton({ isStoreOpen }: { isStoreOpen: boolean }) {
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
        <div className="w-full">
            <ExternalLink
                to={GLOBAL_LINKS.mogoCardapio.href}
                ariaLabel="Cardápio digital pizzaria A Modo Mio"
                className={`flex items-center justify-between font-body-website rounded-sm ${isStoreOpen ? 'bg-green-500' : 'bg-red-500'
                    } py-2 px-4`}
            >
                {isStoreOpen ? (
                    <>
                        <span className="uppercase tracking-wide font-semibold text-white">
                            Fazer pedido
                        </span>
                        <ArrowRight color="white" />
                    </>
                ) : (
                    <div className="relative h-6 overflow-hidden">
                        <div
                            className="transition-transform duration-1000 ease-in-out"

                        >
                            {labels.map((label, index) => (
                                <div
                                    key={index}
                                    className="h-6 text-left tracking-wide font-semibold text-white"
                                    style={{ transform: `translateY(-${currentLabelIndex * 100}%)` }}
                                >
                                    {label}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </ExternalLink>
        </div>
    );
}
