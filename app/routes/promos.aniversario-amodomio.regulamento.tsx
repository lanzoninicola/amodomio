import Container from "~/components/layout/container/container";
import { Separator } from "~/components/ui/separator";


export default function Regulamento() {
    return (
        <Container className="my-12">
            <h1 className="text-lg font-semibold mb-6">Regulamento do Sorteio "Aniversário A Modo Mio"</h1>

            <section className="mb-8">
                <h2 className="text-sm uppercase tracking-wide font-semibold mb-4">1. Detalhes Básicos</h2>
                <Separator className="my-4" />
                <p className="mb-2"><strong>Nome do sorteio:</strong> "Aniversário A Modo Mio"</p>
                <p className="mb-2"><strong>Objetivo:</strong> Celebrar o aniversário da pizzaria junto aos clientes e estimular o engajamento.</p>
                <p className="mb-2"><strong>Prêmio:</strong> Conjunto de Pizza Tramontina e uma pizza média sabor “Margherita di Napoli” acompanhada de uma Coca-Cola 2L.</p>
            </section>

            <section className="mb-8">
                <h2 className="text-sm uppercase tracking-wide font-semibold mb-4">2. Participação e Elegibilidade</h2>
                <Separator className="my-4" />
                <p className="mb-2"><strong>Quem pode participar:</strong> Clientes que fizerem um pedido de pizza média ou grande na pizzaria A Modo Mio.</p>
                <p className="mb-2"><strong>Restrição de idade:</strong> Não há restrições de idade.</p>
                <p className="mb-2"><strong>Como participar:</strong> Participação automática ao realizar um pedido de pizza média ou grande.</p>
                <p className="mb-2"><strong>Comprovante de participação:</strong> Não necessário, pois os tickets serão registrados internamente.</p>
            </section>

            <section className="mb-8">
                <h2 className="text-sm uppercase tracking-wide font-semibold mb-4">3. Duração do Sorteio</h2>
                <Separator className="my-4" />
                <p className="mb-2"><strong>Período de participação:</strong> De 1º a 30 de novembro de 2024.</p>
                <p className="mb-2"><strong>Data do sorteio:</strong> 04 de dezembro de 2024.</p>
                <p className="mb-2"><strong>Local do sorteio:</strong> A extração será gravada e divulgada nas redes sociais oficiais.</p>
            </section>

            <section className="mb-8">
                <h2 className="text-sm uppercase tracking-wide font-semibold mb-4">4. Mecânica do Sorteio</h2>
                <Separator className="my-4" />
                <p className="mb-2"><strong>Formato do sorteio:</strong> Extração do número do pedido.</p>
                <p className="mb-2"><strong>Quantas vezes pode participar:</strong> Cada pedido de pizza média ou grande representa uma chance.</p>
                <p className="mb-2"><strong>Escolha do vencedor:</strong> Número do pedido sorteado e auditado pela diretoria.</p>
            </section>

            <section className="mb-8">
                <h2 className="text-sm uppercase tracking-wide font-semibold mb-4">5. Premiação</h2>
                <Separator className="my-4" />
                <p className="mb-2"><strong>Informação ao vencedor:</strong> O vencedor será contatado via WhatsApp.</p>
                <p className="mb-2"><strong>Prazo para reivindicar o prêmio:</strong> Até 15 dias após o sorteio.</p>
                <p className="mb-2"><strong>Condições para receber o prêmio:</strong> Comprovar titularidade do telefone vinculado ao pedido.</p>
                <p className="mb-2"><strong>Troca do prêmio:</strong> Não permitida a troca por dinheiro ou outros itens.</p>
            </section>

            <section className="mb-8">
                <h2 className="text-sm uppercase tracking-wide font-semibold mb-4">6. Regras Gerais e Exceções</h2>
                <Separator className="my-4" />
                <p className="mb-2"><strong>Pessoas impedidas de participar:</strong> Todos que fizerem um pedido, conforme regulamento, podem participar.</p>
                <p className="mb-2"><strong>Se o vencedor não reivindicar o prêmio:</strong> Nova extração será realizada.</p>
                <p className="mb-2"><strong>Custos adicionais:</strong> Não haverá cobranças adicionais.</p>
            </section>

        </Container>
    );
}
