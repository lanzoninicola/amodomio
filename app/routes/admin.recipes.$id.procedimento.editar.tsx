import { Form, useOutletContext } from "@remix-run/react";
import { SaveIcon } from "lucide-react";
import { DecimalInput } from "~/components/inputs/inputs";
import { Button } from "~/components/ui/button";
import Fieldset from "~/components/ui/fieldset";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import type { AdminRecipeOutletContext } from "./admin.recipes.$id";
export { action } from "./admin.recipes.$id";

export default function AdminRecipeProcedimentoEditar() {
  const { recipe, unitOptions } = useOutletContext<AdminRecipeOutletContext>();
  const procedure = String((recipe as any)?.productionProcedure || "").trim();
  const productionNotes = String((recipe as any)?.productionNotes || "").trim();
  const yieldQuantity =
    (recipe as any)?.yieldQuantity == null
      ? null
      : Number((recipe as any).yieldQuantity || 0);
  const yieldUnit = String(
    (recipe as any)?.yieldUnit || unitOptions[0] || "UN"
  ).toUpperCase();

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <Form
        method="post"
        action="."
        className="rounded-md border border-slate-200 bg-white p-4"
      >
        <input type="hidden" name="recipeId" value={recipe.id} />
        <input type="hidden" name="tab" value="procedimento" />
        <div className="space-y-1 border-b border-slate-100 pb-3">
          <h3 className="text-sm font-semibold text-slate-900">Rendimento</h3>
          <p className="text-xs leading-5 text-slate-500">
            Quantidade final usada como referência para padronizar a produção.
          </p>
        </div>
        <div className="mt-4 space-y-4">
          <Fieldset className="grid-cols-3">
            <Label htmlFor="yieldQuantity">Quantidade</Label>
            <DecimalInput
              id="yieldQuantity"
              name="yieldQuantity"
              defaultValue={yieldQuantity}
              placeholder="Ex: 0,450"
              fractionDigits={3}
              className="col-span-2 h-10"
              required
            />
          </Fieldset>
          <Fieldset className="grid-cols-3">
            <Label htmlFor="yieldUnit">Unidade</Label>
            <Select name="yieldUnit" defaultValue={yieldUnit}>
              <SelectTrigger
                id="yieldUnit"
                className="col-span-2 h-10 bg-white"
              >
                <SelectValue placeholder="UM" />
              </SelectTrigger>
              <SelectContent>
                {unitOptions.map((unit) => (
                  <SelectItem key={unit} value={unit}>
                    {unit}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Fieldset>
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            type="submit"
            name="_action"
            value="recipe-procedure-yield-update"
            size="sm"
            className="gap-2"
          >
            <SaveIcon size={14} />
            Salvar rendimento
          </Button>
        </div>
      </Form>

      <div className="space-y-4">
        <Form
          method="post"
          action="."
          className="rounded-md border border-slate-200 bg-white p-4"
        >
          <input type="hidden" name="recipeId" value={recipe.id} />
          <input type="hidden" name="tab" value="procedimento" />
          <div className="space-y-1 border-b border-slate-100 pb-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Modo de preparo
            </h3>
            <p className="text-xs leading-5 text-slate-500">
              Passo a passo, pontos de controle, tempo e temperatura.
            </p>
          </div>
          <Textarea
            id="productionProcedure"
            name="productionProcedure"
            defaultValue={procedure}
            className="mt-4 min-h-[22rem] bg-white text-sm leading-7"
            placeholder="Passo a passo de preparo, pontos de controle, tempo, temperatura e padronização para produção."
          />
          <div className="mt-4 flex justify-end">
            <Button
              type="submit"
              name="_action"
              value="recipe-procedure-update"
              size="sm"
              className="gap-2"
            >
              <SaveIcon size={14} />
              Salvar modo de preparo
            </Button>
          </div>
        </Form>

        <Form
          method="post"
          action="."
          className="rounded-md border border-slate-200 bg-white p-4"
        >
          <input type="hidden" name="recipeId" value={recipe.id} />
          <input type="hidden" name="tab" value="procedimento" />
          <div className="space-y-1 border-b border-slate-100 pb-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Observações
            </h3>
            <p className="text-xs leading-5 text-slate-500">
              Alertas, variações aceitas, conservação e pontos de atenção.
            </p>
          </div>
          <Textarea
            id="productionNotes"
            name="productionNotes"
            defaultValue={productionNotes}
            className="mt-4 min-h-40 bg-white text-sm leading-7"
            placeholder="Observações de produção, conservação, ajustes aceitos ou cuidados especiais."
          />
          <div className="mt-4 flex justify-end">
            <Button
              type="submit"
              name="_action"
              value="recipe-procedure-notes-update"
              size="sm"
              className="gap-2"
            >
              <SaveIcon size={14} />
              Salvar observações
            </Button>
          </div>
        </Form>
      </div>
    </div>
  );
}
