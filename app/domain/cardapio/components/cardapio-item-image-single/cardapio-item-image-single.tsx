import { useEffect, useRef, useState } from "react";
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
}: Props) {
    const [loaded, setLoaded] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);

    useEffect(() => {
        if (imgRef.current && imgRef.current.complete) {
            setLoaded(true);
        }
    }, [src]); // re-check when src changes

    return (
        <div className={cn("relative w-full h-screen overflow-hidden bg-gray-800", cnContainer)}>
            {/* Placeholder */}
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
                <div className="absolute inset-0 bg-gray-700">
                    <div className="w-full h-full grid place-items-center">
                        <div className="flex flex-col justify-center gap-1">
                            {placeholderIcon && (
                                <img
                                    src="/images/cardapio-web-app/pizza-placeholder-grey-sm.png"
                                    alt="Placeholder icon"
                                    className={cn("w-[50px] mx-auto", cnPlaceholderIcon)}
                                />
                            )}
                            {placeholderText && (
                                <p className={cn("text-white text-center", cnPlaceholderText)}>
                                    {placeholderText}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Overlay */}
            {enableOverlay && (
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />
            )}
        </div>
    );
}
