import { useEffect, useRef, useState } from "react";
import { useRandomMessages } from "~/hooks/use-random-message";
import { cn } from "~/lib/utils";

type Props = {
    src?: string;
    kind?: "image" | "video";
    alt?: string;
    fallbackColor?: string;
    placeholder?: string;
    placeholderIcon?: boolean;
    cnPlaceholderIcon?: string;
    placeholderText?: string;
    cnPlaceholderText?: string;
    cnPlaceholderContainer?: string;
    cnContainer?: string;
    enableOverlay?: boolean;
    itemId?: string; // Opcional: para gerar frases diferentes para cada item
};

export default function CardapioItemImageSingle({
    src,
    kind,
    alt = "Imagem do item",
    fallbackColor = "#1f2937",
    placeholder,
    placeholderIcon = false,
    cnPlaceholderIcon,
    placeholderText,
    cnPlaceholderText,
    cnPlaceholderContainer,
    cnContainer,
    enableOverlay = true,
    itemId,
}: Props) {
    const [loaded, setLoaded] = useState(false);
    const [hasVideoError, setHasVideoError] = useState(false);
    const [isInViewport, setIsInViewport] = useState(false);
    const [videoObjectFit, setVideoObjectFit] = useState<"cover" | "contain">("cover");
    const imgRef = useRef<HTMLImageElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const inferredKind =
        kind ||
        (/\.(mp4|mov|webm|m4v|ogg|ogv)(\?|$)/i.test(String(src || "")) ? "video" : "image");
    const isVideo = inferredKind === "video";

    // Usa o hook para gerar mensagens aleatórias quando não há src
    const randomMessage = useRandomMessages({
        condition: !src,
        dependencies: itemId ? [itemId] : [] // Gera nova mensagem para cada item
    });

    useEffect(() => {
        setLoaded(false);
        setHasVideoError(false);
        setVideoObjectFit("cover");
    }, [src, isVideo]);

    useEffect(() => {
        if (isVideo && videoRef.current?.readyState && videoRef.current.readyState >= 2) {
            setLoaded(true);
            return;
        }

        if (!isVideo && imgRef.current && imgRef.current.complete) {
            setLoaded(true);
        }
    }, [src, isVideo]);

    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const [entry] = entries;
                setIsInViewport(Boolean(entry?.isIntersecting && entry.intersectionRatio > 0.35));
            },
            { threshold: [0, 0.35, 0.7] }
        );

        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!isVideo) return;
        const video = videoRef.current;
        if (!video) return;

        if (isInViewport) {
            video.play().catch(() => null);
            return;
        }

        video.pause();
    }, [isVideo, isInViewport, loaded, hasVideoError]);

    const shouldShowFallback = !src || (isVideo && hasVideoError);
    const shouldUseContain = videoObjectFit === "contain";

    return (
        <div ref={containerRef} className={cn("relative w-full h-screen overflow-hidden bg-gray-800", cnContainer)}>
            {/* Placeholder visual (blurred) */}
            {placeholder && !loaded && (
                <img
                    src={placeholder}
                    alt="Placeholder"
                    className="absolute w-full h-full object-cover blur-sm scale-105 transition-opacity duration-500"
                />
            )}

            {/* Real image */}
            {!shouldShowFallback ? (
                isVideo ? (
                    <>
                        {shouldUseContain && (
                            <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 via-zinc-800 to-black" />
                        )}
                        <video
                            ref={videoRef}
                            src={src}
                            muted
                            loop
                            autoPlay
                            playsInline
                            disablePictureInPicture
                            preload="metadata"
                            poster={placeholder || undefined}
                            onLoadedMetadata={(event) => {
                                const video = event.currentTarget;
                                const width = Number(video.videoWidth) || 0;
                                const height = Number(video.videoHeight) || 0;
                                if (!width || !height) return;
                                setVideoObjectFit(width < height ? "contain" : "cover");
                            }}
                            onLoadedData={() => setLoaded(true)}
                            onCanPlay={() => setLoaded(true)}
                            onError={() => setHasVideoError(true)}
                            className={cn(
                                "absolute inset-0 h-full w-full transition-opacity duration-700 ease-in-out",
                                shouldUseContain ? "object-contain" : "object-cover",
                                loaded ? "opacity-100" : "opacity-0"
                            )}
                        />
                    </>
                ) : (
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
                )
            ) : (
                <div className={
                    cn(
                            "absolute inset-0 bg-gradient-to-b from-zinc-900 via-zinc-800 to-black",
                            cnPlaceholderContainer
                        )
                }

                    data-element="image-placeholder">
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
                                    "text-white text-sm font-mono tracking-wide opacity-80 leading-tight animate-fade-in mb-8",
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
