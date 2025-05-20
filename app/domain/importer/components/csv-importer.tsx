import { useFetcher } from "@remix-run/react";
import { useEffect, useState } from "react";
import { parse } from "csv-parse/browser/esm/sync";
import { jsonStringify } from "~/utils/json-helper";
import FormImporter from "./form-importer";
import ImporterNotificationStatus from "./importer-notification-status";

interface ImporterChildrenProps {
  /** The table where the data will be store */
  destinationTable: string;
  /** List of table columns used to validate that the first row of the file matches the table structure.*/
  destinationTableColumns: string[];
  importProfileId: string;
  description: string;
  submisionStatus: "idle" | "loading" | "success" | "error";
  setSubmissionStatus: (status: "idle" | "loading" | "success" | "error") => void;
}

export default function CsvImporter({
  destinationTable,
  destinationTableColumns,
  importProfileId,
  description,
  submisionStatus,
  setSubmissionStatus
}: ImporterChildrenProps) {
  const [csvContent, setCsvContent] = useState<any[]>([]);
  const [table, setTable] = useState("");
  const [notification, setNotification] = useState<{ status: "error" | "success" | "idle"; message: string | null }>({
    status: "idle",
    message: null,
  });

  const fetcher = useFetcher({ key: "csv-importer" });

  useEffect(() => {

    setNotification({
      status: "idle",
      message: 'Aguardando o arquivo CSV...'
    })

    if (fetcher.data) {
      const { status, message } = fetcher.data;
      setSubmissionStatus(status);
      setNotification({ status, message });
    }
  }, [fetcher.data]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setSubmissionStatus("idle");
    setNotification({ status: "idle", message: 'Aguardando o arquivo CSV...' });

    const file = event.target.files?.[0];
    if (!file) {
      setNotification({ status: "error", message: "Nenhum arquivo selecionado." });
      return;
    }

    try {
      const text = await file.text();
      const result = parse(text, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });

      if (result.length === 0) {
        setNotification({ status: "error", message: "Nenhuma linha válida no CSV." });
        return;
      }

      checkFirstRow(result[0]);

      setCsvContent(result);
      setNotification({ status: "success", message: `Arquivo lido. ${result.length} linhas encontradas.` });

    } catch (error: any) {
      setNotification({ status: "error", message: "Erro ao processar o CSV: " + error.message });
    }
  };

  const checkFirstRow = (row: any) => {
    const keys = Object.keys(row);
    const isValid = keys.every((key) => destinationTableColumns.includes(key));
    if (!isValid) {
      throw new Error(
        "A primeira linha do arquivo não corresponde à estrutura da tabela.\n" +
        `\n` +
        `Esperado: ${destinationTableColumns.join(", ")}\n` +
        `\n` +
        `Encontrado: ${keys.join(", ")}`
      );

    }
    return isValid;
  }

  const submit = () => {
    setSubmissionStatus("loading");

    fetcher.submit({
      data: jsonStringify(csvContent),
      importProfileId,
      description,
      table: destinationTable,
      mode: "override",
      _action: "import-csv"
    }, { method: "post" });
  }

  return (
    <div className="flex flex-col gap-4">
      <ImporterNotificationStatus status={notification.status} message={notification.message || ""} />
      <FormImporter
        type="csv"
        handleFileUpload={handleFileUpload}
        submit={submit}
        submissionStatus={submisionStatus}
      />
    </div>
  );
}
