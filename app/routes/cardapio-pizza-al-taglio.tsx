import { V2_MetaFunction } from "@remix-run/node";
import { Outlet, useLoaderData } from "@remix-run/react";
import { ChevronRight, ChevronRightIcon, ChevronRightSquare, HelpCircle, Settings } from "lucide-react";
import Container from "~/components/layout/container/container";
import Logo from "~/components/primitives/logo/logo";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { loader } from "./admin.cardapio._index";

export const meta: V2_MetaFunction = () => {
    return [
        { title: "Cardápio Pizza Al Taglio" },
        {
            name: "description",
            content: "Descubra o autêntico sabor da pizza al taglio em nosso cardápio de fatias de pizza. Delicie-se com uma variedade de sabores e coberturas frescas, incluindo opções vegetarianas e carne. Experimente a tradição italiana em cada fatia. Peça agora e saboreie a qualidade de nossos ingredientes frescos e massa de pizza feita na hora.",
        },
        {
            name: "keywords",
            content: "pizza al taglio, cardápio de pizza, pizza artesanal, sabores de pizza, fatias de pizza, coberturas de pizza, pizza italiana, opções vegetarianas, pizza delivery, pizzaria local, tradição italiana, delícias italianas, massa de pizza, ingredientes frescos",
        }
    ];
};

export default function CardapioPizzaAlTaglio() {
    return (
        <div className="min-h-screen">
            <Container className="min-h-screen">
                <div className="flex flex-col mb-6">
                    <div className="flex flex-col justify-center items-center w-full md:pt-6">
                        <div className="w-[120px] mb-12">
                            <Logo color="black" />
                        </div>
                    </div>
                    <div className="flex justify-between items-center">
                        <h1 className="font-accent font-semibold text-2xl md:text-4xl mb-2 uppercase">Cardápio Pizza Al Taglio</h1>
                        <HowItWorks />
                    </div>
                    <h2 className="">Escolha seus pedaços de pizza de hoje:</h2>
                </div>
                <Outlet />
            </Container>
        </div>
    )
}


function HowItWorks() {

    return (
        <Dialog >
            <DialogTrigger asChild>
                <Button variant="ghost" className="p-0">
                    <HelpCircle />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Perguntas e respostas</DialogTitle>

                </DialogHeader>
                <div className="flex flex-col gap-6 max-h-[500px] overflow-scroll p-2">
                    <section>
                        <div className="flex gap-1 items-center mb-2">
                            <ChevronRight size={14} />
                            <h2 className="font-semibold text-sm">O que significa?</h2>
                        </div>
                        <p className="tracking-tight max-w-prose">Significa <b className="mr-1">"pizza em pedaços"</b>
                            em italiano, é um estilo de pizza tradicional da Itália que é vendido em pedaços retangulares,
                            cortados de uma bandeja grande.</p>
                    </section>
                    <section>
                        <div className="flex gap-1 items-center mb-2">
                            <ChevronRight size={14} />
                            <h2 className="font-semibold text-sm">Como funçiona?</h2>
                        </div>
                        <p className="tracking-tight max-w-prose"><span className="font-semibold">Cada semana, são preparadas um número limitado de fatias com sabores diferentes</span>, que não estão disponíveis no cardápio. É uma oportunidade para explorar novos sabores.</p>
                    </section>
                    <section>
                        <div className="flex gap-1 items-center mb-2">
                            <ChevronRight size={14} />
                            <h2 className="font-semibold text-sm">Está disponível a entrega das fatias?</h2>
                        </div>

                        <p className="tracking-tight max-w-prose">As fatias são expostas no balcão da nossa pizzaria, convidando as pessoas a nos visitarem,
                            mas também <b>oferecemos entrega somente para pedidos de 4 fatias ou mais.</b></p>
                    </section>
                </div>
            </DialogContent>
        </Dialog>
    )
}