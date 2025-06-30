import { useFetcher } from "@remix-run/react";
import { useState } from "react";
import { OfxParser, OfxRawTransaction } from "../ofx-parser";
import { jsonStringify } from "~/utils/json-helper";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import FormImporter from "./form-importer";

interface ImporterChildrenProps {
  importProfileId: string;
  description: string;
  setNotification: (notification: { status: "error" | "success" | "idle"; message: string | null }) => void;
  submisionStatus: "idle" | "loading" | "success" | "error";
  setSubmissionStatus: (status: "idle" | "loading" | "success" | "error") => void;
}

export default function OfxImporter({ importProfileId, description, setNotification, submisionStatus, setSubmissionStatus }: ImporterChildrenProps) {
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