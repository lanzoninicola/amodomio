import { LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData, useNavigation } from "@remix-run/react";
import { QuestionMarkCircledIcon } from "@radix-ui/react-icons";
import { ChevronRight, ClipboardCopy, Heart, LoaderCircle, MenuSquare, Share2 } from "lucide-react";
import { MouseEvent, useState } from "react";
import TypewriterComponent from "typewriter-effect";
import Logo from "~/components/primitives/logo/logo";
import RouteProgressBar from "~/components/route-progress-bar/route-progress-bar";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "~/components/ui/dialog";
import { useToast } from "~/components/ui/use-toast";
import WhatsappExternalLink from "~/components/primitives/whatsapp/whatsapp-external-link";
import WhatsAppIcon from "~/components/primitives/whatsapp/whatsapp-icon";
import { fmtYYYMMDD } from "~/domain/kds";
import WEBSITE_LINKS from "~/domain/website-navigation/links/website-links";
import { CloudinaryUtils } from "~/lib/cloudinary";
import { cn } from "~/lib/utils";
import { ok } from "~/utils/http-response.server";

// https://smart-pizza-marketing.framer.ai/
// https://traderepublic.com/pt-pt


export async function loader({ request }: LoaderFunctionArgs) {
    return ok({
        videoURLs: {
            video480: CloudinaryUtils.getVideoURL("amodomio-hero_480p_haz9se"),
            video1080: CloudinaryUtils.getVideoURL("amodomio-hero_1080p_vgk1eq")
        }
    });
}

type CardapioLinkProps = {
    mode?: "header" | "hero" | "campaign";
    className?: string;
};

function CardapioLink({ mode = "hero", className }: CardapioLinkProps) {
    const navigation = useNavigation();
    const cardapioPath = WEBSITE_LINKS.cardapioPublic.href;
    const nextPath = navigation.location?.pathname ?? "";
    const isNavigatingToCardapio = navigation.state !== "idle" && nextPath.startsWith(cardapioPath);

    const preventRepeatedClick = (e: MouseEvent<HTMLAnchorElement>) => {
        if (isNavigatingToCardapio) {
            e.preventDefault();
        }
    };

    if (mode === "header") {
        return (
            <Link
                to={cardapioPath}
                className={cn("hidden md:block", className, isNavigatingToCardapio && "pointer-events-none")}
                onClick={preventRepeatedClick}
                aria-disabled={isNavigatingToCardapio}
            >
                <div className={cn("bg-black px-2 py-2 rounded-lg w-max flex items-center gap-2 shadow-sm", isNavigatingToCardapio && "opacity-80")}>
                    <span className="font-neue font-semibold text-white uppercase tracking-wider text-xs">
                        {isNavigatingToCardapio ? "Abrindo..." : "cardápio"}
                    </span>
                    <span className="flex items-center justify-center rounded-full bg-white/10 text-white">
                        {isNavigatingToCardapio ? <LoaderCircle className="h-[14px] w-[14px] animate-spin" /> : <ChevronRight color="#ffffff" size={14} />}
                    </span>
                </div>
            </Link>
        );
    }

    if (mode === "campaign") {
        return (
            <Link
                to={cardapioPath}
                className={cn("w-full", className, isNavigatingToCardapio && "pointer-events-none")}
                onClick={preventRepeatedClick}
                aria-disabled={isNavigatingToCardapio}
            >
                <Button
                    className="h-12 w-full justify-center bg-brand-green text-white hover:opacity-90 uppercase font-neue tracking-wide"
                    aria-label="Abrir cardápio"
                    disabled={isNavigatingToCardapio}
                >
                    {isNavigatingToCardapio ? "Abrindo cardápio..." : "Cardápio"}
                    {isNavigatingToCardapio && <LoaderCircle className="ml-2 h-4 w-4 animate-spin" />}
                </Button>
            </Link>
        );
    }

    return (
        <Link
            to={cardapioPath}
            className={cn(className, isNavigatingToCardapio && "pointer-events-none")}
            onClick={preventRepeatedClick}
            aria-disabled={isNavigatingToCardapio}
        >
            <div className="group relative overflow-hidden rounded-xl border border-black bg-black px-6 py-3.5 text-white shadow-[0_10px_30px_rgba(0,0,0,0.25)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(0,0,0,0.28)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black">
                <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-10 bg-white" aria-hidden />
                <div className="relative flex items-center gap-3 font-neue font-bold uppercase tracking-wide">
                    <span>{isNavigatingToCardapio ? "Abrindo cardápio..." : "Ver cardápio"}</span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white">
                        {isNavigatingToCardapio ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <ChevronRight color="#ffffff" />}
                    </span>
                </div>
            </div>
        </Link>
    );
}


export default function HomePage() {
    const loaderData = useLoaderData<typeof loader>();
    const videoURLs = loaderData.payload?.videoURLs;
    const today = fmtYYYMMDD(new Date())
    const mktDateTarget = "20250917"

    return (
        <>
            <RouteProgressBar />
            <section className={
                cn(
                    today === mktDateTarget && 'hidden'
                )
            }>
                <header className="fixed top-0 left-0 w-screen z-50 transition-all p-4 flex justify-between items-center bg-white/90 backdrop-blur-md shadow-sm border-b border-black/5 md:px-52">
                    <div className="w-[130px] md:w-[150px] ">
                        <Logo onlyText={true} className="w-full h-full" color="black" />
                    </div>
                    <CardapioLink mode="header" />
                </header>
                <section className="relative bg-white overflow-hidden">

                    <div className="relative grid grid-cols-1 md:grid-cols-[1.05fr_0.95fr] gap-6 md:gap-8 px-5 pt-24 pb-14 md:px-52 md:pt-28 md:pb-16 items-center">
                        <div className="flex flex-col gap-5">

                            <div className="space-y-4">
                                <div className="flex items-center gap-2 text-black font-neue text-xs tracking-[0.18em] uppercase">
                                    <span className="text-sm">[</span>
                                    <span>Autêntica Pizza romana</span>
                                    <span className="text-sm">]</span>
                                </div>
                                <h1 className="text-black uppercase font-neue font-semibold text-[2.8rem] leading-[1.05] tracking-tight md:text-6xl flex flex-col">
                                    <span>A pizza mais desejada de </span>
                                    <span className="text-black/60" >Pato Branco</span>
                                </h1>
                                <p className="text-black/90 font-neue tracking-wide text-[1rem] leading-[1.6] max-w-[36ch] md:text-[1.05rem]">
                                    Ingredientes selecionados, técnica artesanal e fermentação lenta para um sabor que fala por si. Crocante, leve e autêntica — sua próxima pizza inesquecível começa aqui.
                                </p>
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-3">
                                <CardapioLink />
                            </div>
                        </div>

                        <div className="relative flex justify-center ">
                            <div className="relative overflow-hidden rounded-[28px] border-[3px] border-black/10 shadow-[0_18px_60px_rgba(0,0,0,0.18)] rotate-[-2deg] bg-black/80">
                                <HeroVideo videoURLs={videoURLs} />
                            </div>
                        </div>
                    </div>
                </section >
                <ItalianIngredientsSection />
            </section>
            <DiaCliente25 targetDate={mktDateTarget} />
        </>
    );
}



interface HeroVideoProps {
    videoURLs?: {
        video480?: string;
        video1080?: string;
    }
}

function HeroVideo({ videoURLs }: HeroVideoProps) {
    return (
        <div className="relative h-[420px] w-full md:h-[520px] aspect-[3/4] bg-black overflow-hidden">
            <video
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
                className="absolute inset-0 h-full w-full object-cover"
                poster="/images/cardapio-web-app/amodomio-hero-f000000.webp"
            >
                <source src={videoURLs?.video480} type="video/mp4" media="(max-width: 480px) and (max-device-pixel-ratio: 1.5)" />
                <source src={videoURLs?.video1080} type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/30 pointer-events-none" aria-hidden />
        </div>
    );
}

function ItalianPizzaLineArt() {
    return (
        <svg
            viewBox="0 0 300 380"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            className="w-full max-w-[240px] md:max-w-[280px]"
            aria-hidden
        >
            {/* Main face – 3/4 view */}
            <path
                d="M 145 35 C 165 30 192 42 202 62 C 212 82 207 108 198 128 C 196 136 197 140 197 148 C 192 168 184 188 171 204 C 159 220 143 226 130 224 C 116 222 102 208 95 193 C 88 178 88 158 92 141 C 92 134 96 129 96 121 C 92 106 89 83 94 64 C 100 46 121 32 145 35 Z"
                stroke="#1a1a1a" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"
            />
            <path
                d="M 145 35 C 140 21 127 14 113 14 C 98 13 86 21 86 34 C 83 46 89 56 94 64"
                stroke="#1a1a1a" strokeWidth="1.3" strokeLinecap="round"
            />
            <path
                d="M 202 62 C 210 49 208 32 197 22 C 186 11 169 10 156 16 C 150 20 146 28 145 35"
                stroke="#1a1a1a" strokeWidth="1.3" strokeLinecap="round"
            />
            <path
                d="M 94 121 C 83 126 79 137 82 148 C 85 158 95 162 100 155"
                stroke="#1a1a1a" strokeWidth="1.2" strokeLinecap="round"
            />
            <path d="M 149 74 C 160 67 175 67 183 73" stroke="#1a1a1a" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M 147 86 C 157 79 174 79 180 87 C 173 97 156 98 147 86" stroke="#1a1a1a" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M 107 77 C 114 71 124 71 129 77" stroke="#1a1a1a" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M 106 88 C 113 82 124 82 128 89 C 122 96 113 96 106 88" stroke="#1a1a1a" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M 164 83 C 162 102 161 122 158 138 C 155 150 148 156 152 162" stroke="#1a1a1a" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M 140 158 C 144 164 154 164 158 159" stroke="#1a1a1a" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M 127 176 C 136 169 149 168 159 174 C 163 177 163 181 158 183" stroke="#1a1a1a" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M 136 170 C 142 166 148 166 153 170" stroke="#1a1a1a" strokeWidth="1.0" strokeLinecap="round" />
            <path d="M 126 185 C 136 196 155 196 161 185" stroke="#1a1a1a" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M 123 230 C 118 248 116 268 118 284" stroke="#1a1a1a" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M 153 227 C 158 244 160 265 157 280" stroke="#1a1a1a" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M 118 284 C 103 294 86 298 68 295" stroke="#1a1a1a" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M 157 280 C 172 290 190 296 210 293" stroke="#1a1a1a" strokeWidth="1.2" strokeLinecap="round" />

            {/* Second face – profile facing right */}
            <path
                d="M 218 70 C 227 50 248 44 265 50 C 280 56 288 72 287 90 C 286 107 276 121 268 134 C 260 146 254 158 252 172 C 250 184 254 197 247 208 C 240 218 226 220 222 230"
                stroke="#1a1a1a" strokeWidth="1.1" strokeLinecap="round"
            />
            <path
                d="M 218 70 C 218 53 220 38 228 29 C 236 20 248 17 258 20 C 268 23 276 32 278 46 C 281 58 282 72 287 90"
                stroke="#1a1a1a" strokeWidth="1.0" strokeLinecap="round"
            />
            <path d="M 252 78 C 260 72 271 73 276 79" stroke="#1a1a1a" strokeWidth="1.0" strokeLinecap="round" />
            <path d="M 255 88 C 262 82 273 83 276 90" stroke="#1a1a1a" strokeWidth="1.0" strokeLinecap="round" />
            <path d="M 271 92 C 276 106 275 122 269 134 C 265 144 258 150 261 156" stroke="#1a1a1a" strokeWidth="1.0" strokeLinecap="round" />
            <path d="M 247 172 C 253 166 261 166 263 173 C 259 181 249 180 247 172" stroke="#1a1a1a" strokeWidth="1.0" strokeLinecap="round" />
            <path d="M 222 230 C 220 244 222 258 226 268" stroke="#1a1a1a" strokeWidth="1.0" strokeLinecap="round" />
        </svg>
    )
}

function ItalianIngredientsSection() {
    return (
        <section className="hidden flex-col md:flex-row items-center gap-10 md:gap-16 px-6 py-14 md:px-52 bg-white border-t border-black/5">
            <div className="flex-1 flex justify-center order-2 md:order-1">
                <ItalianPizzaLineArt />
            </div>
            <div className="flex-1 flex justify-center md:justify-start order-1 md:order-2">
                <p className="font-lora italic text-black/75 leading-relaxed text-center md:text-left text-[1.35rem] md:text-[1.55rem] max-w-[28ch]">
                    Todas as nossas pizzas são preparadas com farinha e molho de tomate importados da Itália.
                </p>
            </div>
        </section>
    )
}

interface DiaCliente25Props {
    targetDate: string
}

function DiaCliente25({ targetDate }: DiaCliente25Props) {
    const [loaded, setLoaded] = useState(false)
    const { toast } = useToast()
    const today = fmtYYYMMDD(new Date())
    const cupomCode = "CLIENTE10"

    const copyToClipboard = () => {
        navigator.clipboard.writeText(cupomCode)
        toast({
            title: "Cupom copiado!",
            description: `"${cupomCode}" foi copiado para a área de transferência.`,
        })
    }

    return (
        <section
            className={cn(
                "relative flex justify-center md:mx-auto",
                today !== targetDate && "hidden"
            )}
        >
            {/* Fundo com imagem + overlay para contraste */}
            <div className="relative w-full h-screen md:w-[720px] overflow-hidden">

                <img
                    src={"/images/2025_dia_cliente_fundo.png"}
                    alt="Dia do Cliente — arte promocional"
                    onLoad={() => setLoaded(true)}
                    className={cn(
                        "absolute inset-0 h-full w-full object-cover",
                        loaded && "animate-zoomOnce"
                    )}
                />
                <div
                    className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/70"
                    aria-hidden
                />

                {/* Conteúdo */}
                <div className="relative z-10 flex h-full flex-col items-center justify-between p-5 md:p-6">
                    {/* Topo: logo opcional (se quiser, pode incluir) */}

                    {/* Bloco central com hierarquia */}
                    <div className="flex w-full max-w-[560px] flex-col items-center text-center">
                        <img
                            src={"/images/2025_dia_cliente_title.png"}
                            alt="Dia do Cliente — arte promocional"
                        />

                        {/* Cartão de Cupom */}
                        <div className="mt-6 w-full rounded-2xl bg-white/95 p-4 shadow-xl backdrop-blur"
                            onClick={copyToClipboard}
                        >
                            <div className="grid grid-cols-[1fr_auto_1fr] items-stretch">
                                {/* Perfuração esquerda */}
                                <div className="relative flex items-center">
                                    <div className="h-full w-4 -translate-x-2 rounded-r-full bg-gray-100" />
                                </div>

                                {/* Miolo do cupom */}
                                <div className="flex flex-col items-center gap-2 border-x border-dashed border-gray-300 px-4 text-gray-900 font-neue">
                                    {/* <div className="text-xs uppercase tracking-widest text-gray-500">
                                        Somente hoje
                                    </div> */}
                                    <div className="flex items-baseline gap-2">
                                        <span className="font-neue text-5xl font-extrabold leading-none">
                                            10%
                                        </span>
                                        <span className="font-neue text-base font-semibold">OFF</span>
                                    </div>

                                    {/* Código + copiar inline */}
                                    <div className="mt-1 flex w-full items-center justify-center gap-2">

                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            className="h-8 px-3 flex gap-2 items-center"
                                            onClick={copyToClipboard}
                                            aria-label="Copiar código do cupom"
                                            title="Copiar código do cupom"
                                        >
                                            <ClipboardCopy className="h-6 w-6" />
                                            <code className="rounded bg-gray-100 font-mono text-md font-semibold">
                                                {cupomCode}
                                            </code>
                                        </Button>
                                    </div>

                                    {/* Validade */}
                                    <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="h-4 w-4"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                            aria-hidden
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        Válido até 28/09
                                    </div>
                                </div>

                                {/* Perfuração direita */}
                                <div className="relative flex items-center justify-end">
                                    <div className="h-full w-4 translate-x-2 rounded-l-full bg-gray-100" />
                                </div>
                            </div>
                        </div>

                        {/* Observação/CTA secundário */}
                        <p className="mt-3 max-w-[520px] text-balance text-sm text-white tracking-wide font-neue">
                            Válido somente na proxima compra no cardápio digital. Não cumulativo com outras promoções.
                        </p>

                        {/* Ações */}
                        <div className="mt-5 grid w-full max-w-[560px] grid-cols-2 gap-3">
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="h-12 w-full flex gap-2 justify-center bg-white/90 text-gray-900 hover:bg-white uppercase font-neue"
                                        aria-label="Abrir regulamento"
                                    >
                                        <QuestionMarkCircledIcon className="h-5 w-5" />
                                        Regulamento
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-md text-left">
                                    <h2 className="text-lg font-bold">Regulamento</h2>
                                    <p className="mt-2 text-sm leading-snug text-muted-foreground">
                                        Promoção válida para compras realizadas no dia 17 de setembro de 2025.
                                        O cupom <span className="font-semibold">CLIENTE10</span> garante 10% de desconto
                                        em uma nova compra realizada até o dia 28 de setembro de 2025.
                                        <span className="font-semibold"> Válido apenas para pedidos pelo nosso cardápio digital.</span>
                                        Não cumulativo com outras promoções.
                                    </p>
                                </DialogContent>
                            </Dialog>

                            <CardapioLink mode="campaign" />
                        </div>
                    </div>

                    {/* Rodapé opcional (placeholder para respiro) */}
                    <div className="h-10" />
                </div>
            </div>
        </section>
    )
}
