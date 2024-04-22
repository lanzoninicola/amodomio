
export default function PromoRules() {

    return (
        <div className="flex flex-col gap-6">
            <ul className="flex flex-col gap-2">
                <li>- O desconto e a entrega gratuita são válidos somente no dia divulgado, durante o horário da promoção.</li>
                <li>- Disponibilizaremos <strong>um número limitado de pizzas</strong> durante a promoção.</li>
                <li>- A promoção é válida e as entregas serão realizadas exclusivamente entre <strong>as 18:30 e 20:30</strong>.</li>
                <li>- Não será seguida uma ordem específica de entrega durante a promoção. Portanto, é importante que os clientes estejam disponíveis para receber suas pizzas em qualquer momento dentro do horário estabelecido para a promoção.</li>
                <li>- A pizza disponibilizada será de <span className="font-semibold">Tamanho Médio (para 2 pessoas)</span> e limitada a apenas <span className="font-semibold">um sabor</span>.</li>
                <li>- Para garantir a eficiência durante a promoção, não será possível modificar os ingredientes das pizzas.</li>
            </ul>

            <div className="flex flex-col">
                <span className="font-semibold">Obrigado</span>
                <span>Equipe A Modo Mio</span>

            </div>
        </div>
    )
}