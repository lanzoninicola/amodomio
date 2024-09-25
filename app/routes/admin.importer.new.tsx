import { ImportProfile } from "@prisma/client";
import { LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useFetcher, useLoaderData } from "@remix-run/react";
import { useState } from "react";
import Container from "~/components/layout/container/container";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { toast } from "~/components/ui/use-toast";
import { bankTransactionImporterEntity } from "~/domain/importer/bank-transaction-importer.entity.server";
import prismaClient from "~/lib/prisma/client.server";
import { cn } from "~/lib/utils";
import { badRequest, ok } from "~/utils/http-response.server";
import { jsonParse, jsonStringify } from "~/utils/json-helper";
import tryit from "~/utils/try-it";

export async function loader({ request }: LoaderFunctionArgs) {

    const [err, importProfiles] = await tryit(prismaClient.importProfile.findMany())
    return ok({ importProfiles })

}

export async function action({ request }: LoaderFunctionArgs) {

    let formData = await request.formData();
    const { _action, ...values } = Object.fromEntries(formData);

    const records = jsonParse(values.data as string)
    const importProfileId = values.importProfileId as string

    if (!importProfileId) {
        return badRequest("Selecione o tipo de importação")
    }

    if (!records) {
        return badRequest("Nenhum registro encontrado")
    }

    const importProfile = await prismaClient.importProfile.findFirst({ where: { id: importProfileId } })

    if (!importProfile) {
        return badRequest("Nenhum tipo de importação encontrado")
    }

    if (_action === "import") {
        const [err, result] = await tryit(
            prismaClient.importSession.create({
                data: {
                    importProfileId: importProfileId,
                    description: values.description as string,
                    createdAt: new Date().toISOString(),
                    ImportSessionRecord: { create: records }
                },
            })
        )


        if (err) {
            return badRequest(err)
        }

        return ok({
            result: result
        })
    }

    if (_action === "import-bank-statement") {
        const recordsShouldBeImported = jsonParse(values.data as string)

        if (!recordsShouldBeImported) {
            return badRequest("Nenhum registro encontrado")
        }

        const [err, result] = await tryit(
            prismaClient.importSession.create({
                data: {
                    importProfileId: importProfileId,
                    description: values.description as string,
                    createdAt: new Date().toISOString(),
                    ImportSessionBankTransaction: { create: recordsShouldBeImported }
                },
            })
        )

        if (err) {
            return badRequest(err)
        }

        return ok({ result })
    }

    return null
}

export default function Importer() {
    const loaderData = useLoaderData<typeof loader>()
    const importProfiles: ImportProfile[] = loaderData.payload?.importProfiles || []
    const [importProfileId, setImportProfileId] = useState<ImportProfile["id"] | null>(null); // Seleção do tipo de importação
    const [fileData, setFileData] = useState<any>(null); // Armazenar o JSON do arquivo na memória

    const [description, setDescription] = useState("");

    const [notification, setNotification] = useState<any>({
        status: "idle",
        message: "Aguardando arquivo",
    });

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        console.log({ file })


        if (!file) {
            setNotification({
                status: "error",
                message: "Nenhum arquivo selecionado.",
            });
            return
        }


        setNotification("Arquivo selecionado.");
        const reader = new FileReader();
        // Função para ler o arquivo como JSON
        reader.onload = (e) => {
            try {

                const fileReaderResult = e.target?.result as string

                setNotification({
                    status: "success",
                    message: `Arquivo lido. ${fileReaderResult.length} registros encontrados.`,
                });

                const fileContent = jsonParse(fileReaderResult);
                setFileData(fileContent); // Armazena o JSON no estado
            } catch (error) {
                setNotification({
                    status: "error",
                    message: "Erro ao processar o arquivo JSON.",
                });
            }
        };

        reader.readAsText(file); // Lê o arquivo como texto

    };

    const fetcher = useFetcher({
        key: "importer",
    });

    const submitData = () => {

        let records = [] as any[]

        if (fileData) {
            records = Object.values(fileData)
        }

        fetcher.submit({
            data: jsonStringify(records) as string,
            importProfileId: importProfileId,
            description: description,
            _action: "import",
        }, { method: "post" });
    }

    const actionData = useActionData<typeof action>()
    const status = actionData?.status
    const message = actionData?.message

    if (status && status === 200) {
        toast({
            title: "OK",
            description: message,
        })
    }

    if (status && status !== 200) {
        toast({
            title: "Erro",
            description: message,
        })
    }


    return (
        <div className="flex flex-col">
            <div className="flex flex-col gap-4 mb-6">
                <div className="grid grid-cols-8 gap-4 w-full items-center ">
                    <Label className="col-span-2">
                        Selecione o perfil:
                    </Label>
                    <Select required onValueChange={setImportProfileId} >
                        <SelectTrigger className="col-span-4 h-fit" >
                            <SelectValue placeholder="Selecionar..." />
                        </SelectTrigger>
                        <SelectContent id="importProfileId">
                            <SelectGroup >
                                {importProfiles.map((importProfile) => (
                                    <SelectItem key={importProfile.id} value={importProfile.id} >
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-sm text-left">{importProfile.name}</span>
                                            <span className="text-xs text-muted-foreground font-mono  text-left">{importProfile.description}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                </div>

                <div className="grid grid-cols-8 gap-4 w-full items-center ">
                    <Label className="col-span-2">
                        Descrição:
                    </Label>
                    <Textarea required className="col-span-4" onChange={(e) => setDescription(e.target.value)} value={description} />
                </div>
            </div>
            <div className="flex flex-col rounded-md border p-4 gap-6" >
                <div className="flex gap-4 items-center">
                    <span className="font-semibold text-sm">Status:</span>
                    <span className={
                        cn(
                            "font-semibold text-sm",
                            notification.status === "error" && "text-red-500",
                            notification.status === "success" && "text-green-500",
                            notification.status === "idle" && "text-gray-500",
                        )
                    }>{notification.message}</span>
                </div>
                <div className="flex flex-col gap-4">

                    <Input type="file" accept=".json, .ofx" onChange={handleFileUpload} />
                    {fileData &&
                        <span>Numero de itens: {Object.keys(fileData).length}</span>
                    }
                    <Button onClick={submitData}

                    >Importar</Button>
                </div>
            </div>
        </div>
    )
}