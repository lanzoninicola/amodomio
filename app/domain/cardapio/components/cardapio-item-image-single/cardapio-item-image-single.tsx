import { useEffect, useRef, useState } from "react";
import { useRandomMessages } from "~/hooks/use-random-message";
import { cn } from "~/lib/utils";

type Props = {
    src?: string;
    alt?: string;
    fallbackColor?: string;
    placeholder?: string;
    placeholderIcon?: boolean;
    cnPlaceholderIcon?: string;
    placeholderText?: string;
    cnPlaceholderText?: string;
    cnContainer?: string;
    enableOverlay?: boolean;
    itemId?: string; // Opcional: para gerar frases diferentes para cada item
};

export default function CardapioItemImageSingle({
    src,
    alt = "Imagem do item",
    fallbackColor = "#1f2937",
    placeholder,
    placeholderIcon = false,
    cnPlaceholderIcon,
    placeholderText,
    cnPlaceholderText,
    cnContainer,
    enableOverlay = true,
    itemId,
}: Props) {
    const [loaded, setLoaded] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);

    // Usa o hook para gerar mensagens aleatórias quando não há src
    const randomMessage = useRandomMessages({
        condition: !src,
        dependencies: itemId ? [itemId] : [] // Gera nova mensagem para cada item
    });

    useEffect(() => {
        if (imgRef.current && imgRef.current.complete) {
            setLoaded(true);
        }
    }, [src]);

    return (
        <div className={cn("relative w-full h-screen overflow-hidden bg-gray-800", cnContainer)}>
            {/* Placeholder visual (blurred) */}
            {placeholder && !loaded && (
                <img
                    src={placeholder}
                    alt="Placeholder"
                    className="absolute w-full h-full object-cover blur-sm scale-105 transition-opacity duration-500"
                />
            )}

            {/* Real image */}
            {src ? (
                <img
                    ref={imgRef}
                    src={src}
                    alt={alt}
                    onLoad={() => setLoaded(true)}
                    className={cn(
                        "absolute w-full h-full object-cover transition-opacity duration-700 ease-in-out",
                        loaded ? "opacity-100 animate-zoomOnce" : "opacity-0"
                    )}
                />
            ) : (
                <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 via-zinc-800 to-black" data-element="image-placeholder">
                    <div className="w-full h-full flex items-center justify-center">
                        <div className="flex flex-col items-center justify-center text-center px-4 max-w-md">
                            {placeholderIcon && (
                                <img
                                    src="/images/cardapio-web-app/pizza-placeholder-grey-sm.png"
                                    alt="Placeholder icon"
                                    className={cn("w-[50px] mx-auto mb-4", cnPlaceholderIcon)}
                                />
                            )}
                            <p
                                className={cn(
                                    "text-white text-sm font-mono tracking-wide uppercase opacity-80 leading-tight animate-fade-in mb-8",
                                    cnPlaceholderText
                                )}
                                data-element="item-image-placeholder-text"
                            >
                                {placeholderText || randomMessage}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Overlay gradiente escuro */}
            {enableOverlay && (
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />
            )}
        </div>
    );
}