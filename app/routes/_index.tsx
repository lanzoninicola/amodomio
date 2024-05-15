import { Link } from "@remix-run/react";
import { Heart, Instagram, Map, MapPin, MenuSquare, PlusSquare, Share2 } from "lucide-react";
import { useState } from "react";
import TypewriterComponent from "typewriter-effect";
import Container from "~/components/layout/container/container";
import ExternalLink from "~/components/primitives/external-link/external-link";
import Logo from "~/components/primitives/logo/logo";
import WhatsappExternalLink from "~/components/primitives/whatsapp/whatsapp-external-link";
import WhatsAppIcon from "~/components/primitives/whatsapp/whatsapp-icon";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";

const posts = [
    {
        title: "Bem vindo",
        content: "A verdadeira pizza italiana em Pato Branco feita das mãos de um italiano.",
        imgSrc: "/images/hero-image.jpg",
        imgAlt: "Il pizzaiolo italiano Nicola esticando a massa de pizza"
    }
]

// https://smart-pizza-marketing.framer.ai/
export default function HomePage() {


    return (
        <>
            <DesktopHomePage />
            <MobileHomePage />
        </>
    )

}


function DesktopHomePage() {
    return (
        <main className="hidden lg:grid lg:place-items-center min-h-screen p-4 lg:py-16 bg-black">
            <div className="lg:bg-white lg:h-full lg:rounded-lg">
                {/* <!-- Large screen -> */}
                <div className="hidden md:grid md:grid-cols-2 md:h-full">
                    <div className="bg-hero bg-center bg-cover bg-no-repeat"></div>
                    <div className="grid grid-cols-1 grid-rows-[auto_1fr_auto] h-full p-8">

                        <PostHeader >
                            <Separator className="my-2" />
                        </PostHeader>

                        <div className="p-4 ">
                            <p className="font-body-website leading-tight max-w-prose">A verdadeira pizza italiana em Pato Branco feita das mãos de um italiano.</p>
                        </div>

                        <PostFooter />
                    </div>

                </div>

            </div>


        </main>
    )
}

function MobileHomePage() {
    return (
        <>
            <MobileHeader />
            <div className="mt-[110px] mb-24">
                {
                    posts.map(p => <MobilePost title={p.title} content={p.content} imgSrc={p.imgSrc} imgAlt={p.imgAlt} />)
                }
            </div>
            <MobileFooter />
        </>

    )
}

function MobileHeader() {
    return (
        <header className="fixed inset-0 bg-white h-[100px]">
            <div className="grid grid-cols-6 items-center font-body-website p-4">
                <Logo color="black" className="w-[45px]" tagline={false} />
                <div className="flex flex-col gap-2 col-span-4">
                    <div className="flex flex-col">
                        <h1 className="text-sm font-bold leading-none tracking-tight">A Modo Mio</h1>
                        <h2 className="text-xs tracking-tight">La vera pizza italiana</h2>
                    </div>
                    <div className="flex gap-2 items-center">
                        <MakeMogoOrderButton classNameLabel="text-xs capitalize" classNameContainer="rounded bg-muted px-4" label="Novo pedido" />
                        <WhatsappExternalLink phoneNumber="46991272525"
                            ariaLabel="Envia uma mensagem com WhatsApp"
                            message={"Olá, gostaria fazer "}
                            className="rounded bg-muted px-4"
                        >
                            <span className="text-xs tracking-normal font-semibold">Atendimento</span>
                        </WhatsappExternalLink>
                    </div>
                </div>

                <ExternalLink
                    to="https://www.instagram.com/amodomiopb"
                    ariaLabel="Instagram"
                    className="flex justify-self-end"
                >
                    <Instagram className="justify-self-end" />
                </ExternalLink>
            </div>
            <Separator />
        </header>
    )
}

function MobileFooter() {

    return (
        <footer className="fixed inset-x-0 bottom-0 py-2 grid grid-cols-3 bg-white">
            <WhatsappExternalLink phoneNumber="46991272525"
                ariaLabel="Envia uma mensagem com WhatsApp"
                message={"Olá, gostaria fazer um pedido"}
                className="flex flex-col gap-1 justify-center items-center"
            >
                <WhatsAppIcon color="black" />
                <span className="text-xs tracking-normal font-semibold font-body-website">Atendimento</span>
            </WhatsappExternalLink>

            <Link to={'cardapio'} className="flex flex-col gap-1 justify-center items-center">
                <MenuSquare />
                <span className="text-xs tracking-normal font-semibold font-body-website">Cardápio</span>
            </Link>

            <MakeMogoOrderButton
                classNameLabel="text-xs tracking-normal font-semibold capitalize"
                classNameContainer="flex flex-col gap-1 justify-center items-center bg-transparent"
                label="Novo pedido"
            >
                <PlusSquare />
            </MakeMogoOrderButton>
        </footer>
    )
}

interface MobilePostPros {
    title?: string
    content?: string
    imgSrc?: string
    imgAlt?: string
}

function MobilePost({ title, content, imgSrc, imgAlt }: MobilePostPros) {
    return (
        <div className="md:hidden grid grid-cols-1 grid-rows-[auto_1fr] min-h-[650px]">

            <div className="grid grid-cols-4 gap-x-2 mb-6">
                <div className="grid place-items-center">
                    <div className="rounded-[100%] w-14 h-14 border grid place-items-center p-2 ">
                        <Logo color="black" tagline={false} />
                    </div>
                </div>
                <div className="flex flex-col col-span-3 w-[85%]">
                    <h3 className="text-sm font-bold leading-none tracking-tight font-body-website mb-2">{title}</h3>
                    <h4 className="text-sm tracking-tight font-body-website">{content}</h4>
                </div>
            </div>

            <img src={imgSrc} alt={imgAlt} />
            <PostFooter />
        </div>
    )
}

interface PostHeaderProps {
    children?: React.ReactNode;
}

function PostHeader({ children }: PostHeaderProps) {
    return (

        <header>
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

function PostFooter() {
    return (
        <footer className="pt-6 px-2">
            <PostActionBar />
            <Separator className="my-4" />
            <div className="px-4 w-full hidden md:block">
                <MakeMogoOrderButton />
            </div>
        </footer>
    )
}

function PostActionBar() {

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


            {/* <WhatsappExternalLink phoneNumber="46991272525"
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
            </Link> */}

        </div>
    )
}


interface MakeMogoOrderButtonProps {
    classNameContainer?: string
    classNameLabel?: string
    label?: string
    children?: React.ReactNode
}

function MakeMogoOrderButton({ classNameContainer, classNameLabel, label = "Fazer Pedido", children }: MakeMogoOrderButtonProps) {
    return (
        <ExternalLink to="https://app.mogomenu.com.br/amodomio"
            ariaLabel="Cardápio digital pizzaria A Modo Mio"
            className={
                cn(
                    "grid place-items-center font-body-website text-lg rounded-xl bg-brand-green py-1",
                    classNameContainer
                )
            }
        >
            {children}
            <span className={
                cn(
                    "uppercase tracking-wide font-semibold",
                    classNameLabel
                )
            }>{label}</span>
        </ExternalLink>
    )
}



