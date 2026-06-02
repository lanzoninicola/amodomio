import { Form, Link, useNavigation } from "@remix-run/react";
import {
    ClipboardPaste,
    ExternalLink,
    Eye,
    EyeOff,
    Loader2,
    Sparkles,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import CopyButton from "~/components/primitives/copy-button/copy-button";
import { Button } from "~/components/ui/button";
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
    formAction?: string;
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
        previewButtonLabel = "Pré-visualizar",
        previewLoadingLabel = "Validando...",
        previewDisabled = false,
        previewLoading = false,
        submitActionName,
        submitButtonLabel,
        submitLoadingLabel = "Processando...",
        submitDisabled = false,
        formAction = ".",
        hiddenFields = [],
        backTo,
        backLabel,
        externalUrl,
        externalLabel = "Abrir projeto",
        flowDescription = "1. Revise e copie o prompt. 2. Abra o projeto do ChatGPT. 3. Cole a resposta. 4. Gere a prévia. 5. Confirme a ação.",
        responsePlaceholder = "Cole aqui a resposta do ChatGPT.",
        responseHelperText,
        copyToastTitle = "Prompt copiado",
        copyToastContent = "Cole o prompt no ChatGPT.",
        beforeResponseContent,
        responseMetaContent,
        previewActionsContent,
        afterResponseContent,
    } = props;
    const [showPromptEditor, setShowPromptEditor] = useState(false);
    const [activeTab, setActiveTab] = useState("prompt");
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
        { label: "Prompt", status: prompt.trim() ? "Pronto" : "Vazio", done: Boolean(prompt.trim()) },
        { label: "Resposta", status: hasResponse ? "Colada" : "Pendente", done: hasResponse },
        { label: "Prévia", status: submitDisabled ? "Pendente" : "Validada", done: !submitDisabled },
    ];

    return (
        <div className="mx-auto max-w-6xl space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start justify-between w-full">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2 text-slate-900">
                            <Sparkles size={15} />
                            <h2 className="text-base font-semibold">{title}</h2>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">{description}</p>
                    </div>
                    {backTo && backLabel ? (
                        <Button type="button" variant="outline" size="sm" asChild>
                            <Link to={backTo}>
                                <span className="text-xs uppercase tracking-wider">
                                    {backLabel}
                                </span>
                            </Link>
                        </Button>
                    ) : null}
                </div>
            </div>

            <Form
                method="post"
                action={formAction}
                preventScrollReset
                className="space-y-4"
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

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100">
                        <TabsList className="h-auto min-w-max justify-start gap-6 rounded-none bg-transparent p-0 text-sm text-slate-400">
                            <TabsTrigger
                                value="prompt"
                                className="rounded-none border-b-2 border-transparent bg-transparent px-0 pb-3 pt-0 font-medium text-slate-400 shadow-none transition data-[state=active]:border-slate-950 data-[state=active]:bg-transparent data-[state=active]:text-slate-950 data-[state=active]:shadow-none"
                            >
                                Prompt
                            </TabsTrigger>
                            <TabsTrigger
                                value="response"
                                className="rounded-none border-b-2 border-transparent bg-transparent px-0 pb-3 pt-0 font-medium text-slate-400 shadow-none transition data-[state=active]:border-slate-950 data-[state=active]:bg-transparent data-[state=active]:text-slate-950 data-[state=active]:shadow-none"
                            >
                                Resposta
                            </TabsTrigger>
                            <TabsTrigger
                                value="preview"
                                className="rounded-none border-b-2 border-transparent bg-transparent px-0 pb-3 pt-0 font-medium text-slate-400 shadow-none transition data-[state=active]:border-slate-950 data-[state=active]:bg-transparent data-[state=active]:text-slate-950 data-[state=active]:shadow-none"
                            >
                                Prévia
                            </TabsTrigger>
                            <TabsTrigger
                                value="how-to"
                                className="rounded-none border-b-2 border-transparent bg-transparent px-0 pb-3 pt-0 font-medium text-slate-400 shadow-none transition data-[state=active]:border-slate-950 data-[state=active]:bg-transparent data-[state=active]:text-slate-950 data-[state=active]:shadow-none"
                            >
                                Como usar
                            </TabsTrigger>
                        </TabsList>
                        <div className="flex flex-wrap items-center gap-2 pb-3">
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

                    <TabsContent value="prompt" className="mt-0">
                        <section className="space-y-4">
                            <div className="pb-3">
                                <div className="flex flex-wrap items-center justify-between gap-3">
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
                                            className="h-9 px-2 text-slate-600 flex gap-x-2"
                                            onClick={() => setShowPromptEditor((current) => !current)}
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
                            </div>
                            <div className="space-y-3">
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
                        </section>
                    </TabsContent>

                    <TabsContent value="response" className="mt-0 space-y-4">
                        <div className="space-y-4">
                            <div className="pb-3">
                                <div className="flex flex-wrap items-center justify-between gap-3">
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
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={!hasResponse}
                                        onClick={() => setActiveTab("preview")}
                                    >
                                        Ir para prévia
                                    </Button>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <textarea
                                    value={response}
                                    onChange={(event) => onResponseChange(event.target.value)}
                                    placeholder={responsePlaceholder}
                                    className="min-h-[320px] w-full rounded-md border-0 bg-slate-50 px-3 py-3 font-mono text-[12px] leading-5 text-slate-700 outline-none ring-1 ring-slate-200 transition-shadow focus:ring-slate-500"
                                />
                                <div className="text-xs text-slate-500">
                                    {hasResponse
                                        ? "Resposta colada. Valide na aba Prévia antes de importar."
                                        : "Cole a resposta retornada pelo ChatGPT para liberar a prévia."}
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="preview" className="mt-0 space-y-4">
                        {beforeResponseContent}

                        <div className="space-y-4">
                            <div className="space-y-3 pb-3">
                                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                                    <span>
                                        {hasResponse
                                            ? "Gere a prévia para liberar a importação."
                                            : "Cole a resposta na aba Resposta antes de gerar a prévia."}
                                    </span>
                                    <span
                                        className={cn(
                                            "font-medium",
                                            canSubmit ? "text-emerald-700" : "text-slate-500"
                                        )}
                                    >
                                        {canSubmit
                                            ? "Importação liberada"
                                            : "Importação bloqueada até validar a prévia"}
                                    </span>
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={onPreview}
                                            disabled={!canPreview}
                                        >
                                            {previewLoading ? previewLoadingLabel : previewButtonLabel}
                                        </Button>
                                        {previewActionsContent}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Button
                                            type="submit"
                                            name="_action"
                                            value={submitActionName}
                                            size="sm"
                                            disabled={submitDisabled || isSubmittingImport}
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
                                </div>
                            </div>
                            <div className="space-y-3">
                                {responseHelperText ? (
                                    <details className="text-xs text-slate-500">
                                        <summary className="cursor-pointer font-medium text-slate-600">
                                            Visualizar detalhes da importação
                                        </summary>
                                        <div className="mt-2">{responseHelperText}</div>
                                    </details>
                                ) : null}
                            </div>
                        </div>

                        {responseMetaContent}
                        {afterResponseContent}
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
