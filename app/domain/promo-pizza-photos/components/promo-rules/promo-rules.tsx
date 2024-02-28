
export default function PromoRules() {

    return (
        <div className="flex flex-col gap-6">
            <ul className="flex flex-col gap-2">
                <li>- A promoção é válida apenas no dia determinado e comunicado através de mensagem pelo WhatsApp.</li>
                <li>- A promoção é válida exclusivamente <span className="font-semibold">das 18:30 às 20:30</span>, e a entrega da pizza ocorrerá dentro desse intervalo de tempo.</li>
                <li>- Será disponibilizado um número limitado de pizzas.</li>
                <li>- A pizza disponibilizada será de <span className="font-semibold">Tamanho Médio (para 2 pessoas)</span> e limitada a apenas <span className="font-semibold">um sabor</span>.</li>
                <li>- Não será possível adicionar ou remover ingredientes.</li>
            </ul>

            <div className="flex flex-col">
                <span className="font-semibold">Obrigado</span>
                <span>Equipe A Modo Mio</span>

            </div>
        </div>
    )
}