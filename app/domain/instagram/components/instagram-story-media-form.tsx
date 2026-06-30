import { Clock3, Copy, Send } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { buildInstagramStorySchedulerScript } from "~/domain/instagram/instagram-story-publication.shared";

type MediaItem = {
  key: string;
  imageUrl: string;
  alt?: string | null;
  label?: string;
};

type Publication = {
  sourceItemKey?: string | null;
  lastPublishStatus?: string | null;
  lastPublishError?: string | null;
  lifecycleStatus?: string | null;
  statusWindow?: {
    expiresAt?: string | Date | null;
    expired?: boolean;
  } | null;
};

function formatDate(value?: string | Date | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR");
}

function formatLifecycle(status?: string | null) {
  if (status === "published") return "Publicado";
  if (status === "expired") return "Expirado";
  if (status === "processing") return "Processando";
  if (status === "error") return "Erro";
  if (status === "inactive") return "Desativado";
  if (status === "ready") return "Pronto para publicar";
  return "Não publicado";
}

export function InstagramStoryMediaForm({
  mediaItems,
  publications,
  selectedKeys,
  publishEndpoint,
  feedback,
  submitting,
  connected,
}: {
  mediaItems: MediaItem[];
  publications: Publication[];
  selectedKeys: string[];
  publishEndpoint: string;
  feedback?: { ok: boolean; message: string } | null;
  submitting?: boolean;
  connected: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const selected = new Set(selectedKeys);
  const byKey = new Map(
    publications
      .filter((publication) => publication.sourceItemKey)
      .map((publication) => [publication.sourceItemKey as string, publication])
  );
  const current = publications.filter(
    (publication) =>
      publication.lastPublishStatus === "success" &&
      Boolean(publication.statusWindow?.expiresAt) &&
      !publication.statusWindow?.expired
  );
  const expiresAt = current
    .map((publication) => publication.statusWindow?.expiresAt)
    .filter(Boolean)
    .sort()
    .at(-1);
  const script = buildInstagramStorySchedulerScript(publishEndpoint);

  async function copyScript() {
    await navigator.clipboard.writeText(script);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="grid min-w-0 gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Stories do Instagram</h2>
          <p className="text-sm text-slate-500">
            Selecione as imagens do destaque que também serão publicadas no
            Instagram.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            type="submit"
            name="_intent"
            value="save"
            variant="outline"
            size="sm"
            disabled={submitting}
          >
            Salvar
          </Button>
          <Button
            type="submit"
            name="_intent"
            value="publish"
            size="sm"
            disabled={submitting || !mediaItems.length || !connected}
          >
            <Send className="mr-2 h-4 w-4" />
            Publicar
          </Button>
        </div>
      </div>

      {!connected ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Conecte e valide a conta em Marketing → Instagram antes de publicar.
        </div>
      ) : null}

      {feedback?.message ? (
        <div
          className={
            feedback.ok
              ? "rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
              : "rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          }
        >
          {feedback.message}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Situação
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-950">
            {current.length
              ? `${current.length} Story(s) vigente(s)`
              : "Sem Story vigente"}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
            <Clock3 className="h-3.5 w-3.5" />
            Visível até
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-950">
            {formatDate(expiresAt)}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {mediaItems.map((item, index) => {
          const publication = byKey.get(item.key);
          return (
            <label
              key={item.key}
              className="grid cursor-pointer gap-3 rounded-lg border border-slate-200 p-3"
            >
              <img
                src={item.imageUrl}
                alt={item.alt || item.label || `Imagem ${index + 1}`}
                className="aspect-[9/16] w-full rounded-md bg-slate-100 object-cover"
              />
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  name="instagramStoryItemKey"
                  value={item.key}
                  defaultChecked={selected.has(item.key)}
                  className="mt-0.5 h-4 w-4"
                />
                <div className="min-w-0 text-sm">
                  <div className="font-medium">
                    {item.label || `Imagem ${index + 1}`}
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatLifecycle(publication?.lifecycleStatus)}
                    {publication?.statusWindow?.expiresAt
                      ? ` · ${
                          publication.statusWindow.expired
                            ? "expirou"
                            : "visível até"
                        } ${formatDate(publication.statusWindow.expiresAt)}`
                      : ""}
                  </div>
                  {publication?.lastPublishError ? (
                    <div className="mt-1 break-words text-xs text-red-600">
                      {publication.lastPublishError}
                    </div>
                  ) : null}
                </div>
              </div>
            </label>
          );
        })}
      </div>

      <div className="grid gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-semibold">Agendamento externo</div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={copyScript}
            className="w-full sm:w-auto"
          >
            <Copy className="mr-2 h-4 w-4" />
            {copied ? "Script copiado" : "Copiar script"}
          </Button>
        </div>
        <code className="block break-all rounded bg-white p-2 text-xs">
          {publishEndpoint}
        </code>
        <pre className="overflow-x-auto rounded bg-slate-950 p-3 text-xs text-slate-100">
          <code>{script}</code>
        </pre>
      </div>
    </div>
  );
}
