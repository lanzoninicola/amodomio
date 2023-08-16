import type { LinksFunction } from "@remix-run/node";
import { type V2_MetaFunction } from "@remix-run/node";
import TypewriterComponent from "typewriter-effect";
import Container from "~/components/layout/container/container";
import Logo from "~/components/primitives/logo/logo";

// https://smart-pizza-marketing.framer.ai/

export const meta: V2_MetaFunction = () => {
    return [
        { title: "A Modio Mio - La vera pizza italiana" },
        {
            name: "description",
            content: "Bem vindo ao cardápio da Pizza Delivery A Modo Mio",
        },
    ];
};

export const links: LinksFunction = () => [
    { rel: "preconnect", href: "https://fonts.googleapis.com" },
    {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
    },
    {
        href: "https://fonts.googleapis.com/css2?family=Antonio:wght@400;700&family=Inter&family=Montagu+Slab:opsz,wght@16..144,400;16..144,600;16..144,700&display=swap",
        rel: "stylesheet",
    },
];

export default function HomePage() {
    return (
        <div className="min-h-screen bg-brand-blue">
            <Container clazzName="py-8">
                <div className="flex justify-center">
                    <div className="w-[120px] mb-8 flex ">
                        <Logo />
                    </div>
                </div>
                <div className="p-4">
                    <TypewriterHomepage />
                </div>
            </Container>
        </div>
    )
}




function TypewriterHomepage() {

    const doubleBreakLine = "<br /><br />"

    let text = "Caros amigos e amantes de pizza"
    text += doubleBreakLine
    text += "Estamos emocionados em anunciar a futura abertura da nossa pizzaria, onde traremos algo único para a cidade!"
    text += doubleBreakLine
    text += "Aqui, vocês terâo a oportunidade de saborear autênticas pizzas de massa italiana, preparadas por um verdadeiro italiano, nascido e crescido em Verona, Itàlia."
    text += doubleBreakLine
    text += "Nosso compromiss è trazer para vocês a verdadeira essêcia da pizza italiana, com toda a tradição e sabor que vocês merecem, claro, sem esquecer o gostinho preferidos dos brasileiros."
    text += doubleBreakLine
    text += "Além disso, teremos o prazer de oferecer a famosa Pizza Al Taglio, uma delìcia italia que conquistou corações ao redor do mundo."
    text += doubleBreakLine
    text += "Com uma massa leve, coberta com ingredientes frescos e saborosos, essa opção será uma alternativa irresistivel para os amantes da pizza."
    text += doubleBreakLine
    text += "Mal podemos esperar para abri nossas portas e compartilhar com vocês o melhor da cozinha italiana."
    text += doubleBreakLine
    text += "Aguardem ansiosos, pois em breve estaremos prontos para recebê-los e encantà-los com nossas pizzas de qualidade indiscutivel."
    text += doubleBreakLine
    text += "Ci vediamo presto..."
    text += doubleBreakLine
    text += "Atenciosamente, Team A Modo Mio"





    return (
        <div className="text-white text-lg tracking-wide">
            <TypewriterComponent
                options={{
                    strings: text,
                    autoStart: true,
                    loop: false,
                    delay: 75,
                }}


            />

        </div>
    )
}