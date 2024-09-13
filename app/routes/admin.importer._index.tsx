import { ImportData } from "@prisma/client"
import { LoaderFunctionArgs } from "@remix-run/node"
import { Link, useLoaderData } from "@remix-run/react"
import dayjs from "dayjs"
import { ChevronRight } from "lucide-react"
import { Button } from "~/components/ui/button"
import prismaClient from "~/lib/prisma/client.server"
import { ok } from "~/utils/http-response.server"
import tryit from "~/utils/try-it"

type ImportsResponse = {
    imports: ({
        ImportProfile: {
            id: string;
            name: string;
            description: string | null;
            table: string;
            createdAt: Date;
            updatedAt: Date;
        } | null;
    } & ImportData)[] | undefined
}

export async function loader({ request }: LoaderFunctionArgs) {

    const [err, imports] = await tryit(prismaClient.importData.findMany({
        orderBy: { createdAt: "desc" },
        include: {
            ImportProfile: true
        }
    }))
    return ok({ imports })

}


export default function ImporterList() {
    const loaderData = useLoaderData<typeof loader>()

    const imports = loaderData?.payload?.imports as ImportsResponse["imports"] || []


    return (
        <div className="flex flex-col gap-8">
            <Link to="new" className="btn btn-primary">
                <Button>Nova importaçao</Button>
            </Link>
            <ImportList imports={imports} />
        </div>
    )
}

function ImportList({ imports }: { imports: ImportsResponse["imports"] }) {

    if (Array.isArray(imports) && imports.length === 0) {
        return (
            <p className="text-center">Nenhuma importação realizada</p>
        )
    }

    return (
        <ul>
            {imports?.map((importData) => (
                <li key={importData.id}>
                    <Link to={importData.id}>
                        <div className="flex flex-col gap-2">
                            <div className="border p-4 rounded-md grid-cols-8 gap-4">
                                <div className="flex flex-col gap-2">
                                    <span className="text-xs text-muted-foreground">Nome do profilo de importação</span>
                                    <span>{importData.ImportProfile?.name}</span>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <span className="text-xs text-muted-foreground">ID de importação</span>
                                    <span>{importData.id}</span>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <span className="text-xs text-muted-foreground">Importado</span>
                                    <span>{dayjs(importData.createdAt).format("DD/MM/YYYY HH:mm")}</span>
                                </div>

                            </div>
                            <div className="flex gap-2">
                                <span className="text-xs text-muted-foreground">Descrição</span>
                                <span>{importData.description}</span>
                            </div>
                        </div>

                        <Link to={`${importData?.id}`} className="hover:bg-muted rounded-full p-1">
                            <ChevronRight />
                        </Link>
                    </Link>
                </li>
            ))}
        </ul>
    )
}