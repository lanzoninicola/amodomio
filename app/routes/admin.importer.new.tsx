import { ImportProfile } from "@prisma/client";
import { LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, useActionData, useLoaderData } from "@remix-run/react";
import { useState } from "react";
import { toast } from "~/components/ui/use-toast";
import { bankTransactionImporterEntity } from "~/domain/importer/bank-transaction-importer.entity.server";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok } from "~/utils/http-response.server";
import { jsonParse } from "~/utils/json-helper";
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

  const linkTo = (importProfile: ImportProfile) => {
    if (importProfile?.type === "ofx") {
      return `/admin/importer/new/ofx/${importProfile.id}`
    }
    if (importProfile?.type === "json") {
      return `/admin/importer/new/json/${importProfile.id}`
    }
    if (importProfile?.type === "csv") {
      return `/admin/importer/new/csv`
    }
    return "/admin/importer"
  }


  return (

    <div className="flex flex-col gap-4 mb-6">

      <span className="col-span-2">
        Selecione o perfil:
      </span>
      <ul>
        {importProfiles.map((importProfile) => (
          <li key={importProfile.id} value={importProfile.id} className="mb-2" >
            <Link to={linkTo(importProfile)} className="grid grid-cols-6 hover:bg-slate-50">
              <span className="font-semibold text-sm text-left col-span-1">{importProfile.type}</span>
              <div className="flex flex-col col-span-5">
                <span className="font-semibold text-sm text-left">{importProfile.name}</span>
                <span className="text-xs text-muted-foreground font-mono  text-left">{importProfile.description}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <Outlet />
    </div>




  )
}







