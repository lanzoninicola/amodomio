import { LoaderFunctionArgs } from "@remix-run/node";
import { Await, Link, defer, useLoaderData } from "@remix-run/react";
import { ChevronRight, MessageCircleQuestion, Video } from "lucide-react";
import { Heart, Instagram, Map, MapPin, MenuSquare, Share2 } from "lucide-react";
import { Suspense, useState } from "react";
import TypewriterComponent from "typewriter-effect";
import Container from "~/components/layout/container/container";
import Loading from "~/components/loading/loading";
import ExternalLink from "~/components/primitives/external-link/external-link";
import Logo from "~/components/primitives/logo/logo";
import WhatsappExternalLink from "~/components/primitives/whatsapp/whatsapp-external-link";
import WhatsAppIcon from "~/components/primitives/whatsapp/whatsapp-icon";
import { Separator } from "~/components/ui/separator";
import FazerPedidoButton from "~/domain/cardapio/components/fazer-pedido-button/fazer-pedido-button";
import { fmtYYYMMDD, todayLocalYMD } from "~/domain/kds";
import GLOBAL_LINKS from "~/domain/website-navigation/global-links.constant";
import PUBLIC_WEBSITE_NAVIGATION_ITEMS from "~/domain/website-navigation/public/public-website.nav-links";
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


export default function HomePage() {
    const today = fmtYYYMMDD(new Date())
    const mktDateTarget = "20250917"

    return (
        <>
            <section className={
                cn(
                    today === mktDateTarget && 'hidden'
                )
            }>
                <header className="fixed top-0 left-0 w-screen z-50 transition-all p-4 flex justify-between items-center">
                    <div className="w-[130px] md:w-[150px] ">
                        <Logo onlyText={true} className="w-full h-full" />
                    </div>
                    <Link to={GLOBAL_LINKS.cardapioPublic.href} className="hidden md:block" >
                        <div className="bg-black px-2 py-2 rounded-lg w-max flex items-center gap-2">
                            <span className="font-rubik font-semibold text-white uppercase tracking-wider text-xs">cardápio</span>
                        </div>
                    </Link>
                </header>
                <section className="relative">
                    <HomePageVideoBackground />
                    <div className="absolute inset-0 p-4 pt-32">
                        <div className="flex flex-col">

                            <h1 className="text-white font-rubik font-semibold transition-all
                            text-5xl leading-none tracking-tight mb-6 max-w-[300px]
                            md:text-7xl md:max-w-3xl
                        ">
                                A pizza mais desejada de Pato Branco
                            </h1>

                            <p className="text-white font-rubik font-semibold  tracking-wide max-w-prose transition-all
                            text-[1rem] leading-[120%]
                            md:text-xl md:leading-tight
                        ">
                                Preparada com ingredientes selecionados e técnicas artesanais, nossa pizza combina tradição italiana e inovação para entregar uma experiência única. Crocante, leve e irresistível, ela conquistou Pato Branco e agora espera por você.
                            </p>

                        </div>

                    </div>
                </section >

                <div className="fixed right-4 bottom-8">

                    <Link to={GLOBAL_LINKS.cardapioPublic.href} >
                        <div className="bg-black px-8 py-4 rounded-lg w-max flex items-center gap-2">
                            <span className="font-rubik font-bold text-white">Vai ao cardápio</span>
                            <ChevronRight color="#ffffff" />
                        </div>
                    </Link>

                </div>

            </section>
            <DiaCliente25 targetDate={mktDateTarget} />
        </>
    );
}



function HomePageVideoBackground() {
    const loaderData = useLoaderData<typeof loader>();
    const videoURLs = loaderData.payload?.videoURLs

    return (
        <>
            <div className="md:hidden">
                <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-screen h-screen object-cover z-[-1]"
                    poster="/images/cardapio-web-app/amodomio-hero-f000000.png"
                >
                    <source src={videoURLs.video480} type="video/mp4" />
                </video>
            </div>
            <div className="hidden md:block">
                <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-screen h-screen object-cover z-[-1]"
                    poster="/images/cardapio-web-app/amodomio-hero-f000000.png"
                >
                    <source src={videoURLs.video1080} type="video/mp4" />
                </video>
            </div>
            <div className="absolute inset-0 overflow-hidden rotate-0 opacity-40 bg-black"
                data-element="hero-overlay"
            />
        </>
    );
}

interface DiaCliente25Props {
    targetDate: string
}

import { ClipboardCopy, Info } from "lucide-react"
import { Dialog, DialogContent, DialogTrigger } from "~/components/ui/dialog"
import { Button } from "~/components/ui/button"
import { useToast } from "~/components/ui/use-toast"
import { QuestionMarkCircledIcon } from "@radix-ui/react-icons";

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
                                        <span className="font-rubik text-5xl font-extrabold leading-none">
                                            10%
                                        </span>
                                        <span className="font-rubik text-base font-semibold">OFF</span>
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

                            <Link to={GLOBAL_LINKS.cardapioPublic.href} className="w-full">
                                <Button
                                    className="h-12 w-full justify-center bg-brand-green text-white hover:opacity-90 uppercase font-neue tracking-wide"
                                    aria-label="Abrir cardápio"
                                >
                                    Cardápio
                                </Button>
                            </Link>
                        </div>
                    </div>

                    {/* Rodapé opcional (placeholder para respiro) */}
                    <div className="h-10" />
                </div>
            </div>
        </section>
    )
}





// export default function HomePage() {
//     return (
//         <div className="bg-black h-screen p-4 md:py-24 md:px-32 lg:px-96">

//             <div className="bg-white h-full rounded-lg">

//                 {/* <!-- Mobile screen -> */}
//                 <main className="md:hidden grid grid-cols-1 grid-rows-[auto_1fr_auto] h-full">
//                     <header>
//                         <WebsiteCardHeader />
//                         <div className="p-4 ">
//                             <p className="font-neue leading-tight max-w-prose text-3xl ">A autentica pizza italiana<br /> em Pato Branco feita <br /> das mãos de um italiano.</p>
//                         </div>
//                     </header>
//                     <div className="bg-hero bg-center bg-cover bg-no-repeat"></div>
//                     <WebsiteCardFooter />
//                 </main>


//                 {/* <!-- Large screen -> */}
//                 <div className="hidden md:grid md:grid-cols-2 md:h-full">
//                     <div className="bg-hero bg-center bg-cover bg-no-repeat"></div>
//                     <div className="grid grid-cols-1 grid-rows-[auto_1fr_auto] h-full p-8">

//                         <WebsiteCardHeader >
//                             <Separator className="my-2" />
//                         </WebsiteCardHeader>

//                         <div className="p-4 ">
//                             <p className="font-neue leading-tight max-w-prose text-3xl ">A autentica pizza italiana<br /> em Pato Branco feita <br /> das mãos de um italiano.</p>
//                         </div>

//                         <WebsiteCardFooter />
//                     </div>

//                 </div>

//             </div>


//         </div>
//     )
// }

interface WebsiteCardHeaderProps {
    children?: React.ReactNode;
}

function WebsiteCardHeader({ children }: WebsiteCardHeaderProps) {
    return (

        <>
            <div className="flex justify-between items-center font-neue p-4">
                <div className="-py-3 col-span-2">
                    <Logo color="black" className="w-[90px] h-[30px] md:w-[150px] md:h-[50px]" tagline={false} />
                </div>
                <ExternalLink
                    to="https://www.instagram.com/amodomiopb"
                    ariaLabel="Instagram"
                    className="flex justify-self-end"
                >
                    <Instagram className="justify-self-end " />
                </ExternalLink>
            </div>
            {children}
        </>
    )
}

function WebsiteCardFooter() {
    return (
        <footer className="py-6 px-2">
            <WebsiteActionBar />
            <Separator className="my-4" />
            <div className="px-4 w-full">
                {/* <ExternalLink to="https://app.mogomenu.com.br/amodomio"
                    ariaLabel="Cardápio digital pizzaria A Modo Mio"
                    className="grid place-items-center font-neue text-lg rounded-xl bg-brand-green py-1"
                >
                    <span className="uppercase tracking-wide font-semibold">Fazer pedido</span>
                </ExternalLink> */}
                <FazerPedidoButton cnLabel="text-2xl tracking-wider" variant="accent" />
            </div>
        </footer>
    )
}

function WebsiteActionBar() {

    const [likeIt, setLikeIt] = useState(false)



    return (
        <div className="grid grid-cols-4 font-neue">

            <WhatsappExternalLink phoneNumber=""
                ariaLabel="Envia uma mensagem com WhatsApp"
                message={"Essa é a melhor pizzaria da cidade. Experimente..."}
                className="flex flex-col gap-2 justify-center items-center cursor-pointer"
            >
                <Share2 />
                <span className="text-xs tracking-normal font-semibold">Compartilhe</span>
            </WhatsappExternalLink>


            <div className="flex flex-col gap-2 justify-center items-center cursor-pointer" onClick={() => {
                setLikeIt(true)
            }}>
                <Heart className={
                    cn(
                        likeIt ? "fill-red-500" : "fill-none",
                        likeIt ? "stroke-red-500" : "stroke-black"
                    )
                } />
                <span className={
                    cn(
                        "text-xs tracking-normal font-semibold",
                        likeIt ? "text-red-500" : "text-black"
                    )
                }>Curtir</span>
            </div>


            <WhatsappExternalLink phoneNumber="46991272525"
                ariaLabel="Envia uma mensagem com WhatsApp"
                message={"Olá, gostaria fazer um pedido"}
                className="flex flex-col gap-2 justify-center items-center"
            >
                <WhatsAppIcon color="black" />
                <span className="text-xs tracking-normal font-semibold">Atendimento</span>
            </WhatsappExternalLink>

            <Link to={'cardapio'} className="flex flex-col gap-2 justify-center items-center">
                <MenuSquare />
                <span className="text-xs tracking-normal font-semibold">
                    <TypewriterComponent
                        options={{
                            strings: ["Cardápio", "Peça já"],
                            autoStart: true,
                            loop: true,
                            delay: 75,
                            cursorClassName: "hidden"
                        }}
                    />
                </span>
            </Link>

        </div>
    )
}



