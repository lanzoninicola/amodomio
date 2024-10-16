import { Link } from "@remix-run/react";
import { Heart, Instagram, Map, MapPin, MenuSquare, Share2 } from "lucide-react";
import { useState } from "react";
import TypewriterComponent from "typewriter-effect";
import Container from "~/components/layout/container/container";
import ExternalLink from "~/components/primitives/external-link/external-link";
import Logo from "~/components/primitives/logo/logo";
import WhatsappExternalLink from "~/components/primitives/whatsapp/whatsapp-external-link";
import WhatsAppIcon from "~/components/primitives/whatsapp/whatsapp-icon";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";

// https://smart-pizza-marketing.framer.ai/

export default function HomePage() {
    return (
        <div className="bg-black h-screen p-4 md:py-24 md:px-32 lg:px-96">

            <div className="bg-white h-full rounded-lg">

                {/* <!-- Mobile screen -> */}
                <main className="md:hidden grid grid-cols-1 grid-rows-[auto_1fr_auto] h-full">
                    <header>
                        <WebsiteCardHeader />
                        <div className="p-4 ">
                            <p className="font-body-website leading-tight max-w-prose">A verdadeira pizza italiana<br /> em Pato Branco feita <br /> das mãos de um italiano.</p>
                        </div>
                    </header>
                    <div className="bg-hero bg-center bg-cover bg-no-repeat"></div>
                    <WebsiteCardFooter />
                </main>


                {/* <!-- Large screen -> */}
                <div className="hidden md:grid md:grid-cols-2 md:h-full">
                    <div className="bg-hero bg-center bg-cover bg-no-repeat"></div>
                    <div className="grid grid-cols-1 grid-rows-[auto_1fr_auto] h-full p-8">

                        <WebsiteCardHeader >
                            <Separator className="my-2" />
                        </WebsiteCardHeader>

                        <div className="p-4 ">
                            <p className="font-body-website leading-tight text-lg max-w-prose">A verdadeira pizza italiana<br /> em Pato Branco feita <br /> das mãos de um italiano.</p>
                        </div>

                        <WebsiteCardFooter />
                    </div>

                </div>

            </div>


        </div>
    )
}

interface WebsiteCardHeaderProps {
    children?: React.ReactNode;
}

function WebsiteCardHeader({ children }: WebsiteCardHeaderProps) {
    return (

        <header className="h-[90px]">
            <div className="grid grid-cols-4 items-center font-body-website p-4">
                <Logo color="black" className="w-[45px]" tagline={false} />
                <div className="flex flex-col col-span-2 ">
                    <h1 className="text-sm font-bold leading-none tracking-tight">A Modo Mio</h1>
                    <h2 className="text-xs tracking-tight">La vera pizza italiana</h2>

                </div>

                <ExternalLink
                    to="https://www.instagram.com/amodomiopb"
                    ariaLabel="Instagram"
                    className="flex justify-self-end"
                >
                    <Instagram className="justify-self-end" />
                </ExternalLink>
            </div>
            {children}
        </header>
    )
}

function WebsiteCardFooter() {
    return (
        <footer className="py-6 px-2">
            <WebsiteActionBar />
            <Separator className="my-4" />
            <div className="px-4 w-full">
                <ExternalLink to="https://app.mogomenu.com.br/amodomio"
                    ariaLabel="Cardápio digital pizzaria A Modo Mio"
                    className="grid place-items-center font-body-website text-lg rounded-xl bg-brand-green py-1"
                >
                    <span className="uppercase tracking-wide font-semibold">Fazer pedido</span>
                </ExternalLink>
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



