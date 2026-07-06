import { useOutletContext } from "@remix-run/react";
import { Link, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import type { ContentPostMediaOutletContext } from "~/routes/admin.marketing.publicacoes.$id.midias";

export default function ContentPostExternalMediaPage() {
  const { addMediaUrl, disabled } =
    useOutletContext<ContentPostMediaOutletContext>();
  const [mediaUrl, setMediaUrl] = useState("");
  const [fullscreenUrl, setFullscreenUrl] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function addExternalMedia() {
    const url = mediaUrl.trim();
    if (!url) {
      setErrorMessage("Informe o link da mídia.");
      return;
    }

    addMediaUrl(url, fullscreenUrl);
    setMediaUrl("");
    setFullscreenUrl("");
    setErrorMessage(null);
  }

  return (
    <section className="grid gap-4 rounded-md border bg-slate-50 p-3 sm:p-4">
      <div className="grid gap-1">
        <h3 className="text-base font-semibold">Link externo</h3>
        <p className="text-sm text-slate-500">
          Cole uma URL pública de imagem ou vídeo para vincular sem enviar ao
          gerenciador.
        </p>
      </div>

      <div className="grid gap-3">
        <div className="grid gap-2">
          <Label htmlFor="externalMediaUrl">Link da mídia</Label>
          <div className="relative">
            <Link className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="externalMediaUrl"
              type="url"
              inputMode="url"
              value={mediaUrl}
              onChange={(event) => setMediaUrl(event.target.value)}
              placeholder="https://..."
              className="min-h-11 pl-9"
              disabled={disabled}
            />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="externalFullscreenUrl">Versão ampliada</Label>
          <Input
            id="externalFullscreenUrl"
            type="url"
            inputMode="url"
            value={fullscreenUrl}
            onChange={(event) => setFullscreenUrl(event.target.value)}
            placeholder="Opcional"
            className="min-h-11"
            disabled={disabled}
          />
        </div>

        {errorMessage ? (
          <p className="text-xs text-red-600">{errorMessage}</p>
        ) : null}

        <Button
          type="button"
          className="min-h-11 w-full gap-2 sm:w-fit"
          disabled={disabled}
          onClick={addExternalMedia}
        >
          <Plus className="h-4 w-4" />
          Adicionar link
        </Button>
      </div>
    </section>
  );
}
