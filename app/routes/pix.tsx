import { Label } from "@radix-ui/react-label"
import { LoaderFunctionArgs } from "@remix-run/node"
import { Form, useLoaderData } from "@remix-run/react"
import { Moon, Sun } from "lucide-react"
import { useState } from "react"
import Container from "~/components/layout/container/container"
import CopyButton from "~/components/primitives/copy-button/copy-button"
import SubmitButton from "~/components/primitives/submit-button/submit-button"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import Fieldset from "~/components/ui/fieldset"
import { Input } from "~/components/ui/input"
import { toast } from "~/components/ui/use-toast"
import { cn } from "~/lib/utils"
import { badRequest, ok } from "~/utils/http-response.server"

export async function loader({ request }: LoaderFunctionArgs) {
    const pixKey = process.env?.PIX_KEY
    const pixId = process.env?.PIX_ID

    if (!pixKey) {
        return badRequest("Nenhuma chave pix foi cadastrada")
    }

    return ok({
        pixKey,
        pixId
    })

}

export default function PixPage() {
    const loaderData = useLoaderData<typeof loader>()
    const pixKey = loaderData?.payload?.pixKey
    const pixId = loaderData?.payload?.pixId

    if (loaderData?.status !== 200) {
        return (
            <Container className="grid place-items-center h-screen min-w-full">
                <span>{loaderData?.message || "erro generico"}</span>
            </Container>
        )
    }

    const [nightlyMode, setNightlyMode] = useState(true)

    return (
        <Container className="h-screen">
            <div className="flex flex-col h-full">
                <div className="py-4 grid grid-cols-2 gap-x-4 w-full md:flex md:justify-end" data-element="header">
                    <Button variant={"outline"}
                        className={
                            cn(
                                "flex gap-4 items-center",
                                nightlyMode === false && "bg-black text-white"
                            )
                        }
                        onClick={() => setNightlyMode(false)}>
                        <Sun />
                        <span className="text-md font-semibold">Modo claro</span>
                    </Button>
                    <Button variant={"outline"}
                        className={
                            cn(
                                "flex gap-4 items-center ",
                                nightlyMode === true && "bg-black text-white",

                            )
                        }
                        onClick={() => setNightlyMode(true)}>
                        <Moon />
                        <span className="text-md font-semibold">Modo escuro</span>
                    </Button>

                </div>
                <div className={
                    cn(
                        "h-full",
                    )
                }>
                    <div className="flex flex-col gap-16 mt-[25%]">
                        <PixCard title="Chave Pix" content={pixKey} nightlyMode={nightlyMode} enableCopy={true} classNameContent="text-4xl" />
                        <PixCard title="Nome" content={pixId} nightlyMode={nightlyMode} />
                    </div>
                </div>

            </div>


        </Container >
    )
}

interface PixCardProps {
    title: string
    content: string
    nightlyMode?: boolean
    enableCopy?: boolean
    classNameContent?: string
}

function PixCard({ title, content, nightlyMode, enableCopy, classNameContent }: PixCardProps) {
    return (
        <Card className={
            cn(
                nightlyMode === true && "bg-black text-white"
            )
        }

        >
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="text-sm">{title}</CardTitle>
                    {enableCopy === true &&
                        <CopyButton textToCopy={content} variant="ghost"
                            classNameLabel={
                                cn(
                                    nightlyMode === true && "text-white",
                                    "text-xs font-semibold uppercase tracking-wide"
                                )
                            }
                            classNameIcon={
                                cn(
                                    nightlyMode === true && "text-white",
                                )
                            }
                            label="Copiar" />
                    }
                </div>
            </CardHeader>
            <CardContent >
                <span className={
                    cn(
                        "text-3xl",
                        classNameContent
                    )
                }>{content}</span>
            </CardContent>
        </Card>
    )
}
