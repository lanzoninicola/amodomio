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

function ThermalPhaseForm({
  recipeId,
  title,
  description,
  action,
  phase,
  withSeparator = false,
}: {
  recipeId: string;
  title: string;
  description: string;
  action: "recipe-preheating-update" | "recipe-baking-update";
  phase?: {
    upperTemperatureCelsius?: number | null;
    lowerTemperatureCelsius?: number | null;
    durationMinutes?: number | null;
    notes?: string | null;
  } | null;
  withSeparator?: boolean;
}) {
  return (
    <Form
      method="post"
      action="."
      className={withSeparator ? "border-b border-slate-200 pb-8" : undefined}
    >
      <input type="hidden" name="recipeId" value={recipeId} />
      <input type="hidden" name="tab" value="procedimento" />
      <div className="space-y-1 border-b border-slate-100 pb-3">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="text-xs leading-5 text-slate-500">{description}</p>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={`${action}-upperTemperatureCelsius`}>
            Temperatura superior (°C)
          </Label>
          <DecimalInput
            id={`${action}-upperTemperatureCelsius`}
            name="upperTemperatureCelsius"
            defaultValue={phase?.upperTemperatureCelsius ?? null}
            placeholder="Ex: 250"
            fractionDigits={1}
            className="h-10"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${action}-lowerTemperatureCelsius`}>
            Temperatura inferior (°C)
          </Label>
          <DecimalInput
            id={`${action}-lowerTemperatureCelsius`}
            name="lowerTemperatureCelsius"
            defaultValue={phase?.lowerTemperatureCelsius ?? null}
            placeholder="Ex: 220"
            fractionDigits={1}
            className="h-10"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${action}-durationMinutes`}>Tempo (min)</Label>
          <DecimalInput
            id={`${action}-durationMinutes`}
            name="durationMinutes"
            defaultValue={phase?.durationMinutes ?? null}
            placeholder="Ex: 15"
            fractionDigits={0}
            className="h-10"
          />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <Label htmlFor={`${action}-notes`}>Observações da fase</Label>
        <Textarea
          id={`${action}-notes`}
          name="notes"
          defaultValue={phase?.notes || ""}
          className="min-h-28 bg-white text-sm leading-7"
          placeholder="Equipamento, carga, posição no forno, movimentação, ponto visual e demais cuidados."
        />
      </div>
      <div className="mt-4 flex justify-end">
        <Button
          type="submit"
          name="_action"
          value={action}
          size="sm"
          className="gap-2"
        >
          <SaveIcon size={14} />
          Salvar {title.toLowerCase()}
        </Button>
      </div>
    </Form>
  );
}

export default function AdminRecipeProcedimentoEditar() {
  const { recipe, unitOptions } = useOutletContext<AdminRecipeOutletContext>();
  const procedure = String((recipe as any)?.productionProcedure || "").trim();
  const preheating = (recipe as any)?.RecipePreheating || null;
  const baking = (recipe as any)?.RecipeBaking || null;
  const productionNotes = String((recipe as any)?.productionNotes || "").trim();
  const yieldQuantity =
    (recipe as any)?.yieldQuantity == null
      ? null
      : Number((recipe as any).yieldQuantity || 0);
  const yieldUnit = String(
    (recipe as any)?.yieldUnit || unitOptions[0] || "UN"
  ).toUpperCase();

  return (
    <div className="space-y-4">
      <Form method="post" action="." className="border-b border-slate-200 pb-6">
        <input type="hidden" name="recipeId" value={recipe.id} />
        <input type="hidden" name="tab" value="procedimento" />
        <div className="grid items-end gap-4 md:grid-cols-[minmax(12rem,1fr)_minmax(14rem,0.8fr)_minmax(14rem,0.8fr)_auto]">
          <div className="space-y-1 self-center">
            <h3 className="text-sm font-semibold text-slate-900">Rendimento</h3>
            <p className="text-xs leading-5 text-slate-500">
              Quantidade final usada como referência para padronizar a produção.
            </p>
          </div>
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

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-0 lg:divide-x lg:divide-slate-200">
        <Form method="post" action="." className="lg:pr-8">
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

        <div className="space-y-8 lg:pl-8">
          <ThermalPhaseForm
            recipeId={recipe.id}
            title="Pré-aquecimento"
            description="Configuração inicial do forno antes de receber a produção."
            action="recipe-preheating-update"
            phase={preheating}
            withSeparator
          />

          <ThermalPhaseForm
            recipeId={recipe.id}
            title="Assamento"
            description="Parâmetros aplicados durante a cocção da produção."
            action="recipe-baking-update"
            phase={baking}
            withSeparator
          />

          <Form method="post" action=".">
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
    </div>
  );
}
