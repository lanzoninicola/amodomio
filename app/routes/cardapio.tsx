
import { AlertTriangle, ArrowRight, ShoppingCart, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import ExternalLink from "~/components/primitives/external-link/external-link";
import FadeIn from "~/components/primitives/fade-in/fade-in";
import WhatsAppButton from "~/components/primitives/whatsapp/whatsapp";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "~/components/ui/carousel";
import useBoundaryPosition from "~/utils/use-boundary-position";

const numberOfPages = 12
const cardapioArray = Array.from({ length: numberOfPages }, (_, index) => `cardapio_pagina_${index + 1}`);


export default function CardapioPage() {
    const { boundary, elementRef } = useBoundaryPosition();
    const topPosition = boundary === null ? `${0}px` : `${boundary.bottom - 70}px`;

    const [currentSlide, setCurrentSlide] = useState(0)
    const [countSlides, setCountSlides] = useState(0)

    const [gotoMenu, setGotoMenu] = useState(false)


    return (
        <div className="relative bg-brand-blue min-h-screen md:bg-white md:max-w-[1024px] md:m-auto h-screen">
            <HowToMakeOrder />
            <Notification showBarOnPageNumber={12} currentSlide={currentSlide} />
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
            <BottomActionBar currentSlide={currentSlide} topPosition={topPosition} showBarOnPageNumber={4} setGotoMenu={setGotoMenu} />
            <div className="flex flex-col md:mt-24" >
                <h1 className="hidden md:block font-semibold font-title tracking-tight text-4xl mb-6">Cardápio</h1>
                <div ref={elementRef}>
                    <CardapioCarousel setCountSlides={setCountSlides} setCurrentSlide={setCurrentSlide} />
                </div>
            </div>
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
    setGotoMenu: (value: boolean) => void
}

function BottomActionBar({ currentSlide, showBarOnPageNumber, topPosition, setGotoMenu }: BottomActionBarProps) {

    if (currentSlide < showBarOnPageNumber) {
        return null
    }

    return (

        <div className="fixed z-50 w-full" style={{
            top: topPosition
        }}>

            <FadeIn>
                <div className="flex flex-row justify-between items-center w-full px-4 gap-4">
                    <WhatsAppButton />
                    <div className="grid place-items-center rounded-xl bg-brand-blue w-96 h-[48px] shadow-2xl">
                        <div className="flex flex-row items-center gap-2"
                            aria-label="Botão para fazer o pedido"
                        >
                            <ShoppingCart className="text-white" />
                            <span className="uppercase text-xl font-semibold font-accent tracking-wide text-center text-white my-auto"
                                onClick={() => setGotoMenu(true)}
                                aria-label="Fazer o pedido"
                            >Fazer Pedido</span>
                        </div>
                    </div>
                </div>
            </FadeIn>

        </div>

    )
}

interface NotificationProps {
    currentSlide: number
    showBarOnPageNumber: number
}

function Notification({ currentSlide, showBarOnPageNumber }: NotificationProps) {


    if (currentSlide < showBarOnPageNumber) {
        return null
    }

    return (
        <div className="absolute top-4 grid place-items-center z-10 mx-4">
            <div className="flex gap-2 items-center bg-brand-orange p-4 rounded-xl">
                <AlertTriangle className="self-start text-white p-0 m-0" size={24} />
                <span className="text-white text-sm font-semibold">Alguns sabores podem estar temporariamente indisponíveis no cardápio. Agradecemos pela compreensão!</span>
            </div>
        </div>
    )
}


function HowToMakeOrder() {

    return (
        <div className="absolute top-0 bottom-0 shadow-xl z-20 backdrop-blur-sm">
            <div className="bg-brand-blue rounded-xl py-6 px-4 shadow-xl m-6">
                <div className="flex flex-col gap-4">

                    <div className="flex justify-end text-white">
                        <XCircle />
                    </div>
                    <div >
                        <h1 className="font-accent font-semibold text-2xl text-white uppercase mb-4">Guia para finalizar o pedido</h1>
                        <div className="flex flex-col gap-16">

                            <div className="flex flex-col gap-6">
                                <p className="text-white ">Ao clicar no botão abaixo "Fazer o pedido", você será direçionado ao nosso cardápio digital.</p>
                                <div>
                                    <p className="font-semibold text-brand-orange font-accent uppercase text-lg">Lembre-se </p>
                                    <p className="text-white ">
                                        Para escolher os sabores, é necessário selecionar o tamanho primeiro</p>

                                </div>
                            </div>

                            <ExternalLink to="https://app.mogomenu.com.br/amodomio" ariaLabel="Link para fazer o pedido" className="flex gap-2 bg-brand-orange justify-center items-center py-2 rounded-lg">
                                <ShoppingCart className="text-white" />
                                <span className="uppercase text-xl font-semibold font-accent tracking-wide text-center text-white my-auto">Fazer Pedido</span>
                            </ExternalLink>
                        </div>
                    </div>
                </div>
            </div>
        </div>

    )
}