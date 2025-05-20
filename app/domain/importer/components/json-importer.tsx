import { useFetcher } from "@remix-run/react";
import { useState } from "react";
import { jsonParse, jsonStringify } from "~/utils/json-helper";
import FormImporter from "./form-importer";

interface ImporterChildrenProps {
  importProfileId: string;
  description: string;
  setNotification: (notification: { status: "error" | "success" | "idle"; message: string | null }) => void;
  submisionStatus: "idle" | "loading" | "success" | "error";
  setSubmissionStatus: (status: "idle" | "loading" | "success" | "error") => void;
}

export default function JsonImporter({ importProfileId, description, setNotification, submisionStatus, setSubmissionStatus }: ImporterChildrenProps) {
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