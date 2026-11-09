import type { ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Upload,
} from "lucide-react";
import { parse } from "csv-parse/browser/esm/sync";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  CRM_CUSTOMER_CSV_HEADERS,
  validateCrmCustomerCsvHeaders,
  type CrmCustomerCsvRow,
} from "~/domain/crm/customer-csv-import";
import { stageCrmCustomerCsvImport } from "~/domain/crm/customer-csv-import.server";

export const meta: MetaFunction = () => [{ title: "CRM - Importar clientes" }];

type ActionData = { error?: string };

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST")
    return json<ActionData>({ error: "Método não permitido" }, { status: 405 });
  try {
    const form = await request.formData();
    const fileName = String(form.get("fileName") || "clientes.csv").slice(
      0,
      255
    );
    const serializedRows = String(form.get("rows") || "");
    const rows = JSON.parse(serializedRows) as CrmCustomerCsvRow[];
    if (!Array.isArray(rows) || rows.length === 0) {
      return json<ActionData>(
        { error: "O arquivo não contém registros" },
        { status: 400 }
      );
    }
    if (rows.length > 10_000) {
      return json<ActionData>(
        { error: "O limite é de 10.000 registros por arquivo" },
        { status: 400 }
      );
    }
    const headers = Object.keys(rows[0] || {});
    const validation = validateCrmCustomerCsvHeaders(headers);
    if (!validation.valid) {
      return json<ActionData>(
        { error: `Colunas ausentes: ${validation.missing.join(", ")}` },
        { status: 400 }
      );
    }
    const sessionId = await stageCrmCustomerCsvImport(rows, fileName);
    return redirect(`/admin/crm/importar/${sessionId}`);
  } catch (error) {
    return json<ActionData>(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível preparar a importação",
      },
      { status: 400 }
    );
  }
}

export default function AdminCrmImportCustomers() {
  const fetcher = useFetcher<ActionData>();
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<CrmCustomerCsvRow[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const isSubmitting = fetcher.state !== "idle";

  async function handleFile(file?: File) {
    setLocalError(null);
    setRows([]);
    setFileName(file?.name || "");
    if (!file) return;
    try {
      const parsed = parse(await file.text(), {
        columns: true,
        delimiter: ";",
        skip_empty_lines: true,
        trim: true,
        bom: true,
      }) as CrmCustomerCsvRow[];
      if (!parsed.length) throw new Error("O CSV está vazio");
      if (parsed.length > 10_000)
        throw new Error("O limite é de 10.000 registros por arquivo");
      const validation = validateCrmCustomerCsvHeaders(Object.keys(parsed[0]));
      if (!validation.valid)
        throw new Error(`Colunas ausentes: ${validation.missing.join(", ")}`);
      setRows(parsed);
    } catch (error) {
      setLocalError(
        error instanceof Error ? error.message : "Não foi possível ler o CSV"
      );
    }
  }

  function prepareReview() {
    fetcher.submit(
      { fileName, rows: JSON.stringify(rows) },
      { method: "post" }
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 pb-10">
      <header className="space-y-2">
        <Badge variant="outline">Etapa 1 de 3</Badge>
        <h2 className="text-2xl font-semibold tracking-tight">
          Importar clientes do ERP
        </h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          O arquivo será analisado e armazenado como rascunho. Nenhum cliente
          será criado ou alterado antes da revisão e confirmação final.
        </p>
      </header>

      {(localError || fetcher.data?.error) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Não foi possível preparar o arquivo</AlertTitle>
          <AlertDescription>
            {localError || fetcher.data?.error}
          </AlertDescription>
        </Alert>
      )}

      <section className="grid gap-4 rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-slate-100 p-2">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold">
              Selecione o CSV exportado pelo CRM atual
            </h3>
            <p className="text-sm text-muted-foreground">
              Separador ponto e vírgula, até 10.000 registros.
            </p>
          </div>
        </div>
        <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 text-center transition hover:bg-slate-100">
          <Upload className="h-6 w-6 text-slate-500" />
          <span className="font-medium">
            {fileName || "Clique para escolher o arquivo"}
          </span>
          <span className="text-xs text-muted-foreground">
            CSV com cabeçalho original do ERP
          </span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            disabled={isSubmitting}
            onChange={(event) => handleFile(event.target.files?.[0])}
          />
        </label>
        {rows.length > 0 && (
          <Alert className="border-emerald-200 bg-emerald-50">
            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
            <AlertTitle>Arquivo reconhecido</AlertTitle>
            <AlertDescription>
              {rows.length.toLocaleString("pt-BR")} registros prontos para
              análise.
            </AlertDescription>
          </Alert>
        )}
      </section>

      <section className="grid gap-4 rounded-xl border p-5">
        <div>
          <h3 className="font-semibold">Como os dados serão tratados</h3>
          <p className="text-sm text-muted-foreground">
            Estas regras serão exibidas novamente antes da aplicação.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Rule
            title="Identidade"
            text="O telefone normalizado será a chave. Um telefone existente nunca cria outro cliente."
          />
          <Rule
            title="Conflitos"
            text="Mesmo telefone com nomes diferentes fica pendente e exige uma decisão manual."
          />
          <Rule
            title="Dados preservados"
            text="Nome e bairro existentes não são sobrescritos. Métricas só avançam com dados mais recentes."
          />
        </div>
        <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          A coluna Aniversário será mantida no histórico do lote, mas não será
          aplicada: o cadastro CRM atual ainda não possui um campo de
          aniversário.
        </div>
      </section>

      <div className="flex justify-end">
        <Button
          size="lg"
          disabled={!rows.length || isSubmitting}
          onClick={prepareReview}
        >
          {isSubmitting ? "Analisando clientes..." : "Analisar e revisar"}
        </Button>
      </div>

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">
          Ver as 14 colunas esperadas
        </summary>
        <p className="mt-2">{CRM_CUSTOMER_CSV_HEADERS.join(" · ")}</p>
      </details>
    </div>
  );
}

function Rule({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border bg-slate-50 p-4">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
