import Container from "~/components/layout/container/container"
import candidatosJson from "~/domain/hr/db/vagas-24-05-25-candidatos.json"
import right from "~/utils/right"
import { ok } from "~/utils/http-response.server"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { useLoaderData } from "@remix-run/react"
import { AlertCircle } from "lucide-react"
import { cn } from "~/lib/utils"
import { Separator } from "~/components/ui/separator"
import React from "react"
import Badge from "~/components/primitives/badge/badge"
import { V2_MetaFunction } from "@remix-run/node"




export async function loader() {

    const candidatos = candidatosJson.map(c => {
        const id = right(String(c.Telefone), 8)

        return {
            id,
            ...c
        }
    })

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
                            )
                        }>
                            <div className="flex justify-between items-center flex-reverse">
                                <Row title="Nome">{c.Nome}</Row>
                                <Badge className={
                                    cn(
                                        c.Recomendacao <= 5 && "bg-red-300",
                                        c.Recomendacao > 5 && c.Recomendacao <= 7 && "bg-yellow-300",
                                        c.Recomendacao > 7 && "bg-green-300"
                                    )
                                }>
                                    {c.Recomendacao <= 5 ? "Baixa" : c.Recomendacao > 5 && c.Recomendacao <= 7 ? "Media" : "Alta"}
                                </Badge>
                            </div>
                            <Row title="Idade">{c.Idade}</Row>
                            <Row title="Sexo">{c.Sexo}</Row>
                            <Row title="Telefone">{c.Telefone}</Row>
                            <Row title="Experienca">{c.Experienca}</Row>
                            <Row title="Disponibilidade">{c.Disponibilidade}</Row>
                            <Row title="Motivação">{c.Motivacao}</Row>
                            <Separator color="black" className="my-2" />
                            <Row title="Comprometimento e Colaboração">{c.ComprometimentoColaboracao}</Row>
                            <Row title="Opinião ChatGPT">{c.Opiniao}</Row>
                            <Row title="Recomendação">{c.Recomendacao}</Row>
                        </li>
                    ))
                }
            </ul>
        </Container>
    )
}

interface RowProps {
    title: string
    children: React.ReactNode
}

function Row({ title, children }: RowProps) {
    return (
        <p><span className="font-semibold">{title}: </span>{children}</p>
    )
}