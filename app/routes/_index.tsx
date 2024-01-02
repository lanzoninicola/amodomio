import TypewriterComponent from "typewriter-effect";
import Container from "~/components/layout/container/container";
import Logo from "~/components/primitives/logo/logo";

// https://smart-pizza-marketing.framer.ai/

export default function HomePage() {
    return (
        <div className="min-h-screen bg-brand-blue md:py-16 ">
            <Container clazzName="py-8">
                <div className="flex justify-center flex-col items-center gap-4 mb-8 md:mb-16">
                    <div className="w-[120px] md:w-[180px]">
                        <Logo />
                    </div>
                    <div className="flex flex-col gap-0 items-center text-white font-accent text-sm">
                        <span>Rua Araribóia, 964 - La Salle</span>
                        <span>Pato Branco</span>
                    </div>
                </div>
                <div className="p-4 md:max-w-prose md:mx-auto">
                    <TypewriterHomepage />
                </div>
            </Container>
        </div>
    )
}




function TypewriterHomepage() {

    const doubleBreakLine = "<br /><br />"

    let text = "Caros amigos e amantes de pizza,"
    text += doubleBreakLine
    text += "Estamos emocionados em anunciar a futura abertura da nossa pizzaria, onde traremos algo único para a cidade!"
    text += doubleBreakLine
    text += "Aqui, vocês terâo a oportunidade de saborear autênticas pizzas de massa italiana, preparadas por um verdadeiro italiano, nascido e crescido em Verona, Itàlia."
    text += doubleBreakLine
    text += "Nosso compromisso è trazer para vocês a verdadeira essência da pizza italiana, com toda a tradição e sabor que vocês merecem, claro, sem esquecer o gostinho preferidos dos brasileiros."
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
        <div className="text-white text-lg md:text-xl tracking-wide">
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