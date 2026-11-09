import { useEffect } from "react";
import { useFetcher } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";

export function DeleteRecipeTemplateDialog({
  template,
  recipeName,
  action,
  onClose,
  onDeleted,
}: {
  template: { id: string; name: string } | null;
  recipeName: string;
  action: string;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const fetcher = useFetcher<{ error?: string; deletedTemplateId?: string }>();
  const deleting = fetcher.state !== "idle";
  useEffect(() => {
    if (
      fetcher.state === "idle" &&
      fetcher.data?.deletedTemplateId &&
      fetcher.data.deletedTemplateId === template?.id
    ) {
      onClose();
      onDeleted?.();
    }
  }, [fetcher.state, fetcher.data, template?.id, onClose, onDeleted]);

  return (
    <AlertDialog
      open={!!template}
      onOpenChange={(open) => {
        if (!open && !deleting) onClose();
      }}
    >
      <AlertDialogContent className="w-[calc(100vw-2rem)] rounded-xl">
        <AlertDialogHeader>
          <AlertDialogTitle>
            Excluir template “{template?.name}”?
          </AlertDialogTitle>
          <AlertDialogDescription>
            O template “{template?.name}” da receita “{recipeName}” será
            excluído permanentemente. A receita original será mantida.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <fetcher.Form method="post" action={action}>
          <input type="hidden" name="intent" value="delete-template" />
          <input type="hidden" name="templateId" value={template?.id || ""} />
          {fetcher.data?.error ? (
            <p role="alert" className="mb-3 text-sm text-red-600">
              {fetcher.data.error}
            </p>
          ) : null}
          <AlertDialogFooter className="gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={deleting}
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={deleting || !template}
            >
              {deleting ? "Excluindo…" : "Excluir template"}
            </Button>
          </AlertDialogFooter>
        </fetcher.Form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
