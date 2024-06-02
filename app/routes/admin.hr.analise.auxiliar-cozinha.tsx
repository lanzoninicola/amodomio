import Container from "~/components/layout/container/container"
import candidatosJson from "~/domain/hr/db/vagas-24-05-25-candidatos.json"
import right from "~/utils/right"
 import { ok } from "~/utils/http-response.server"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { useLoaderData } from "@remix-run/react"
import { AlertCircle } from "lucide-react"
import { cn } from "~/lib/utils"
import { Separator } from "~/components/ui/separator"




export async function loader() {

    const candidatos = candidatosJson.map(c => {
        const id = right(String(c.Telefone), 8)

        return {
            id,
            ...c
        }
    })


    console.log({ candidatos })

    return ok({ candidatos })
}

export default function VagaAuxiliarCozinha() {

    const loaderData = useLoaderData<typeof loader>()
    const candidatos = loaderData?.payload?.candidatos || []




    if (loaderData?.status !== 200) {
        <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Oops</AlertTitle>
            <AlertDescription>
                {loaderData?.message}
            </AlertDescription>
        </Alert>
    }

    return (
        <Container>


            <ul className="flex flex-col gap-4">
                {
                    candidatos.map(c => (
                        <li key={c.id} className={
                            cn(
                                "flex flex-col gap-2 border rounded-lg p-4",
                                c.Recomendacao <= 5 && "bg-red-300",
                                c.Recomendacao > 5 && c.Recomendacao <= 7 && "bg-yellow-300",
                                c.Recomendacao > 7 && "bg-green-300"
                            )
                        }>
                            <span><strong>Nome: </strong>{c.Nome}</span>
                            <span><strong>Idade: </strong>{c.Idade}</span>
                            <span><strong>Sexo: </strong>{c.Sexo}</span>
                            <span><strong>Telefone: </strong>{c.Telefone}</span>
                            <span><strong>Experienca: </strong>{c.Experienca}</span>
                            <span><strong>Disponibilidade: </strong>{c.Disponibilidade}</span>
                            <span><strong>Motivação: </strong>{c.Motivacao}</span>
                            <Separator color="black" />
                            <span><strong>Comprometimento e Colaboração: </strong>{c.ComprometimentoColaboracao}</span>
                            <span><strong>Opinião ChatGPT: </strong>{c.Opiniao}</span>
                            <span><strong>Recomendação: </strong>{c.Recomendacao}</span>
                        </li>
                    ))
                }
            </ul>
        </Container>
    )
}