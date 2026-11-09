import { useOutletContext } from "@remix-run/react";
import { ExternalLink } from "lucide-react";
import { Button } from "~/components/ui/button";
import AssetLibraryPickerDialog from "~/domain/media/components/asset-library-picker-dialog";
import type { MediaAsset } from "~/domain/media/media.shared";
import type { ContentPostMediaOutletContext } from "~/routes/admin.marketing.publicacoes.$id.midias";

export default function ContentPostInternalMediaPage() {
  const { addMediaUrl, disabled, uploadPath } =
    useOutletContext<ContentPostMediaOutletContext>();

  function addAssetFromLibrary(asset: MediaAsset) {
    const url = asset.url.trim();
    if (!url) return;
    addMediaUrl(url);
  }

  return (
    <section className="grid gap-3 rounded-md border bg-slate-50 p-3 sm:p-4">
      <div className="grid gap-1">
        <h3 className="text-base font-semibold">Mídia interna</h3>
        <p className="text-sm text-slate-500">
          Use o gerenciador para carregar ou selecionar arquivos salvos em{" "}
          <span className="break-all font-medium text-slate-700">
            {uploadPath}
          </span>
          .
        </p>
      </div>

      <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
        <AssetLibraryPickerDialog
          defaultUploadPath={uploadPath}
          disabled={disabled}
          onSelect={addAssetFromLibrary}
          triggerLabel="Escolher asset"
        />
        <Button
          asChild
          type="button"
          variant="outline"
          className="min-h-11 justify-center gap-2 sm:min-h-10"
        >
          <a href="/admin/assets" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" />
            Gerenciar assets
          </a>
        </Button>
      </div>
    </section>
  );
}
