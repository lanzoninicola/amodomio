import { useState } from "react";

type Props = {
    src?: string;
    alt?: string;
    fallbackColor?: string;
    placeholder?: string;
};

export default function CardapioItemImageSingle({
    src,
    alt = "Imagem do item",
    fallbackColor = "#1f2937",
    placeholder,
}: Props) {
    const [loaded, setLoaded] = useState(false);

    return (
        <div className="relative w-full h-screen overflow-hidden bg-gray-800">
            {/* Placeholder */}
            {placeholder && !loaded && (
                <img
                    src={placeholder}
                    alt="Placeholder"
                    className="absolute w-full h-full object-cover blur-sm scale-105 transition-opacity duration-500"
                />
            )}

            {/* Imagem real */}
            {src ? (
                <img
                    src={src}
                    alt={alt}
                    onLoad={() => setLoaded(true)}
                    className={`absolute w-full h-full object-cover transition-opacity duration-700 ease-in-out ${loaded ? "opacity-100 animate-zoomOnce" : "opacity-0"
                        }`}
                />
            ) : (
                <div className="absolute inset-0 bg-gray-700" />
            )}

            {/* Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />
        </div>
    );
}
