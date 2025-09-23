
import { defer } from "@remix-run/node";
import type { ActionFunction, LoaderFunction } from "@remix-run/node";
import { Await, Form, useActionData, useLoaderData } from "@remix-run/react";
import { Suspense, useState } from "react";
import Loading from "~/components/loading/loading";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import prismaClient from "~/lib/prisma/client.server";
import CsvImporter from "~/domain/importer/components/csv-importer";
import { jsonParse } from "~/utils/json-helper";
import { badRequest, ok } from "~/utils/http-response.server";
import ImporterNotificationStatus from "~/domain/importer/components/importer-notification-status";
import { toast } from "~/components/ui/use-toast";
import csvImporter from "~/domain/importer/csv-importer.entity.server";
import tryit from "~/utils/try-it";
import { Alert } from "~/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface TableWithColumns {
  table_name: string;
  column_name: string;
  is_nullable: string;
  data_type: string;
  column_default: string | null;
}

export const loader: LoaderFunction = async () => {
  // Fetch the list of tables from the database that start with "import_"
  const tables = await prismaClient.$queryRaw<
    Array<{ table_name: string }>
  >`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name LIKE 'import_%';
  `;

  // Fetch the columns of the tables that start with "import_"
  const tableListWithColumns = await prismaClient.$queryRaw<
    Array<{ table_name: string }>
  >`
      SELECT
  table_name,
    column_name,
    is_nullable,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name LIKE 'import_%';
  `;

  return defer({ tables, tableListWithColumns });
};

export const action: ActionFunction = async ({ request }) => {
  let formData = await request.formData();
  const { _action, ...values } = Object.fromEntries(formData);

  // console.log({ _action, values });

  const records = jsonParse(values.data as string)
  const importProfileId = values.importProfileId as string
  const destinationTable = values.table as string
  const importMode = values.importMode as "override" | "append"

  console.log({ importMode })

  if (!destinationTable) {
    return badRequest("Selecione a tabela de destino")
  }


  const [err, result] = await tryit(csvImporter.loadMany({
    destinationTable,
    records,
    mode: importMode ?? "override"
  }))

  if (err) {
    return badRequest(err)
  }

  if (!result) {
    return badRequest("Nenhum registro encontrado")
  }

  return ok({ result })
};




export default function AdminImporterCSV() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  const [destinationTable, setDestinationTable] = useState("");

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");


  return (
    <Suspense fallback={<Loading />}>
      <Await resolve={data}>
        {({ tables, tableListWithColumns }: { tables: any, tableListWithColumns: TableWithColumns[] }) => {

          const tableColumns = tableListWithColumns.filter((item) => item.table_name === destinationTable) || [];
          return (
            <>
              <div className="grid grid-cols-8 gap-4 w-full items-center mb-6">
                <div className="flex flex-col gap-1 col-span-2">
                  <Label className="">
                    Selecione a tabela
                  </Label>
                  <span className="text-muted-foreground text-[11px]">Tabelas com prefixo "import_"</span>
                </div>
                <Select required onValueChange={setDestinationTable} >
                  <SelectTrigger className="col-span-4 h-fit" >
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent id="importProfileId">
                    <SelectGroup >
                      {tables.map(({ table_name }: { table_name: string }) => (
                        <SelectItem key={table_name} value={table_name} >
                          <span className="font-semibold font-mono text-sm text-left">{table_name}</span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>



              {
                destinationTable !== "" && (
                  <>

                    <CsvImporter
                      destinationTable={destinationTable}
                      destinationTableColumns={tableColumns.map((item) => item.column_name)}
                      importProfileId="csv-profile"
                      description="Importação de dados via CSV"
                      submisionStatus={status}
                      setSubmissionStatus={setStatus}
                    />
                  </>
                )
              }

            </>
          )


        }}
      </Await >
    </Suspense>
  )
}