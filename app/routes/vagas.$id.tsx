import { V2_MetaFunction } from "@remix-run/node";
import Container from "~/components/layout/container/container";
import ExternalLink from "~/components/primitives/external-link/external-link";

export const meta: V2_MetaFunction = () => {
    return [
        {
            name: "title",
            content: "Trabalhe conosco - Auxiliar de Cozinha",
        },
        {
            name: "description",
            content: "Vaga de Auxiliar De Cozinha na Pizzaria A Modo Mio"
        }
    ];
};


export default function VagaSingle() {

    return (
        <Container className="my-8">

            <div className="flex flex-col mb-8">
                <h1 className="text-xl font-semibold tracking-tight">Vaga: Auxiliar de Cozinha</h1>
                <h2 className="text-md font-semibold">Local: A Modo Mio, Pato Branco, Paraná</h2>
            </div>

            <div className="flex items-center mb-8 gap-4">
                <span className="text-sm text-muted-foreground">Status vaga: </span>
                <span className="grid place-items-center rounded-lg px-4 pl-2 bg-green-300 text-md font-semibold  uppercase tracking tracking-wider">Aberta</span>
            </div>

            <section className="mb-8">
                <h3 className="text-base font-semibold mb-2">Descrição da Vaga:</h3>
                <p>Estamos em busca de um Auxiliar de Cozinha para se juntar à nossa equipe na pizzaria A Modo Mio. Se você é uma pessoa proativa, gosta de trabalhar em equipe e tem paixão pela culinária, queremos conhecer você!</p>
            </section>

            <section className="mb-8">
                <h3 className="text-base font-semibold mb-2">Responsabilidades</h3>
                <ul className="list-disc pl-4">
                    <li>Auxiliar na preparação de ingredientes para as pizzas.</li>
                    <li>Manter a cozinha organizada e limpa durante e depois do serviço</li>
                    <li>Seguir as normas de higiene e segurança alimentar</li>
                    <li>Colaborar com a equipe para garantir a eficiência e qualidade no serviço</li>
                </ul>
            </section>

            <section className="mb-8">
                <h3 className="text-base font-semibold mb-2">Requisitos</h3>
                <ul className="list-disc pl-4">
                    <li>Disponibilidade para trabalhar <strong>sextas, sábados e domingos, das 19:30 às 23:30</strong>.</li>
                    <li>Facilidade para trabalhar em equipe.</li>
                    <li>Comprometimento e responsabilidade.</li>
                    <li>Boa comunicação e agilidade.</li>
                </ul>
            </section>

            <section className="mb-8">
                <h3 className="text-base font-semibold mb-2">Oferecemos</h3>
                <ul className="list-disc pl-4">
                    <li>Contrato de trabalho formalizado sob CLT.</li>
                    <li>Vale alimentação.</li>
                    <li>13º salário e férias proporcionais.</li>
                    <li>Ambiente de trabalho dinâmico e amigável.</li>
                </ul>
            </section>

            <section className="mb-8">
                <h3 className="text-base font-semibold mb-2">Como se candidar</h3>
                <p>
                    Candidate-se clicando no botão "Candidatar-me" abaixo. Analisaremos todas as candidaturas e entraremos em contato com os candidatos selecionados para a próxima fase do processo seletivo.
                </p>
            </section>

            <ExternalLink to="https://forms.gle/fRbMznRjVrxFbmzFA" ariaLabel="Canditarme" className="flex w-full justify-center bg-green-400 rounded-xl uppercase font-semibold tracking-wider py-2">
                Candidatar-me
            </ExternalLink>
        </Container>
    )
}