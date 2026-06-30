import { Form, useNavigation } from "@remix-run/react";
import {
  ClipboardPaste,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useState, type MouseEventHandler, type ReactNode } from "react";
import CopyButton from "~/components/primitives/copy-button/copy-button";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { cn } from "~/lib/utils";

type GptAssistantPanelProps = {
  title?: string;
  description: string;
  prompt: string;
  defaultPrompt: string;
  onPromptChange: (value: string) => void;
  response: string;
  onResponseChange: (value: string) => void;
  onPreview: () => void;
  previewButtonLabel?: string;
  previewLoadingLabel?: string;
  previewDisabled?: boolean;
  previewLoading?: boolean;
  submitActionName: string;
  submitButtonLabel: string;
  submitLoadingLabel?: string;
  submitDisabled?: boolean;
  onSubmitButtonClick?: MouseEventHandler<HTMLButtonElement>;
  formAction?: string;
  formId?: string;
  hiddenFields?: Array<{ name: string; value: string }>;
  backTo?: string;
  backLabel?: string;
  externalUrl?: string;
  externalLabel?: string;
  flowDescription?: string;
  responsePlaceholder?: string;
  responseHelperText?: ReactNode;
  copyToastTitle?: string;
  copyToastContent?: string;
  assistantChoiceContent?: ReactNode;
  assistantChoiceLabel?: string;
  promptTabLabel?: string;
  promptActionsContent?: ReactNode;
  beforeResponseContent?: ReactNode;
  responseMetaContent?: ReactNode;
  previewActionsContent?: ReactNode;
  afterResponseContent?: ReactNode;
};

export default function GptAssistantPanel(props: GptAssistantPanelProps) {
  const {
    title = "Assistente ChatGPT",
    description,
    prompt,
    defaultPrompt,
    onPromptChange,
    response,
    onResponseChange,
    onPreview,
    previewButtonLabel = "Gerar prévia",
    previewLoadingLabel = "Validando...",
    previewDisabled = false,
    previewLoading = false,
    submitActionName,
    submitButtonLabel,
    submitLoadingLabel = "Processando...",
    submitDisabled = false,
    onSubmitButtonClick,
    formAction = ".",
    formId,
    hiddenFields = [],
    externalUrl,
    externalLabel = "Abrir projeto",
    flowDescription = "1. Revise e copie o prompt. 2. Abra o projeto do ChatGPT. 3. Cole a resposta. 4. Gere a prévia. 5. Confirme a ação.",
    responsePlaceholder = "Cole aqui a resposta do ChatGPT.",
    responseHelperText,
    copyToastTitle = "Prompt copiado",
    copyToastContent = "Cole o prompt no ChatGPT.",
    assistantChoiceContent,
    assistantChoiceLabel,
    promptTabLabel = "Prompt",
    promptActionsContent,
    beforeResponseContent,
    responseMetaContent,
    previewActionsContent,
    afterResponseContent,
  } = props;
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [activeTab, setActiveTab] = useState(
    assistantChoiceContent ? "choice" : "prompt"
  );
  const navigation = useNavigation();
  const isSubmittingImport =
    navigation.state === "submitting" &&
    navigation.formData?.get("_action") === submitActionName;
  const hasResponse = Boolean(response.trim());
  const canPreview = hasResponse && !previewDisabled && !previewLoading;
  const canSubmit = !submitDisabled && !isSubmittingImport;
  const flowSteps = flowDescription
    .split(/\s+\d+\.\s+/)
    .map((step) => step.replace(/^\d+\.\s*/, "").trim())
    .filter(Boolean);
  const handlePasteResponse = async () => {
    if (!navigator?.clipboard?.readText) return;
    const pastedText = await navigator.clipboard.readText();
    if (pastedText) onResponseChange(pastedText);
  };
  const workflowSteps = [
    {
      label: "Prompt",
      status: prompt.trim() ? "Pronto" : "Vazio",
      done: Boolean(prompt.trim()),
    },
    {
      label: "Resposta",
      status: hasResponse ? "Colada" : "Pendente",
      done: hasResponse,
    },
    {
      label: "Validação",
      status: submitDisabled ? "Pendente" : "Validada",
      done: !submitDisabled,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start justify-between w-full">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 text-slate-900">
              <Sparkles size={15} />
              <h2 className="text-base font-semibold">{title}</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
        </div>
      </div>

      <Form
        id={formId}
        method="post"
        action={formAction}
        preventScrollReset
        className="space-y-6"
      >
        {hiddenFields.map((field) => (
          <input
            key={field.name}
            type="hidden"
            name={field.name}
            value={field.value}
          />
        ))}
        <input type="hidden" name="chatGptResponse" value={response} />

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full space-y-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100">
            <TabsList className="h-auto min-w-max justify-start gap-6 rounded-none bg-transparent p-0 text-sm text-slate-400">
              {assistantChoiceContent ? (
                <TabsTrigger
                  value="choice"
                  className="rounded-none border-b-2 border-transparent bg-transparent px-0 pb-3 pt-0 font-medium text-slate-400 shadow-none transition data-[state=active]:border-slate-950 data-[state=active]:bg-transparent data-[state=active]:text-slate-950 data-[state=active]:shadow-none"
                >
                  Modalidade
                  {assistantChoiceLabel ? ` (${assistantChoiceLabel})` : ""}
                </TabsTrigger>
              ) : null}
              <TabsTrigger
                value="prompt"
                className="rounded-none border-b-2 border-transparent bg-transparent px-0 pb-3 pt-0 font-medium text-slate-400 shadow-none transition data-[state=active]:border-slate-950 data-[state=active]:bg-transparent data-[state=active]:text-slate-950 data-[state=active]:shadow-none"
              >
                {promptTabLabel}
              </TabsTrigger>
              <TabsTrigger
                value="preview"
                className="rounded-none border-b-2 border-transparent bg-transparent px-0 pb-3 pt-0 font-medium text-slate-400 shadow-none transition data-[state=active]:border-slate-950 data-[state=active]:bg-transparent data-[state=active]:text-slate-950 data-[state=active]:shadow-none"
              >
                Elaboração da resposta
              </TabsTrigger>
              <TabsTrigger
                value="how-to"
                className="rounded-none border-b-2 border-transparent bg-transparent px-0 pb-3 pt-0 font-medium text-slate-400 shadow-none transition data-[state=active]:border-slate-950 data-[state=active]:bg-transparent data-[state=active]:text-slate-950 data-[state=active]:shadow-none"
              >
                Como usar
              </TabsTrigger>
            </TabsList>
            <div className="flex flex-wrap items-center gap-2 pb-4">
              {workflowSteps.map((step) => (
                <span
                  key={step.label}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-medium",
                    step.done
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                  )}
                >
                  {step.label}: {step.status}
                </span>
              ))}
            </div>
          </div>

          {assistantChoiceContent ? (
            <TabsContent value="choice" className="mt-0">
              {assistantChoiceContent}
            </TabsContent>
          ) : null}

          <TabsContent value="prompt" className="mt-0">
            <section className="space-y-5">
              <div className="pb-1">
                {promptActionsContent ? (
                  <div className="space-y-5">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                      <div className="flex items-start gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                          1
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            Pedir receita
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Copie o modelo para pedir uma receita com a tabela
                            de ingredientes no formato certo.
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
                        {promptActionsContent}
                      </div>
                    </div>

                    <div className="grid gap-4 border-t border-slate-200 pt-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                      <div className="flex items-start gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                          2
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            Gerar composição técnica
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Depois que a receita estiver formatada no ChatGPT,
                            copie este prompt para gerar o JSON importável.
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
                        <CopyButton
                          textToCopy={prompt}
                          label="Copiar prompt"
                          classNameButton="h-9 px-3 hover:bg-slate-700 "
                          classNameLabel="text-sm text-white"
                          classNameIcon="text-white"
                          toastTitle={copyToastTitle}
                          toastContent={copyToastContent}
                        />
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              className="flex h-9 gap-x-2 px-2 text-slate-600"
                            >
                              <Eye size={16} />
                              Visualizar prompt
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-3xl">
                            <DialogHeader>
                              <DialogTitle>
                                Prompt para gerar composição técnica
                              </DialogTitle>
                              <DialogDescription>
                                Use este prompt depois que a receita estiver
                                formatada no ChatGPT.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs text-slate-500">
                                O prompt pode ser editado manualmente antes da
                                cópia.
                              </p>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-xs text-slate-600"
                                onClick={() => onPromptChange(defaultPrompt)}
                              >
                                Restaurar padrão
                              </Button>
                            </div>
                            <textarea
                              value={prompt}
                              onChange={(event) =>
                                onPromptChange(event.target.value)
                              }
                              className="min-h-[420px] w-full rounded-md border-0 bg-slate-50 px-3 py-3 font-mono text-[12px] leading-5 text-slate-800 outline-none ring-1 ring-slate-200 transition-shadow focus:ring-slate-500"
                            />
                          </DialogContent>
                        </Dialog>
                        {externalUrl ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            asChild
                          >
                            <a
                              href={externalUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-x-2"
                            >
                              {externalLabel}
                              <ExternalLink size={13} />
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <CopyButton
                        textToCopy={prompt}
                        label="Copiar prompt"
                        classNameButton="h-9 px-3 hover:bg-slate-700 "
                        classNameLabel="text-sm text-white"
                        classNameIcon="text-white"
                        toastTitle={copyToastTitle}
                        toastContent={copyToastContent}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="flex h-9 gap-x-2 px-2 text-slate-600"
                        onClick={() =>
                          setShowPromptEditor((current) => !current)
                        }
                      >
                        {showPromptEditor ? (
                          <>
                            <EyeOff size={16} />
                            Esconder prompt
                          </>
                        ) : (
                          <>
                            <Eye size={16} />
                            Visualizar prompt
                          </>
                        )}
                      </Button>
                    </div>
                    {externalUrl ? (
                      <Button type="button" variant="outline" size="sm" asChild>
                        <a
                          href={externalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-x-2"
                        >
                          {externalLabel}
                          <ExternalLink size={13} />
                        </a>
                      </Button>
                    ) : null}
                  </div>
                )}
              </div>
              {!promptActionsContent ? (
                <div className="space-y-4">
                  {showPromptEditor ? (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-slate-500">
                          O prompt pode ser editado manualmente antes da cópia.
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs text-slate-600"
                          onClick={() => onPromptChange(defaultPrompt)}
                        >
                          Restaurar padrão
                        </Button>
                      </div>
                      <textarea
                        value={prompt}
                        onChange={(event) => onPromptChange(event.target.value)}
                        className="min-h-[420px] w-full rounded-md border-0 bg-slate-50 px-3 py-3 font-mono text-[12px] leading-5 text-slate-800 outline-none ring-1 ring-slate-200 transition-shadow focus:ring-slate-500"
                      />
                    </>
                  ) : (
                    <div className="border-l-2 border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      Prompt gerado e pronto para copiar. Abra a visualização
                      apenas se precisar revisar ou editar o conteúdo.
                    </div>
                  )}
                </div>
              ) : null}
            </section>
          </TabsContent>

          <TabsContent value="preview" className="mt-0">
            <div className="space-y-6">
              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                      1
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Colar resposta
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Cole ou ajuste o JSON retornado pelo ChatGPT.
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex gap-x-2"
                    onClick={handlePasteResponse}
                  >
                    <ClipboardPaste size={14} />
                    Colar resposta
                  </Button>
                </div>
                <textarea
                  value={response}
                  onChange={(event) => onResponseChange(event.target.value)}
                  placeholder={responsePlaceholder}
                  className="min-h-[320px] w-full rounded-md border-0 bg-slate-50 px-3 py-3 font-mono text-[12px] leading-5 text-slate-700 outline-none ring-1 ring-slate-200 transition-shadow focus:ring-slate-500"
                />
                <div className="text-xs text-slate-500">
                  {hasResponse
                    ? "Resposta colada. Gere a prévia antes de importar."
                    : "Cole a resposta retornada pelo ChatGPT para liberar a prévia."}
                </div>
                {responseHelperText ? (
                  <details className="text-xs text-slate-500">
                    <summary className="cursor-pointer font-medium text-slate-600">
                      Visualizar detalhes da importação
                    </summary>
                    <div className="mt-2">{responseHelperText}</div>
                  </details>
                ) : null}
              </section>

              {beforeResponseContent}

              <section className="space-y-3 border-t border-slate-200 pt-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                      2
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Prévia
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {hasResponse
                          ? "Valide o JSON e revise o resultado antes de importar."
                          : "Cole a resposta antes de gerar a prévia."}
                      </p>
                      <span
                        className={cn(
                          "mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium",
                          canSubmit
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        )}
                      >
                        {canSubmit
                          ? "Prévia validada"
                          : "Aguardando validação da prévia"}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onPreview}
                      disabled={!canPreview}
                    >
                      {previewLoading ? (
                        previewLoadingLabel
                      ) : (
                        <span className="flex items-center gap-2">
                          <Eye size={14} />
                          {previewButtonLabel}
                        </span>
                      )}
                    </Button>
                    {previewActionsContent}
                  </div>
                </div>
              </section>

              <section className="space-y-3 border-t border-slate-200 pt-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                      3
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Importar composição
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {canSubmit
                          ? "A prévia está validada e a importação está liberada."
                          : "A importação fica bloqueada até validar a prévia."}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    name="_action"
                    value={submitActionName}
                    size="sm"
                    disabled={submitDisabled || isSubmittingImport}
                    onClick={onSubmitButtonClick}
                  >
                    {isSubmittingImport ? (
                      <span className="flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin" />
                        {submitLoadingLabel}
                      </span>
                    ) : (
                      submitButtonLabel
                    )}
                  </Button>
                </div>
              </section>

              {responseMetaContent}
              {afterResponseContent}
            </div>
          </TabsContent>

          <TabsContent value="how-to" className="mt-0">
            <section className="space-y-4">
              <div className="border-l-2 border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Sequência sugerida para usar o assistente sem importar uma
                resposta ainda não validada.
              </div>
              {flowSteps.length > 0 ? (
                <ol className="space-y-3 text-sm text-slate-700">
                  {flowSteps.map((step, index) => (
                    <li key={`${step}-${index}`} className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                        {index + 1}
                      </span>
                      <span className="pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-slate-700">{flowDescription}</p>
              )}
            </section>
          </TabsContent>
        </Tabs>
      </Form>
    </div>
  );
}
