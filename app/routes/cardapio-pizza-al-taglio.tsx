import { V2_MetaFunction } from "@remix-run/node";
import { Outlet } from "@remix-run/react";
import Container from "~/components/layout/container/container";
import Logo from "~/components/primitives/logo/logo";

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
        <div className="bg-orange-50 min-h-screen">
            <Container className="min-h-screen">
                <div className="flex flex-col mb-6">
                    <div className="flex flex-col justify-center items-center w-full md:pt-6">
                        <div className="w-[120px] mb-12">
                            <Logo color="black" />
                        </div>
                    </div>
                    <h1 className="font-accent font-semibold text-2xl md:text-4xl mb-2">Cardápio Pizza Al Taglio</h1>
                    <h2 className="">Escolha seus pedaços de pizza de hoje:</h2>
                </div>
                <Outlet />
            </Container>
        </div>
    )
}