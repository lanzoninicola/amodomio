import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

interface FormImporterProps {
  type: 'json' | 'ofx'
  submissionStatus: "idle" | "loading" | "success" | "error";
  handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  submit: () => void;
}

export default function FormImporter({ type = 'json', handleFileUpload, submit, submissionStatus }: FormImporterProps) {
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