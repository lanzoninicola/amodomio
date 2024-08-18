import { MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Instagram } from "lucide-react";
import Container from "~/components/layout/container/container";
import ExternalLink from "~/components/primitives/external-link/external-link";
import { cn } from "~/lib/utils";
import { ok } from "~/utils/http-response.server";

export const meta: MetaFunction = () => {
    return [
        { title: "Vaga Auxiliar Cozinha" },
        {
            name: "description",
            content: "Candidatura para a posição de Auxiliar de Cozinha na Pizzaria A Modo Mio",
        },
    ];
};

export async function loader() {

    const statusVaga = process.env?.HR_VAGA_STATUS_AUXILIAR_COZINHA || "Aberta"

    return ok({ statusVaga })
}


export default function VagaSingle() {
    const loaderData = useLoaderData<typeof loader>()
    const statusVaga = loaderData?.payload?.statusVaga || []

    return (
        <Container className="my-8">

            <div className="flex flex-col mb-8">
                <h1 className="text-xl font-semibold tracking-tight">Vaga: Auxiliar de Cozinha</h1>
                <h2 className="text-md mb-4 text-muted-foreground tracking-tight">Empresa: A Modo Mio, Pato Branco, Paraná</h2>
                <h4 className="flex gap-2 items-center">
                    <Instagram />
                    <ExternalLink to="https://www.instagram.com/amodomiopb/" ariaLabel="Instagram A Modo Mio" className="underline text-sm">Instagram</ExternalLink>
                </h4>
            </div>

            <div className="flex items-center mb-8 gap-4">
                <span className="text-sm text-muted-foreground">Status vaga: </span>
                <span className={
                    cn(
                        "grid place-items-center rounded-xl px-4 py-1 text-md font-semibold  uppercase tracking tracking-wider",
                        statusVaga.toLowerCase() === "aberta" && "bg-green-100 ",
                        statusVaga.toLowerCase() === "fechada" && "bg-red-100 ",
                        statusVaga.toLowerCase() === "em andamento" && "bg-yellow-100 "
                    )
                }>
                    {statusVaga}
                </span>
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
                    Candidate-se clicando no botão <strong className="uppercase text-sm">Candidatar-me</strong> abaixo. Analisaremos todas as candidaturas e entraremos em contato com os candidatos selecionados para a próxima fase do processo seletivo.
                </p>
            </section>

            <ExternalLink to="https://forms.gle/fRbMznRjVrxFbmzFA" ariaLabel="Canditarme" className="flex w-full justify-center bg-green-400 rounded-xl uppercase font-semibold tracking-wider py-2">
                Candidatar-me
            </ExternalLink>
        </Container>
    )
}