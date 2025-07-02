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

const frasesFallback = [
    "A foto saiu para jantar e não voltou.",
    "Confie em mim, é uma obra-prima.",
    "Esta pizza é segredo até o primeiro pedaço.",
    "O sabor chegou antes da câmera.",
    "Se fosse um quadro, estaria no Louvre.",
    "A câmera não resistiu e comeu primeiro.",
    "O forno foi mais rápido que o fotógrafo.",
    "Essa pizza é melhor sentida do que vista.",
    "A imagem ficou com fome e sumiu.",
    "Essa delícia prefere o anonimato.",
    "Foco no sabor, não na aparência.",
    "O chef pediu sigilo absoluto.",
    "Surpresa do cardápio!",
    "Ainda não posou para a foto.",
    "Ela é mais gostosa do que fotogênica.",
    "Você vai ter que confiar nos ingredientes.",
    "A beleza dessa pizza é indescritível.",
    "Você vai ver com os olhos do paladar.",
    "A foto está em produção, como a pizza.",
    "Imaginou? Agora peça.",
    "Essa pizza tem mistério e sabor.",
    "Feche os olhos. Sinta o aroma?",
    "É feia não, só tímida.",
    "A imagem estragaria a surpresa.",
    "Essa é daquelas que você precisa provar.",
    "Foto? Não precisa. É amor à primeira mordida.",
    "Essa pizza não quis aparecer hoje.",
    "A câmera travou de emoção.",
    "Faltou luz, não sabor.",
    "Essa é exclusiva demais para ser fotografada.",
    "Preferimos guardar o melhor para quem prova.",
    "Imagem pendente, sabor garantido.",
    "A foto não chegou, mas o apetite sim.",
    "Mistério da boa cozinha.",
    "Nem todos os heróis usam foto.",
    "O gosto fala mais alto que a lente.",
    "A pizza é real. A imagem é opcional.",
    "O chef ainda está ensaiando a pose dela.",
    "Essa aqui derrete o coração antes da lente.",
    "Ficou bonita demais pra aparecer aqui.",
    "Ela fugiu da câmera e foi direto pro forno.",
    "A imagem foi censurada por excesso de delícia.",
    "A lente embaçou de tanto aroma.",
    "Foto disponível só depois da primeira mordida.",
    "A perfeição não precisa de preview.",
    "É pizza, não modelo de passarela.",
    "Essa não tirou RG nem selfie.",
    "O forno é mais rápido que o fotógrafo.",
    "Ela prefere o sabor ao estrelato.",
    "Você vai entender assim que provar.",
    "A imagem perdeu o foco no cheiro.",
    "Imagem? Só depois do aplauso.",
    "Melhor que um retrato: uma mordida.",
    "Ela é daquelas que não se revela fácil.",
    "Primeiro você prova, depois acredita.",
    "O clique não fez justiça ao sabor.",
    "A pizza posou, mas ficou tímida.",
    "Imagem confidencial do chef.",
    "Só comendo pra entender.",
    "O flash assustou a massa.",
    "Dessa vez a foto ficou no rascunho.",
    "Pizza real, imagem imaginária.",
    "Ela é tão boa que some da lente.",
    "A foto falhou, a fome venceu.",
    "Impossível capturar tamanha maravilha.",
    "A imagem ficou na memória... do fotógrafo.",
    "Essa pizza tem vergonha da fama.",
    "Ela brilha mais no prato do que na tela.",
    "Quando provar, vai entender tudo.",
    "A lente ficou embaçada de emoção.",
    "Foto? O importante é o gosto.",
    "Essa pizza é tímida, mas marcante.",
    "Ela dispensa apresentações.",
    "A imagem não faria justiça.",
    "Desapareceu antes do clique.",
    "O chef comeu antes de fotografar.",
    "De tão boa, não durou nem pra foto.",
    "Ela é como amor de verdade: se sente, não se vê.",
    "É pizza boa que não precisa se exibir.",
    "O sabor é mais bonito que qualquer foto.",
    "Imaginou? Agora experimente.",
    "Ela é boa até invisível.",
    "Sem imagem, sem spoiler.",
    "A arte está no sabor, não na foto.",
    "Preferimos manter o mistério.",
    "Ela se recusa a virar digital.",
    "Sabor offline, prazer imediato.",
    "Ela desapareceu, mas deixou o aroma.",
    "O clique não alcançou tanta beleza.",
    "Ainda não teve tempo pra ensaio.",
    "Ela foge das redes sociais.",
    "A imagem se perdeu entre as mordidas.",
    "Tão exclusiva que ninguém viu.",
    "Ela está se produzindo ainda.",
    "Pizza sim, estrela não.",
    "Imagem? Talvez amanhã. Sabor? Agora.",
    "Ela existe, e é tudo isso mesmo.",
    "Ela derreteu antes do retrato.",
    "É tipo crush secreto: só quem prova sabe.",
    "Câmera tímida, pizza ousada.",
    "O chef achou melhor manter surpresa.",
    "Ela te conquista na primeira garfada.",
    "Mais quente que qualquer fotografia.",
    "Essa pizza não cabe em pixels.",
    "Visual? Depois. Mordida? Agora!",
    "Ela prefere ser conhecida ao vivo."
];


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
    const [fraseAleatoria, setFraseAleatoria] = useState<string | null>(null);
    const imgRef = useRef<HTMLImageElement>(null);

    useEffect(() => {
        if (!src) {
            const frase = frasesFallback[Math.floor(Math.random() * frasesFallback.length)];
            setFraseAleatoria(frase);
        }
    }, [src]);

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
                                {placeholderText || fraseAleatoria}
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
