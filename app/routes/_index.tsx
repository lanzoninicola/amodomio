import { LoaderFunctionArgs } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { Heart, Instagram, Map, MapPin, MenuSquare, Share2 } from "lucide-react";
import { useState } from "react";
import TypewriterComponent from "typewriter-effect";
import Container from "~/components/layout/container/container";
import ExternalLink from "~/components/primitives/external-link/external-link";
import Logo from "~/components/primitives/logo/logo";
import WhatsappExternalLink from "~/components/primitives/whatsapp/whatsapp-external-link";
import WhatsAppIcon from "~/components/primitives/whatsapp/whatsapp-icon";
import { Separator } from "~/components/ui/separator";
import FazerPedidoButton from "~/domain/cardapio/components/fazer-pedido-button/fazer-pedido-button";
import { CloudinaryUtils } from "~/lib/cloudinary";
import { cn } from "~/lib/utils";
import { ok } from "~/utils/http-response.server";

// https://smart-pizza-marketing.framer.ai/
// https://traderepublic.com/pt-pt


export async function loader({ request }: LoaderFunctionArgs) {

    const video480URL = CloudinaryUtils.getVideoURL("amodomio-hero_480p_haz9se")

    const video480URLPromise: Promise<string> = new Promise((resolve) => resolve(video480URL))

    return ok({
        video480URL
    })
}


export default function HomePage() {
    const loaderData = useLoaderData<typeof loader>()
    const video480URL = loaderData?.payload?.video480URL

    console.log({ video480URL })

    return (

        <video
            controls={false}
            poster={'/images/hero-image.jpg'}
            disablePictureInPicture={true}
            autoPlay={true}
            loop={true}
            className={
                cn(
                    "w-screen h-screen object-cover fixed top-0 left-0 z-[-1]",
                )
            }
        >
            <source src={video480URL} />
        </video>
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



