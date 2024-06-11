


import { V2_MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { ArrowUpRight } from "lucide-react";
import Container from "~/components/layout/container/container";
import { Separator } from "~/components/ui/separator";

export const meta: V2_MetaFunction = () => {
    return [
        { title: "Dia dos Namorados - Informações e regulamento" },
        {
            name: "description",
            content: "Informações e regulamento para o 'Dia dos Namorados' com A Modo Mio",
        },
    ];
};

export default function DiaDosNamoradosRegulamento() {

    return (
        <Container className="py-12 px-8 bg-slate-50">
            <section >
                <h1 className="font-semibold mb-4 uppercase leading-tight tracking-wide">Regulamento de Reserva de Pizza para o Dia dos Namorados</h1>
                <p >Sabemos que a nossa produção de pizzas é limitada, e para garantir que você tenha a sua pizza no Dia dos Namorados,
                    estamos oferecendo a possibilidade de reservar antecipadamente. A reserva é uma oportunidade especial para assegurar
                    que você desfrute da nossa deliciosa pizza sem preocupações.</p>
            </section>
            <Separator className="my-8" />
            <section >
                <h3 className="text-sm font-semibold mb-4 uppercase leading-none tracking-wide">Como Funciona a Reserva</h3>
                <ul className="list-decimal list-inside flex flex-col gap-2">
                    <li><span className="font-semibold">Reserva Antecipada: </span>A prioridade será dada aos clientes que fizerem a reserva antecipada da pizza.</li>
                    <li><span className="font-semibold">Escolha do Horário de Entrega: </span>Oferecemos a flexibilidade de escolher o horário de entrega que mais lhe convier, <span className="font-semibold">dentro do nosso horário de funcionamento, das 18h às 22h</span>. No entanto, em caso de alto volume de pedidos, pode ser que não consigamos cumprir exatamente o horário solicitado, mas faremos o possível para entregar no horário estabelecido.</li>
                    <li><span className="font-semibold">Envio da Reserva: </span>As reservas devem ser enviadas via WhatsApp para o número da nossa pizzaria: <span className="font-semibold">(46) 9127-2525</span></li>
                </ul>
            </section>
            <Separator className="my-8" />
            <section >
                <h3 className="text-sm font-semibold mb-4 uppercase leading-none tracking-wide">Importante</h3>
                <ul className="list-disc list-inside">
                    <li><span className="font-semibold">Quantidade Limitada: </span>A prioridade será dada aos clientes que fizerem a reserva antecipada da pizza.</li>
                    <li><span className="font-semibold">Alterações e Cancelamentos: </span>Se precisar alterar ou cancelar sua reserva, pedimos que nos avise com a maior antecedência possível para que possamos atender todos os pedidos da melhor maneira.</li>
                </ul>
            </section>
            <Separator className="my-8" />
            <section className="mb-6">
                <h3 className="text-sm font-semibold mb-4 uppercase leading-none tracking-wide">Termos e Condições</h3>
                <ul className="list-disc list-inside">
                    <li><span className="font-semibold">Imprevistos: </span>Em caso de imprevistos como problemas de logística ou falta de ingredientes, nos reservamos o direito de cancelar ou ajustar os pedidos, sempre informando o cliente com antecedência.</li>
                    <li><span className="font-semibold">Responsabilidade do Cliente: </span>É responsabilidade do cliente fornecer informações corretas e completas para a entrega, incluindo endereço e horário preferido. Não nos responsabilizamos por atrasos ou falhas na entrega devido a informações incorretas.</li>
                </ul>
            </section>

            <Link to="/cardapio"
                className="flex gap-2 bg-slate-300 justify-center items-center py-4 rounded-lg mb-4">

                <span className="uppercase text-lg font-semibold  tracking-wide text-center leading-none text-black">Cardápio</span>
                <ArrowUpRight size={16} color="black" />
            </Link>
        </Container>
    )
}


