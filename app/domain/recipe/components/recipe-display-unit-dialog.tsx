import { useEffect } from "react";
import { useFetcher } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

export type DisplayUnitPrompt = {
  ingredientId: string;
  name: string;
  unit: string;
};

export function RecipeDisplayUnitDialog({
  prompt,
  recipeName,
  action,
  onClose,
}: {
  prompt: DisplayUnitPrompt;
  recipeName: string;
  action: string;
  onClose: () => void;
}) {
  const unitFetcher = useFetcher<{
    error?: string;
    savedDisplayUnit?: string;
    ingredientId?: string;
  }>();
  const savingUnit = unitFetcher.state !== "idle";
  useEffect(() => {
    if (
      unitFetcher.state === "idle" &&
      unitFetcher.data?.savedDisplayUnit === prompt.unit &&
      unitFetcher.data.ingredientId === prompt.ingredientId
    )
      onClose();
  }, [
    unitFetcher.state,
    unitFetcher.data,
    prompt.unit,
    prompt.ingredientId,
    onClose,
  ]);
  return (
    <Dialog
      open={true}
      onOpenChange={(open) => {
        if (!open && !savingUnit) onClose();
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-md gap-6 overflow-y-auto rounded-2xl border-slate-200 p-6 shadow-xl">
        <DialogHeader className="space-y-2 pr-5 text-left sm:text-left">
          <DialogTitle className="text-xl font-semibold tracking-tight text-slate-950">
            Salvar unidade de consumo?
          </DialogTitle>
          <DialogDescription className="text-sm leading-6 text-slate-600">
            Use esta unidade nas próximas visualizações da receita e de seus
            templates.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500">Ingrediente</p>
              <p className="mt-1 break-words text-base font-semibold leading-6 text-slate-900">
                {prompt.name}
              </p>
            </div>
            <span className="inline-flex h-11 min-w-[48px] shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-base font-bold text-slate-950">
              {prompt.unit}
            </span>
          </div>
          <div className="border-t border-slate-200 pt-3">
            <p className="text-xs font-medium text-slate-500">Receita</p>
            <p className="mt-1 text-sm font-medium leading-5 text-slate-700">
              {recipeName}
            </p>
          </div>
        </div>
        <unitFetcher.Form method="post" action={action} className="space-y-4">
          <input type="hidden" name="intent" value="save-display-unit" />
          <input
            type="hidden"
            name="ingredientId"
            value={prompt.ingredientId || ""}
          />
          <input type="hidden" name="unit" value={prompt.unit || ""} />
          {unitFetcher.data && "error" in unitFetcher.data ? (
            <p role="alert" className="mb-3 text-sm text-red-600">
              {unitFetcher.data.error}
            </p>
          ) : null}
          <DialogFooter className="flex-col gap-3 sm:flex-col sm:space-x-0">
            <Button
              type="submit"
              disabled={savingUnit}
              className="h-[52px] w-full rounded-xl text-sm font-semibold"
            >
              {savingUnit ? "Salvando…" : "Salvar preferência"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={savingUnit}
              onClick={() => onClose()}
              className="h-[48px] w-full rounded-xl border-slate-300 text-sm font-medium text-slate-700"
            >
              Só agora
            </Button>
          </DialogFooter>
        </unitFetcher.Form>
      </DialogContent>
    </Dialog>
  );
}
