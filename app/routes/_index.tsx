import { Heart, Map, MapPin, MenuSquare, Share2 } from "lucide-react";
import TypewriterComponent from "typewriter-effect";
import Container from "~/components/layout/container/container";
import Logo from "~/components/primitives/logo/logo";
import WhatsAppIcon from "~/components/primitives/whatsapp/whatsapp-icon";

// https://smart-pizza-marketing.framer.ai/

export default function HomePage() {
    return (
        <div className="bg-black h-screen p-8 md:py-24 md:px-32 lg:px-96">

            <div className="bg-white h-full rounded-lg">

                {/* <!-- Mobile screen -> */}
                <div className="md:hidden grid grid-cols-1 grid-rows-5 ">
                    <WebsiteCardHeader />
                    {/* <img src="/images/hero-image.jpg" alt="Nicola sticando a massa" /> */}
                    <div className="bg-hero bg-center bg-cover bg-no-repeat"></div>
                    <WebsiteActionBar />
                </div>


                {/* <!-- Large screen -> */}
                <div className="hidden md:grid md:grid-cols-2 md:h-full">
                    <div className="bg-hero bg-center bg-cover bg-no-repeat"></div>
                    <div className="flex flex-col p-8">
                        <WebsiteCardHeader />
                        <WebsiteActionBar />
                    </div>

                </div>

            </div>


        </div>
    )
}

function WebsiteContent() {
    return (
        <>
            <WebsiteCardHeader />
            <img src="/images/hero-image.jpg" alt="Nicola sticando a massa" />
        </>
    )
}

function WebsiteCardHeader() {
    return (
        <div className="grid grid-cols-4 items-center font-body-website p-4">
            <Logo color="black" className="w-[45px]" tagline={false} />
            <div className="flex flex-col col-span-2 ">
                <h1 className="text-sm font-bold leading-none tracking-tight">A Modo Mio</h1>
                <h2 className="text-xs tracking-tight">La vera pizza italiana</h2>

            </div>

            <MapPin className="justify-self-end" />

        </div>
    )
}

function WebsiteActionBar() {

    return (
        <div className="grid grid-cols-4 font-body-website">

            <div className="flex flex-col gap-2 justify-center items-center">
                <Share2 />
                <span className="text-xs tracking-normal font-semibold">Compartilhe</span>
            </div>


            <div className="flex flex-col gap-2 justify-center items-center">
                <Heart />
                <span className="text-xs tracking-normal font-semibold">Curtir</span>
            </div>


            <div className="flex flex-col gap-2 justify-center items-center">
                <WhatsAppIcon color="black" />
                <span className="text-xs tracking-normal font-semibold">Atendimento</span>
            </div>

            <div className="flex flex-col gap-2 justify-center items-center">
                <MenuSquare />
                <span className="text-xs tracking-normal font-semibold">Cardápio</span>
            </div>

        </div>
    )
}



