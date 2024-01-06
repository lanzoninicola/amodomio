import Container from "~/components/layout/container/container";
import { Card } from "~/components/ui/card";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "~/components/ui/carousel";


const numberOfPages = 12
const cardapioArray = Array.from({ length: numberOfPages }, (_, index) => `cardapio_pagina_${index + 1}`);


export default function Cardapio() {
    return (
        <div className="grid place-items-center bg-brand-blue min-h-screen md:bg-white md:max-w-[1024px] md:m-auto">
            <div className="flex flex-col md:mt-24">
                <h1 className="hidden md:block font-semibold font-title tracking-tight text-4xl mb-6">Cardápio</h1>
                <Carousel className="md:w-1/3 md:m-auto">
                    <CarouselContent>
                        {cardapioArray.map((item, index) => (
                            <CarouselItem key={index}>
                                <img src={`/images/cardapio/${item}.png`}
                                    loading="lazy"
                                    // width={500}
                                    // height={500}
                                    decoding="async"
                                    data-nimg="intrinsic"
                                    alt="cardapio" />
                            </CarouselItem>
                        ))}
                    </CarouselContent>
                    {/* <CarouselPrevious />
                <CarouselNext /> */}
                </Carousel>
            </div>
        </div>
    )

}