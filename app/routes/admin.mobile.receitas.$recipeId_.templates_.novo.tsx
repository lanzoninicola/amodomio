import { json, redirect } from "@remix-run/node";
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { Link, useFetcher, useLoaderData, useNavigate } from "@remix-run/react";
import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { authenticator } from "~/domain/auth/google.server";
import { getMobileRecipe } from "~/domain/recipe/mobile-recipe.server";
import { createRecipeTemplate } from "~/domain/recipe/recipe-templates.server";
import { createRecipeTemplateSnapshot } from "~/domain/recipe/recipe-template";
import {
  readRecipeTemplateConfiguration,
  getRecipeTemplateSearch,
} from "~/domain/recipe/recipe-template-navigation";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  {
    title: `Criar template de ${
      data?.payload.recipe.name || "receita"
    } | Admin Mobile`,
  },
];

export async function loader({ request, params }: LoaderFunctionArgs) {
  if (!(await authenticator.isAuthenticated(request)))
    return redirect("/login");
  const recipe = await getMobileRecipe(String(params.recipeId || ""));
  try {
    const configuration = readRecipeTemplateConfiguration(
      new URL(request.url).searchParams
    );
    const snapshot = createRecipeTemplateSnapshot(
      recipe,
      configuration.scaleFactor,
      configuration.selectedUnits
    );
    return json({ payload: { recipe, configuration, snapshot } });
  } catch (error) {
    throw new Response(
      error instanceof Error ? error.message : "Quantidades inválidas",
      { status: 400 }
    );
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  if (!(await authenticator.isAuthenticated(request)))
    return redirect("/login");
  const recipeId = String(params.recipeId || "");
  if (!recipeId) return json({ error: "Receita inválida." }, { status: 400 });
  const form = await request.formData();
  if (form.get("intent") !== "create-template")
    return json({ error: "Ação inválida." }, { status: 400 });
  return createRecipeTemplate(recipeId, form);
}

function formatQuantity(value: number) {
  return Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

export default function CreateRecipeTemplatePage() {
  const {
    payload: { recipe, configuration, snapshot },
  } = useLoaderData<typeof loader>();
  const createFetcher = useFetcher<typeof action>();
  const navigate = useNavigate();
  const savingTemplate = createFetcher.state !== "idle";
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const yieldScaleFactor = configuration.scaleFactor;
  const selectedUnits = configuration.selectedUnits;
  const baseYield =
    snapshot.yieldQuantity === null ? null : Number(recipe.yieldQuantity);
  const yieldUnit = snapshot.yieldUnit;
  const search = getRecipeTemplateSearch(configuration);
  const recipeUrl = `/admin/mobile/receitas/${recipe.id}${search}`;
  useEffect(() => {
    if (
      createFetcher.state === "idle" &&
      createFetcher.data &&
      "createdTemplateId" in createFetcher.data
    ) {
      navigate(
        `/admin/mobile/receitas/${recipe.id}/templates/${createFetcher.data.createdTemplateId}${search}`,
        { replace: true }
      );
    }
  }, [createFetcher.state, createFetcher.data, navigate, recipe.id, search]);
  return (
    <div className="space-y-6 pb-6">
      <Link
        to={recipeUrl}
        className="inline-flex h-11 items-center gap-1 text-sm font-semibold text-slate-600"
      >
        <ChevronLeft className="h-4 w-4" /> Voltar à receita
      </Link>
      <div>
        <h2 className="text-2xl font-semibold text-slate-950">
          Criar template
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {recipe.name} · Ingredientes nas quantidades ajustadas.
        </p>
      </div>
      <createFetcher.Form method="post" className="space-y-4">
        <input type="hidden" name="intent" value="create-template" />
        <input type="hidden" name="scaleFactor" value={yieldScaleFactor} />
        <input
          type="hidden"
          name="selectedUnits"
          value={JSON.stringify(selectedUnits)}
        />
        <div className="space-y-1">
          <label htmlFor="template-name" className="text-sm font-medium">
            Nome
          </label>
          <Input
            id="template-name"
            name="name"
            required
            maxLength={120}
            value={templateName}
            onChange={(event) => setTemplateName(event.target.value)}
            placeholder="Ex.: Massa para 5 kg de farinha"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="template-description" className="text-sm font-medium">
            Descrição (opcional)
          </label>
          <Textarea
            id="template-description"
            name="description"
            maxLength={2000}
            value={templateDescription}
            onChange={(event) => setTemplateDescription(event.target.value)}
          />
        </div>
        {baseYield ? (
          <p className="text-sm text-slate-600">
            Rendimento: {formatQuantity(baseYield * yieldScaleFactor)}{" "}
            {yieldUnit}
          </p>
        ) : null}
        <ul className="divide-y rounded-lg border px-3">
          {snapshot.ingredients.map((ingredient) => (
            <li
              key={ingredient.id}
              className="flex items-center justify-between gap-3 py-2 text-sm"
            >
              <span>{ingredient.name}</span>
              <span className="shrink-0 font-semibold">
                {formatQuantity(ingredient.quantity)} {ingredient.unit}
              </span>
            </li>
          ))}
        </ul>
        {createFetcher.data && "error" in createFetcher.data ? (
          <p role="alert" className="text-sm text-red-600">
            {createFetcher.data.error}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            disabled={savingTemplate}
            className="h-12 sm:flex-1"
            onClick={() => navigate(recipeUrl)}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            className="h-[52px] sm:flex-1"
            disabled={savingTemplate || !templateName.trim()}
          >
            {savingTemplate ? "Salvando…" : "Salvar template"}
          </Button>
        </div>
      </createFetcher.Form>
    </div>
  );
}
