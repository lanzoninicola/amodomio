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
    const cupomCode = "CLIENTE10" // Exemplo

    const copyToClipboard = () => {
        navigator.clipboard.writeText(cupomCode)
        toast({
            title: "Cupom copiado!",
            description: `"${cupomCode}" foi copiado para a área de transferência.`,
        })
    }

    return (
        <section className={cn("md:w-[690px] md:mx-auto", today !== targetDate && "hidden")}>
            <div className="relative w-full h-screen overflow-hidden bg-gray-800">
                <img
                    src={"/images/2025_dia_cliente.png"}
                    alt={"cupom dia do cliente 2025 desconto 10%"}
                    onLoad={() => setLoaded(true)}
                    className="absolute w-full h-full object-fill transition-opacity duration-700 ease-in-out"
                />


                <div className="absolute bottom-[5.5rem] right-4 z-10">
                    <Button
                        variant="default"
                        className="rounded-full bg-yellow-500 text-black grid place-items-center w-10 hover:bg-yellow-100"
                        onClick={copyToClipboard}
                    >
                        <ClipboardCopy className="w-6 h-6" />
                    </Button>
                </div>
                <div className="absolute bottom-8 right-4 flex flex-col gap-4 items-center z-10">
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button className="rounded-full bg-yellow-500 text-black grid place-items-center w-10">
                                <QuestionMarkCircledIcon className="w-6 h-6" />
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md mx-auto text-left">
                            <h2 className="text-lg font-bold mb-2">Regulamento</h2>
                            <p className="text-md leading-snug">
                                Promoção válida para compras realizadas no dia 16 de setembro
                                de 2025. O cupom <span className="font-semibold">CLIENTE10</span> garante 10% de desconto em uma nova
                                compra realizada até o dia 28 de setembro de 2025. <span className="font-semibold">Válido
                                    apenas para pedidos pelo nosso cardápio digital.</span> Não cumulativo
                                com outras promoções.
                            </p>
                        </DialogContent>
                    </Dialog>
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



