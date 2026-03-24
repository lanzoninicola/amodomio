import type { ActionFunctionArgs } from '@remix-run/node';
import { redirect } from '@remix-run/node';
import { Form, useActionData } from '@remix-run/react';
import { CircleHelp, FileJson, FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { authenticator } from '~/domain/auth/google.server';
import { createStockMovementImportBatchFromFile } from '~/domain/stock-movement/stock-movement-import.server';
import { badRequest, serverError } from '~/utils/http-response.server';
import { cn } from '~/lib/utils';

function str(value: FormDataEntryValue | null) {
  return String(value || '').trim();
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const user = await authenticator.isAuthenticated(request);
    const actor = (user as any)?.email || (user as any)?.displayName || (user as any)?.name || null;

    const formData = await request.formData();
    const batchName = str(formData.get('batchName'));
    const file = formData.get('file');
    const supplierNotesFile = formData.get('supplierNotesFile');

    if (!(file instanceof File)) return badRequest('Selecione um arquivo .xlsx');
    if (!file.name.toLowerCase().endsWith('.xlsx')) return badRequest('Arquivo inválido. Envie .xlsx');
    if (supplierNotesFile instanceof File && supplierNotesFile.size > 0 && !supplierNotesFile.name.toLowerCase().endsWith('.json')) {
      return badRequest('Arquivo auxiliar inválido. Envie um .json com as notas do período');
    }

    const result = await createStockMovementImportBatchFromFile({
      fileName: file.name,
      fileBuffer: Buffer.from(await file.arrayBuffer()),
      batchName,
      uploadedBy: actor,
      supplierNotesFileName: supplierNotesFile instanceof File && supplierNotesFile.size > 0 ? supplierNotesFile.name : null,
      supplierNotesFileBuffer:
        supplierNotesFile instanceof File && supplierNotesFile.size > 0
          ? Buffer.from(await supplierNotesFile.arrayBuffer())
          : null,
    });

    return redirect(`/admin/import-stock-movements/${result.batchId}`);
  } catch (error) {
    return serverError(error);
  }
}

type GuideModalProps = {
  title: string;
  description: string;
  steps: string[];
};

function GuideModal({ title, description, steps }: GuideModalProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex size-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
          aria-label={`Abrir guia ${title}`}
        >
          <CircleHelp size={15} />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl bg-white">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <ol className="space-y-3 text-sm leading-6 text-slate-700">
          {steps.map((step, index) => (
            <li key={step} className="flex gap-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}

type UploadCardProps = {
  id: string;
  name: string;
  title: string;
  description: string;
  guideTitle: string;
  guideDescription: string;
  guideSteps: string[];
  accept: string;
  required?: boolean;
  selectedFileName: string;
  onFileChange: (fileName: string) => void;
  icon: 'xls' | 'json';
  quickLinkLabel: string;
  quickLinkHref: string;
};

function UploadCard({
  id,
  name,
  title,
  description,
  guideTitle,
  guideDescription,
  guideSteps,
  accept,
  required = false,
  selectedFileName,
  onFileChange,
  icon,
  quickLinkLabel,
  quickLinkHref,
}: UploadCardProps) {
  const hasSelection = selectedFileName.length > 0;
  const isReady = required ? hasSelection : true;
  const Icon = icon === 'xls' ? FileSpreadsheet : FileJson;

  return (
    <Card
      className={cn(
        'border-2 shadow-none transition-colors',
        isReady ? 'border-emerald-300 bg-emerald-50/70' : 'border-red-300 bg-red-50/70'
      )}
    >
      <CardHeader className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'flex size-11 shrink-0 items-center justify-center rounded-xl',
                isReady ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
              )}
            >
              <Icon size={20} />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-base text-slate-950">{title}</CardTitle>
              <CardDescription className="text-sm text-slate-600">{description}</CardDescription>
            </div>
          </div>
          <GuideModal title={guideTitle} description={guideDescription} steps={guideSteps} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <a
          href={quickLinkHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex text-sm font-medium text-slate-700 underline underline-offset-2 hover:text-slate-950"
        >
          {quickLinkLabel}
        </a>
        <div className="space-y-2">
          <Label htmlFor={id}>Selecionar arquivo</Label>
          <Input
            id={id}
            name={name}
            type="file"
            accept={accept}
            required={required}
            onChange={(event) => onFileChange(event.currentTarget.files?.[0]?.name ?? '')}
          />
        </div>
        <div className={cn('text-sm font-medium', isReady ? 'text-emerald-700' : 'text-red-700')}>
          {hasSelection
            ? `Arquivo selecionado: ${selectedFileName}`
            : required
              ? 'Aguardando seleção do arquivo'
              : 'Opcional: anexe o JSON agora ou concilie depois no lote'}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminImportStockMovementsNewRoute() {
  const actionData = useActionData<typeof action>();
  const [xlsxFileName, setXlsxFileName] = useState('');
  const [jsonFileName, setJsonFileName] = useState('');

  return (
    <div className="flex flex-col gap-4 p-4">
      {actionData?.message ? (
        <div className={`rounded-lg border px-3 py-2 text-sm ${actionData.status >= 400 ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>
          {actionData.message}
        </div>
      ) : null}

      <Form method="post" encType="multipart/form-data" className="space-y-6 bg-white">
        <div className="grid gap-4 lg:grid-cols-2">
          <UploadCard
            id="file"
            name="file"
            title="Importar XLS"
            description="Arquivo de movimentação exportado do Saipos para entrada de estoque por documento."
            guideTitle="Guia XLS"
            guideDescription="Fluxo para exportar o XLS correto no Saipos."
            guideSteps={[
              'Abrir Saipos em Movimentação do estoque no link https://conta.saipos.com/#/app/store/stock-management.',
              'Selecionar as datas no filtro de até.',
              'No filtro Movimentação selecionar a entrada de estoque desejada.',
              'Clicar no botão "Buscar".',
              'Clicar no botão "Exportar".',
            ]}
            accept=".xlsx"
            required
            selectedFileName={xlsxFileName}
            onFileChange={setXlsxFileName}
            icon="xls"
            quickLinkLabel="Movimentacao estoque (SAIPOS)"
            quickLinkHref="https://conta.saipos.com/#/app/store/stock-management"
          />
          <UploadCard
            id="supplierNotesFile"
            name="supplierNotesFile"
            title="Importar JSON"
            description="JSON opcional dos documentos do período para conciliar fornecedor e CNPJ por documento fiscal."
            guideTitle="Guia JSON"
            guideDescription="Fluxo para extrair o JSON das notas de entrada no Saipos."
            guideSteps={[
              'Abrir Saipos no link https://conta.saipos.com/#/app/store/provider-nfe em Notas de entrada.',
              'Selecionar o filtro "Data de Entrada".',
              'Selecionar as datas no filtro de até.',
              'No filtro Tipo de entrada selecionar "Entradas de compra".',
              'Clicar em "Buscar".',
              'Selecionar a extensão do navegador "SAIPOS Provider-nfe".',
              'Clicar em "Extrair dados da tabela".',
              'Clicar no botão "Baixar JSON".',
            ]}
            accept=".json,application/json"
            selectedFileName={jsonFileName}
            onFileChange={setJsonFileName}
            icon="json"
            quickLinkLabel="Notas de entrada (SAIPOS)"
            quickLinkHref="https://conta.saipos.com/#/app/store/provider-nfe"
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-end">
          <div>
            <Label htmlFor="batchName">Nome do lote</Label>
            <Input id="batchName" name="batchName" placeholder="ex: Entradas SAIPOS Fev/2026 - Semana 1" />
          </div>
          <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-700">
            Criar lote
          </Button>
        </div>
      </Form>
    </div>
  );
}
