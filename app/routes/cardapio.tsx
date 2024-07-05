
import { V2_MetaFunction } from "@remix-run/node";
import { ArrowDown, ArrowLeft, Heart, MenuSquare, Share2, ShoppingCart } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import TypewriterComponent from "typewriter-effect";
import FadeIn from "~/components/primitives/fade-in/fade-in";
import WhatsAppButton from "~/components/primitives/whatsapp/whatsapp";
import WhatsappExternalLink from "~/components/primitives/whatsapp/whatsapp-external-link";
import WhatsAppIcon from "~/components/primitives/whatsapp/whatsapp-icon";
import { Button } from "~/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi, CarouselPrevious, CarouselNext } from "~/components/ui/carousel";
import { cn } from "~/lib/utils";
import useBoundaryPosition from "~/utils/use-boundary-position";


export const meta: V2_MetaFunction = () => {
    return [
        { title: "Cardapio" },
        {
            name: "description",
            content: "Cardápio da Pizzaria A Modo Mio",
        },
        {
            name: "keywords",
            content: "cardápio a modo mio, cardápio pizzas",
        }
    ];
};

const numberOfPages = 10
const cardapioArray = Array.from({ length: numberOfPages }, (_, index) => {

    const prefix = "/images/cardapio-new/cardapio_web_pagina_"

    return index <= 8 ? `${prefix}0${index + 1}.png` : `${prefix}${index + 1}.png`
});



export default function CardapioPage() {
    const { boundary, elementRef } = useBoundaryPosition();
    const topPosition = boundary === null ? `${0}px` : `${boundary.bottom - 70}px`;

    const [currentSlide, setCurrentSlide] = useState(0)
    const [countSlides, setCountSlides] = useState(0)


    return (
        <div className="relative bg-[#1B1B1B] min-h-screen md:bg-white md:max-w-[1024px] md:m-auto h-screen">

            {
                currentSlide === 1 && (

                    <div className="absolute top-4 w-full grid place-items-center animate-pulse z-10 md:hidden">
                        <div className="flex gap-2 items-center bg-slate-200 px-3 py-1 rounded-lg">
                            <ArrowLeft size={16} />
                            <span className="text-sm font-semibold">arrastar para esquerda</span>
                            {/* <ArrowRight className="text-white" size={16} /> */}
                        </div>
                    </div>
                )

            }
            <BottomActionBar currentSlide={currentSlide} bottomPosition={"0rem"} showBarOnPageNumber={5} />
            <div className="flex flex-col md:mt-24" >
                <h1 className="hidden md:block font-semibold font-title tracking-tight text-4xl mb-6">Cardápio</h1>
                <div ref={elementRef}>
                    <CardapioCarousel setCountSlides={setCountSlides} setCurrentSlide={setCurrentSlide} />
                </div>
            </div>
            <Outlet />
        </div>
    )
}

interface CardapioCarouselProps {
    setCurrentSlide: (slide: number) => void
    setCountSlides: (slides: number) => void
}

function CardapioCarousel({
    setCurrentSlide,
    setCountSlides,
    ...props
}: CardapioCarouselProps) {
    const [api, setApi] = useState<CarouselApi>()

    useEffect(() => {
        if (!api) {
            return
        }

        setCountSlides(api.scrollSnapList().length)
        setCurrentSlide(api.selectedScrollSnap() + 1)

        api.on("select", () => {
            setCurrentSlide(api.selectedScrollSnap() + 1)
        })
    }, [api])


    return (
        <>
            <div className="hidden md:block">
                <div className="flex justify-center w-full mb-4">
                    <span className="text-center text-md font-semibold">Use as setas para navegar</span>
                </div>
            </div>
            <Carousel className="md:w-1/3 md:m-auto" setApi={setApi} opts={{ loop: true }}>
                <CarouselContent>
                    {cardapioArray.map((item, index) => (

                        <CarouselItem key={index} className="h-screen">
                            <img src={item}
                                loading="lazy"
                                decoding="async"
                                data-nimg="intrinsic"
                                alt={`cardapio pagína ${index + 1}`}
                                className="w-full"
                            />
                        </CarouselItem>
                    ))}

                </CarouselContent>
                <div className="hidden md:block">
                    <CarouselPrevious />
                    <CarouselNext />
                </div>
            </Carousel>
        </>
    )
}


interface BottomActionBarProps {
    currentSlide: number
    showBarOnPageNumber: number
    topPosition?: string
    bottomPosition?: string
}

function BottomActionBar({ currentSlide, showBarOnPageNumber, topPosition, bottomPosition }: BottomActionBarProps) {

    if (currentSlide < showBarOnPageNumber) {
        return null
    }

    let style = {}

    if (topPosition) {
        style = {
            top: topPosition
        }
    }

    if (bottomPosition) {
        style = {
            bottom: bottomPosition
        }
    }
    return (

        <div className="fixed z-10 w-full" style={style}>

            <FadeIn>
                {/* <div className="flex flex-row justify-between items-center w-full px-4 gap-4">
                    <WhatsAppButton />

                    <Link to="finalizar" aria-label="Botão para fazer o pedido" className="w-full">
                        <div className="flex flex-row items-center justify-center gap-2 rounded-lg bg-slate-300 h-[48px] shadow-2xl hover:bg-brand-green/50">
                            <ShoppingCart className="md:text-2xl" size={16} />
                            <span className="uppercase font-semibold tracking-wide text-center my-auto md:text-2xl"
                                aria-label="Fazer o pedido"
                            >Fazer Pedido</span>
                        </div>
                    </Link>
                </div> */}
                <ActionBar />
            </FadeIn>

        </div>

    )
}




function ActionBar() {

    const [likeIt, setLikeIt] = useState(false)



    return (
        <div className="grid grid-cols-3 font-body-website bg-slate-300 py-1 px-4">


            <WhatsappExternalLink phoneNumber="46991272525"
                ariaLabel="Envia uma mensagem com WhatsApp"
                message={"Olá, gostaria fazer um pedido"}
                className="flex flex-col justify-center items-center"
            >
                <WhatsAppIcon color="black" />
                <span className="text-xs tracking-normal font-semibold">Atendimento</span>
            </WhatsappExternalLink>

            <Link to={"/pdf/cardapio/amodomio-cardapio.pdf"} className="flex flex-col justify-center items-center" download>
                <ArrowDown />
                <span className="text-xs tracking-normal font-semibold">
                    Baixar PDF
                </span>
            </Link>

            <Link to={'finalizar'} className="flex flex-col justify-center items-center bg-brand-green rounded-lg p-1 shadow-md">
                <ShoppingCart />
                <span className="text-xs tracking-normal font-semibold">
                    Fazer Pedido
                </span>
            </Link>

        </div>
    )
}