import React from "react";
import { Heart } from "lucide-react";

type LikeCelebrationOverlayProps = {
    isOpen: boolean;
    seed: number;
    onClose: () => void;
};

type CelebrationHeart = {
    left: number;
    size: number;
    delay: number;
    duration: number;
    drift: number;
    opacity: number;
    rotate: number;
    color: string;
};

export function LikeCelebrationOverlay({ isOpen, seed, onClose }: LikeCelebrationOverlayProps) {
    const hearts = React.useMemo(() => buildCelebrationHearts(seed, 38), [seed]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[80] flex items-center justify-center"
            role="button"
            aria-label="Fechar animação de curtida"
            onClick={onClose}
        >
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/80 to-black/60" />
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {hearts.map((heart, index) => (
                    <div
                        key={`${seed}-${index}`}
                        className="like-celebration-heart"
                        style={{
                            left: `${heart.left}%`,
                            fontSize: `${heart.size}px`,
                            opacity: heart.opacity,
                            animationDelay: `${heart.delay}s`,
                            animationDuration: `${heart.duration}s`,
                            "--like-drift": `${heart.drift}px`,
                            "--like-rotate": `${heart.rotate}deg`,
                            "--like-color": heart.color,
                        } as React.CSSProperties}
                    >
                        <Heart />
                    </div>
                ))}
            </div>
            <div className="relative z-10 pointer-events-none">
                <div className="like-celebration-pop px-6 py-3 font-neue text-red-600 text-6xl md:text-6xl font-semibold tracking-tighter uppercase drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
                    OBRIGADO!
                </div>
            </div>
            <style>{`
                @keyframes like-fall {
                    0% {
                        transform: translate3d(0, -25vh, 0) rotate(var(--like-rotate, -8deg)) scale(0.85);
                        opacity: 0;
                    }
                    10% {
                        opacity: 1;
                    }
                    100% {
                        transform: translate3d(var(--like-drift, 0px), 120vh, 0) rotate(calc(var(--like-rotate, -8deg) + 24deg)) scale(1.05);
                        opacity: 0;
                    }
                }
                @keyframes like-pop {
                    0% { transform: scale(0.85); opacity: 0; }
                    30% { transform: scale(1); opacity: 1; }
                    70% { transform: scale(1.05); opacity: 1; }
                    100% { transform: scale(0.95); opacity: 0.9; }
                }
                .like-celebration-heart {
                    position: absolute;
                    top: 0;
                    color: var(--like-color, rgba(220, 38, 38, 1));
                    filter:
                        drop-shadow(0 8px 18px rgba(0, 0, 0, 0.35))
                        drop-shadow(0 0 6px rgba(220, 38, 38, 0.45));
                    animation-name: like-fall;
                    animation-timing-function: ease-in;
                    animation-iteration-count: 1;
                }
                .like-celebration-heart svg {
                    width: 1em;
                    height: 1em;
                    fill: currentColor;
                    stroke: rgba(255,255,255,0.6);
                    stroke-width: 0.4px;
                }
                .like-celebration-pop {
                    text-shadow: 0 10px 30px rgba(0,0,0,0.35);
                    animation: like-pop 1.6s ease-out;
                }
            `}</style>
        </div>
    );
}

function buildCelebrationHearts(seed: number, amount: number): CelebrationHeart[] {
    const rand = mulberry32(seed || 1);
    const palette = [
        "rgba(220, 38, 38, 1)",
        "rgba(239, 68, 68, 1)",
        "rgba(248, 113, 113, 1)",
        "rgba(185, 28, 28, 1)",
    ];

    return Array.from({ length: amount }, () => {
        const size = 18 + Math.round(rand() * 22);
        return {
            left: Math.round(rand() * 100),
            size,
            delay: parseFloat((rand() * 0.5).toFixed(2)),
            duration: parseFloat((3.2 + rand() * 1.8).toFixed(2)),
            drift: Math.round((rand() - 0.5) * 180),
            opacity: parseFloat((0.55 + rand() * 0.4).toFixed(2)),
            rotate: Math.round((rand() - 0.5) * 30),
            color: palette[Math.floor(rand() * palette.length)],
        };
    });
}

function mulberry32(seed: number) {
    let value = seed;
    return () => {
        value += 0x6D2B79F5;
        let result = Math.imul(value ^ (value >>> 15), value | 1);
        result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
        return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
    };
}
