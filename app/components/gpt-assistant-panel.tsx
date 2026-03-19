import { Form, Link } from "@remix-run/react";
import { ExternalLink, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import CopyButton from "~/components/primitives/copy-button/copy-button";
import { Button } from "~/components/ui/button";

type GptAssistantPanelProps = {
    title?: string
    description: string
    prompt: string
    defaultPrompt: string
    onPromptChange: (value: string) => void
    response: string
    onResponseChange: (value: string) => void
    onPreview: () => void
    previewButtonLabel?: string
    previewLoadingLabel?: string
    previewDisabled?: boolean
    previewLoading?: boolean
    submitActionName: string
    submitButtonLabel: string
    submitDisabled?: boolean
    formAction?: string
    hiddenFields?: Array<{ name: string; value: string }>
    backTo?: string
    backLabel?: string
    externalUrl?: string
    externalLabel?: string
    flowDescription?: string
    responsePlaceholder?: string
    responseHelperText?: ReactNode
    copyToastTitle?: string
    copyToastContent?: string
    beforeResponseContent?: ReactNode
    responseMetaContent?: ReactNode
    afterResponseContent?: ReactNode
}

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
        submitDisabled = false,
        formAction = ".",
        hiddenFields = [],
        backTo,
        backLabel,
        externalUrl,
        externalLabel = "Abrir projeto",
        flowDescription = "1. Revise e copie o prompt. 2. Abra o projeto do ChatGPT. 3. Cole a resposta. 4. Gere a pré-visualização. 5. Confirme a ação.",
        responsePlaceholder = "Cole aqui a resposta do ChatGPT.",
        responseHelperText,
        copyToastTitle = "Prompt copiado",
        copyToastContent = "Cole o prompt no ChatGPT.",
        beforeResponseContent,
        responseMetaContent,
        afterResponseContent,
    } = props

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2 text-slate-900">
                        <Sparkles size={15} />
                        <h2 className="text-base font-semibold">{title}</h2>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{description}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {backTo && backLabel ? (
                        <Button type="button" variant="outline" size="sm" asChild>
                            <Link to={backTo}>{backLabel}</Link>
                        </Button>
                    ) : null}
                    {externalUrl ? (
                        <Button type="button" variant="outline" size="sm" asChild>
                            <a href={externalUrl} target="_blank" rel="noreferrer">
                                {externalLabel}
                                <ExternalLink size={13} />
                            </a>
                        </Button>
                    ) : null}
                    <CopyButton
                        textToCopy={prompt}
                        label="Copiar prompt"
                        variant="outline"
                        classNameButton="h-9 px-3 hover:bg-white"
                        classNameLabel="text-sm"
                        classNameIcon="text-slate-700"
                        toastTitle={copyToastTitle}
                        toastContent={copyToastContent}
                    />
                </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fluxo</p>
                <p className="mt-1">{flowDescription}</p>
            </div>

            <Form method="post" action={formAction} preventScrollReset className="space-y-4">
                {hiddenFields.map((field) => (
                    <input key={field.name} type="hidden" name={field.name} value={field.value} />
                ))}

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <section className="rounded-lg border border-slate-200">
                        <div className="border-b border-slate-200 px-4 py-3">
                            <p className="text-sm font-semibold text-slate-900">Prompt</p>
                            <p className="text-xs text-slate-500">Revise, ajuste e copie o prompt antes de abrir o ChatGPT.</p>
                        </div>
                        <div className="space-y-3 px-4 py-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-xs text-slate-500">O prompt pode ser editado manualmente antes da cópia.</p>
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
                                className="min-h-[560px] w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-3 font-mono text-[12px] leading-5 text-slate-800 outline-none transition-colors focus:border-slate-500"
                            />
                        </div>
                    </section>

                    <section className="space-y-4">
                        {beforeResponseContent}

                        <div className="rounded-lg border border-slate-200">
                            <div className="border-b border-slate-200 px-4 py-3">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">Resposta do ChatGPT</p>
                                        <p className="text-xs text-slate-500">Cole aqui a resposta retornada pelo assistente.</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={onPreview}
                                            disabled={previewDisabled || previewLoading}
                                        >
                                            {previewLoading ? previewLoadingLabel : previewButtonLabel}
                                        </Button>
                                        <Button
                                            type="submit"
                                            name="_action"
                                            value={submitActionName}
                                            size="sm"
                                            disabled={submitDisabled}
                                        >
                                            {submitButtonLabel}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-3 px-4 py-4">
                                <textarea
                                    name="chatGptResponse"
                                    value={response}
                                    onChange={(event) => onResponseChange(event.target.value)}
                                    placeholder={responsePlaceholder}
                                    className="min-h-[360px] w-full rounded-md border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition-colors focus:border-slate-400"
                                />
                                {responseHelperText ? (
                                    <div className="text-xs text-slate-500">{responseHelperText}</div>
                                ) : null}
                            </div>
                        </div>

                        {responseMetaContent}
                        {afterResponseContent}
                    </section>
                </div>
            </Form>
        </div>
    )
}
