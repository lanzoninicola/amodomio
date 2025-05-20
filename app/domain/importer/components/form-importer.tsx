import { AlertCircle } from "lucide-react";
import { Alert } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

interface FormImporterProps {
  type: 'json' | 'ofx' | 'csv';
  submissionStatus: "idle" | "loading" | "success" | "error";
  handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  submit: () => void;
}

export default function FormImporter({ type = 'json', handleFileUpload, submit, submissionStatus }: FormImporterProps) {

  const acceptedFileTypes = {
    json: ".json",
    ofx: ".ofx",
    csv: ".csv"
  }

  return (
    <div className="flex flex-col gap-4">

      <div className="flex flex-col gap-1">
        <Input type="file" accept={acceptedFileTypes[type]}
          className="w-full" id="file" name="file"
          disabled={submissionStatus === "loading"}
          required={true}
          placeholder="Selecione um arquivo"
          aria-label="Selecione um arquivo"
          aria-describedby="file-description"
          aria-invalid={submissionStatus === "error" ? true : undefined}
          aria-errormessage={submissionStatus === "error" ? "file-error" : undefined}
          onChange={handleFileUpload}
        />
        <div className="flex items-center">
          <AlertCircle size={16} className="mr-2 " color="orange" />
          <span className="text-[12px] text-orange-400">A primeira linha do arquivo precisa conter os nomes das colunas.</span>
        </div>
      </div>

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