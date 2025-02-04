import { LoaderFunctionArgs } from "@remix-run/node";
import { Await, Link, defer, useLoaderData } from "@remix-run/react";
import { ChevronRight, Video } from "lucide-react";
import { Heart, Instagram, Map, MapPin, MenuSquare, Share2 } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import TypewriterComponent from "typewriter-effect";
import Container from "~/components/layout/container/container";
import Loading from "~/components/loading/loading";
import ExternalLink from "~/components/primitives/external-link/external-link";
import Logo from "~/components/primitives/logo/logo";
import WhatsappExternalLink from "~/components/primitives/whatsapp/whatsapp-external-link";
import WhatsAppIcon from "~/components/primitives/whatsapp/whatsapp-icon";
import { Separator } from "~/components/ui/separator";
import FazerPedidoButton from "~/domain/cardapio/components/fazer-pedido-button/fazer-pedido-button";
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

    return (
        <>
            <header className="fixed top-0 left-0 w-screen z-50 transition-all p-4 flex justify-between items-center">
                <div className="w-[130px] ">
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
                <div className="absolute inset-0 p-4 pt-24 md:pt-32">
                    <div className="flex flex-col">

                        <HomePageTitle />

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

        </>
    );
}


function HomePageTitle() {
    const words = ["desejada", "aconselhada"];
    const [index, setIndex] = useState(0);
    const [fade, setFade] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => {
            setFade(true);
            setTimeout(() => {
                setIndex((prevIndex) => (prevIndex + 1) % words.length);
                setFade(false);
            }, 500); // Tempo para a animação de saída
        }, 3000);

        return () => clearInterval(interval);
    }, []);

    return (
        <h1 className="text-white font-rubik font-semibold transition-all
                       text-5xl leading-[90%] tracking-tight mb-6 max-w-[350px]
                       md:text-7xl md:max-w-3xl">
            A pizza mais{" "}
            <span
                className={`transition-opacity duration-500 ${fade ? "opacity-0" : "opacity-100"
                    }`}
            >
                {words[index]}
            </span>{" "}
            de{" "}
            <span className="font-accent text-6xl md:text-8xl">Pato Branco</span>
        </h1>
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
            <div className="absolute inset-0 overflow-hidden rotate-0 opacity-60"
                style={{ background: "radial-gradient(circle at top, #242424 , #999999)" }}
                data-element="hero-overlay"
            />
        </>
    );
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
//                             <p className="font-body-website leading-tight max-w-prose text-3xl ">A autentica pizza italiana<br /> em Pato Branco feita <br /> das mãos de um italiano.</p>
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
//                             <p className="font-body-website leading-tight max-w-prose text-3xl ">A autentica pizza italiana<br /> em Pato Branco feita <br /> das mãos de um italiano.</p>
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
            <div className="flex justify-between items-center font-body-website p-4">
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
                    className="grid place-items-center font-body-website text-lg rounded-xl bg-brand-green py-1"
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
        <div className="grid grid-cols-4 font-body-website">

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



