import { ImportProfile } from "@prisma/client";
import { LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useFetcher, useLoaderData } from "@remix-run/react";
import { set } from "date-fns";
import { useState } from "react";
import { a } from "vitest/dist/suite-BWgaIsVn.js";
import Container from "~/components/layout/container/container";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { toast } from "~/components/ui/use-toast";
import { bankTransactionImporterEntity } from "~/domain/importer/bank-transaction-importer.entity.server";
import { OfxParser, OfxRawTransaction } from "~/domain/importer/ofx-parser";
import prismaClient from "~/lib/prisma/client.server";
import { cn } from "~/lib/utils";
import { badRequest, ok } from "~/utils/http-response.server";
import { jsonParse, jsonStringify } from "~/utils/json-helper";
import tryit from "~/utils/try-it";

interface ImporterNotification {
    status: "error" | "success" | "idle"
    message: string | undefined | null

}

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
        return badRequest("Nenhum tipo de importação selecionado")
    }

    if (_action === "import") {
        const [err, result] = await tryit(
            prismaClient.importSession.create({
                data: {
                    importProfileId: importProfileId,
                    description: values.description as string,
                    createdAt: new Date().toISOString(),
                    ImportSessionRecord: {
                        create: records.map((r: any) => {
                            return {
                                ...r,
                                createdAt: new Date().toISOString()
                            }
                        })
                    }
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

        const [err, result] = await tryit(
            prismaClient.importSession.create({
                data: {
                    importProfileId: importProfileId,
                    description: values.description as string,
                    createdAt: new Date().toISOString(),
                    ImportSessionRecordBankTransaction: {
                        create: records.map((r: any) => bankTransactionImporterEntity.parseOfxRawRecord(r, values.bankName as string))

                    }
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
    const [description, setDescription] = useState("");

    const [submissionStatus, setSubmissionStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [notification, setNotification] = useState<any>({
        status: "idle",
        message: "Aguardando arquivo",
    });

    const importProfile = importProfiles.find((importProfile) => importProfileId === importProfile.id)

    const actionData = useActionData<typeof action>()
    const status = actionData?.status
    const message = actionData?.message

    console.log({ actionData })

    if (status && status === 200) {
        setSubmissionStatus("success");
        toast({
            title: "OK",
            description: message,
        })
    }

    if (status && status !== 200) {
        setSubmissionStatus("success");
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

                {
                    importProfile?.ofx === true ?
                        <OfxImporter
                            importProfileId={importProfileId}
                            description={description}
                            setNotification={setNotification} submisionStatus={submissionStatus} setSubmissionStatus={setSubmissionStatus} />
                        : <JsonImporter
                            importProfileId={importProfileId}
                            description={description}
                            setNotification={setNotification} submisionStatus={submissionStatus} setSubmissionStatus={setSubmissionStatus} />
                }

            </div>
        </div>
    )
}



interface ImporterChildrenProps {
    importProfileId: ImportProfile["id"] | null
    description: string
    setNotification: (notification: ImporterNotification) => void
    submisionStatus: "idle" | "loading" | "success" | "error"
    setSubmissionStatus: (status: "idle" | "loading" | "success" | "error") => void
}

function JsonImporter({ importProfileId, description, setNotification, submisionStatus, setSubmissionStatus }: ImporterChildrenProps) {
    const [fileContent, setFileContent] = useState<any>(null); // Armazenar o JSON do arquivo na memória

    const fetcher = useFetcher({
        key: "json-importer",
    });

    const submit = () => {
        setSubmissionStatus("loading");

        let records = [] as any[]

        if (fileContent) {
            records = Object.values(fileContent)
        }

        fetcher.submit({
            data: jsonStringify(records) as string,
            importProfileId: importProfileId,
            description: description,
            _action: "import",
        }, { method: "post" });
    }



    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSubmissionStatus("idle");
        const file = event.target.files?.[0];

        if (!file) {
            setNotification({
                status: "error",
                message: "Nenhum arquivo selecionado.",
            });
            return
        }

        setNotification({
            status: "success",
            message: "Aguardando arquivo",
        });

        const reader = new FileReader();
        // Função para ler o arquivo como JSON
        reader.onload = (e) => {
            try {
                const fileReaderResult = e.target?.result as string

                setNotification({
                    status: "success",
                    message: `Arquivo lido. ${fileReaderResult.length} registros encontrados.`,
                });

                const fileContentParsed = jsonParse(fileReaderResult);
                setFileContent(fileContentParsed);
            } catch (error) {
                setNotification({
                    status: "error",
                    message: "Erro ao processar o arquivo.",
                });
            }
        };

        reader.readAsText(file); // Lê o arquivo como texto
    };


    return (
        <FormImporter
            type="json"
            handleFileUpload={handleFileUpload} submit={submit} submissionStatus={submisionStatus} />
    )

}

function OfxImporter({ importProfileId, description, setNotification, submisionStatus, setSubmissionStatus }: ImporterChildrenProps) {
    const [fileContent, setFileContent] = useState<OfxRawTransaction[]>([]);
    const [bankName, setBankName] = useState("SICREDI");

    const fetcher = useFetcher({
        key: "ofx-importer",
    });

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        setSubmissionStatus("idle");
        const file = event.target.files?.[0];

        if (!file) {
            setNotification({
                status: "error",
                message: "Nenhum arquivo selecionado.",
            });
            return
        }

        const fileText = await file.text();

        const [err, result] = OfxParser.getTransactions(fileText);

        if (err) {
            setNotification({
                status: "error",
                message: err.message,
            });
            return;
        }

        if (!result) {
            setNotification({
                status: "error",
                message: "Nenhum arquivo encontrado.",
            });
            return;
        }

        setFileContent(result);
        setNotification({
            status: "success",
            message: `Arquivo lido. ${result.length} transações encontradas.`,
        });

    };

    const submit = () => {
        setSubmissionStatus("loading");

        fetcher.submit({
            data: jsonStringify(fileContent) as string,
            importProfileId: importProfileId,
            description: description,
            bankName: bankName,
            _action: "import-bank-statement",
        }, { method: "post" });
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-8 items-center">
                <Label htmlFor="bankName" className="col-span-1 font-semibold">Banco</Label>
                <Select required onValueChange={setBankName} defaultValue={bankName} >
                    <SelectTrigger className="col-span-4" >
                        <SelectValue placeholder="Selecionar..." />
                    </SelectTrigger>
                    <SelectContent id="bankName" >
                        <SelectGroup >
                            <SelectItem key={'SICREDI'} value={'SICREDI'} >
                                SICREDI
                            </SelectItem>
                            <SelectItem key={'PAGBANK'} value={'PAGBANK'} >
                                PAGBANK
                            </SelectItem>
                            <SelectItem key={'BRADESCO'} value={'BRADESCO'} >
                                BRADESCO
                            </SelectItem>
                        </SelectGroup>
                    </SelectContent>
                </Select>
            </div>
            <FormImporter
                type="ofx"
                handleFileUpload={handleFileUpload} submit={submit} submissionStatus={submisionStatus} />
        </div>

    )
}

interface FormImporterProps {
    type: 'json' | 'ofx'
    submissionStatus: "idle" | "loading" | "success" | "error";
    handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
    submit: () => void;
}

function FormImporter({ type = 'json', handleFileUpload, submit, submissionStatus }: FormImporterProps) {
    return (
        <div className="flex flex-col gap-4">

            <Input type="file" accept={
                type === "json" ? ".json" : ".ofx"
            } onChange={handleFileUpload} />

            <Button onClick={submit}
                className={
                    cn(
                        "w-full",
                        submissionStatus === "loading" && "cursor-wait"
                    )
                }
                disabled={submissionStatus === "loading"}
            >{
                    submissionStatus === "loading" ? "Importando..." : "Importar"
                }</Button>
        </div>
    )
}