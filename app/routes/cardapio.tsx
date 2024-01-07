
import { V2_MetaFunction } from "@remix-run/node";
import { ShoppingCart } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import FadeIn from "~/components/primitives/fade-in/fade-in";
import WhatsAppButton from "~/components/primitives/whatsapp/whatsapp";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "~/components/ui/carousel";
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

const numberOfPages = 12
const cardapioArray = Array.from({ length: numberOfPages }, (_, index) => `cardapio_pagina_${index + 1}`);

export default function CardapioPage() {
    const { boundary, elementRef } = useBoundaryPosition();
    const topPosition = boundary === null ? `${0}px` : `${boundary.bottom - 70}px`;

    const [currentSlide, setCurrentSlide] = useState(0)
    const [countSlides, setCountSlides] = useState(0)


    return (
        <div className="relative bg-brand-blue min-h-screen md:bg-white md:max-w-[1024px] md:m-auto h-screen">

            {
                currentSlide === 1 && (

                    <div className="absolute top-4 w-full grid place-items-center animate-pulse z-10">
                        <div className="flex gap-2 items-center bg-brand-orange px-3 py-1 rounded-xl">
                            <span className="text-white text-sm font-semibold">arrastar para esquerda</span>
                            {/* <ArrowRight className="text-white" size={16} /> */}
                        </div>
                    </div>
                )

            }
            <BottomActionBar currentSlide={currentSlide} topPosition={topPosition} showBarOnPageNumber={4} />
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

        <Carousel className="md:w-1/3 md:m-auto" setApi={setApi} >
            <CarouselContent>
                {cardapioArray.map((item, index) => (
                    <CarouselItem key={index}>
                        <img src={`/images/cardapio/${item}.png`}
                            loading="lazy"
                            decoding="async"
                            data-nimg="intrinsic"
                            alt={`cardapio pagína ${index + 1}`} />
                    </CarouselItem>
                ))}
            </CarouselContent>
            {/* <CarouselPrevious />
                <CarouselNext /> */}
        </Carousel>
    )
}


interface BottomActionBarProps {
    currentSlide: number
    showBarOnPageNumber: number
    topPosition: string
}

function BottomActionBar({ currentSlide, showBarOnPageNumber, topPosition }: BottomActionBarProps) {

    if (currentSlide < showBarOnPageNumber) {
        return null
    }

    return (

        <div className="fixed z-10 w-full" style={{
            top: topPosition
        }}>

            <FadeIn>
                <div className="flex flex-row justify-between items-center w-full px-4 gap-4">
                    <WhatsAppButton />

                    <Link to="finalizar" aria-label="Botão para fazer o pedido" className="w-full">
                        <div className="flex flex-row items-center justify-center gap-2 rounded-xl bg-brand-green h-[48px] shadow-2xl">
                            <ShoppingCart className="text-white" />
                            <span className="uppercase text-xl font-semibold font-accent tracking-wide text-center text-white my-auto"
                                aria-label="Fazer o pedido"
                            >Fazer Pedido</span>
                        </div>
                    </Link>
                </div>
            </FadeIn>

        </div>

    )
}




