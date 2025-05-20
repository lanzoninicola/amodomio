import { LoaderFunctionArgs } from "@remix-run/node";

import { ok } from "assert";
import { bankTransactionImporterEntity } from "~/domain/importer/bank-transaction-importer.entity.server";
import ImporterNotificationStatus from "~/domain/importer/components/importer-notification-status";
import OfxImporter from "~/domain/importer/components/ofx-importer";

import prismaClient from "~/lib/prisma/client.server";
import { badRequest } from "~/utils/http-response.server";
import { jsonParse } from "~/utils/json-helper";
import tryit from "~/utils/try-it";

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

export default function AdminImporterOFXSingle() {

  return (
    <div className="flex flex-col rounded-md border p-4 gap-6" >
      <ImporterNotificationStatus status={notification.status} message={notification.message} />
      <OfxImporter
        importProfileId={importProfileId}
        description={description}
        setNotification={setNotification} submisionStatus={submissionStatus} setSubmissionStatus={setSubmissionStatus} />
    </div>
  )

}