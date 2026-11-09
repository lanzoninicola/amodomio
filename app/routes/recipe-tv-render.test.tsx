import { expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { RecipeTemplateChecklistProvider } from "~/domain/recipe/components/recipe-template-checklist";
vi.mock("~/domain/auth/google.server", () => ({
  authenticator: { isAuthenticated: vi.fn() },
}));
vi.mock("~/lib/prisma/client.server", () => ({ default: {} }));
import MobileRecipe from "./admin.mobile.receitas.$recipeId";
import MobileTemplateDetail from "./admin.mobile.receitas.$recipeId_.templates_.$templateId";
import RecipeTv from "./admin_.receitas-tv.$recipeId";
import TemplateList from "./admin_.receitas-tv.$recipeId_.templates";
import CreateTemplate from "./admin_.receitas-tv.$recipeId_.templates_.novo";
import TemplateDetail from "./admin_.receitas-tv.$recipeId_.templates_.$templateId";
const recipe = {
  id: "recipe-1",
  name: "Massa",
  costingMode: "yield",
  yieldQuantity: 10,
  yieldUnit: "KG",
  description: null,
  productionProcedure: "Misturar",
  productionNotes: null,
  preheating: null,
  baking: null,
  ingredients: [
    {
      id: "flour",
      name: "Farinha",
      quantity: 5,
      unit: "KG",
      preferredUnit: null,
      notes: null,
      subRecipe: null,
      displayUnits: [
        { unit: "KG", factor: 1 },
        { unit: "G", factor: 1000 },
      ],
    },
  ],
};
const configuration = { scaleFactor: 2, selectedUnits: { flour: "G" } };
const snapshot = {
  version: 1,
  recipeName: "Massa",
  scaleFactor: 2,
  yieldQuantity: 20,
  yieldUnit: "KG",
  ingredients: [
    { id: "flour", name: "Farinha", quantity: 10000, unit: "G", notes: null },
  ],
};
function render(element: React.ReactNode, data: unknown, path: string) {
  const router = createMemoryRouter(
    [
      {
        id: "page",
        path: "*",
        element: (
          <RecipeTemplateChecklistProvider>
            {element}
          </RecipeTemplateChecklistProvider>
        ),
      },
    ],
    { initialEntries: [path], hydrationData: { loaderData: { page: data } } }
  );
  return renderToString(<RouterProvider router={router} />);
}
it("renders the TV controls, scaled quantity, units and ingredient checklist", () => {
  const html = render(
    <RecipeTv />,
    { recipe, configuration },
    "/admin/receitas-tv/recipe-1"
  );
  expect(html).toContain("Opções");
  expect(html).not.toContain("Mostrar preparo");
  expect(html).not.toContain('id="tv-preparation"');
  expect(html).not.toContain("Misturar");
  expect(html).toContain("mx-auto w-full max-w-5xl grid-cols-1");
  expect(html).toContain("Criar template");
  expect(html).toContain("Templates");
  expect(html).toContain("Tela cheia");
  expect(html).toContain("10.000");
  expect(html).toContain("Unidade de Farinha");
  expect(html).toContain('aria-label="Composição da receita"');
  expect(html).toContain('<th scope="col"');
  expect(html).toContain("Recalcular receita pela quantidade de Farinha");
  expect(html).toContain("Farinha: pendente");
});
it("keeps template list navigation within TV routes", () => {
  const html = render(
    <TemplateList />,
    { payload: { recipe }, templates: [] },
    "/admin/receitas-tv/recipe-1/templates"
  );
  expect(html).toContain('href="/admin/receitas-tv/recipe-1"');
  expect(html).toContain('href="/admin/receitas-tv/recipe-1/templates/novo"');
  expect(html).not.toContain("/admin/mobile/receitas");
});
it("renders creation with a scaled snapshot and TV return link", () => {
  const html = render(
    <CreateTemplate />,
    { payload: { recipe, configuration, snapshot } },
    "/admin/receitas-tv/recipe-1/templates/novo"
  );
  expect(html).toContain("10.000");
  expect(html).toContain("Salvar template");
  expect(html).toContain('href="/admin/receitas-tv/recipe-1?scaleFactor=2');
  expect(html).not.toContain("/admin/mobile/receitas");
});
it("renders the saved template with checklist, unit choices and deletion in TV", () => {
  const html = render(
    <TemplateDetail />,
    {
      payload: {
        recipe,
        template: {
          id: "template-1",
          name: "Dobro",
          description: null,
          snapshot,
        },
      },
    },
    "/admin/receitas-tv/recipe-1/templates/template-1"
  );
  expect(html).toContain("Dobro");
  expect(html).toContain("Farinha: pendente");
  expect(html).toContain("Excluir template");
  expect(html).toContain("Unidade de Farinha");
  expect(html).toContain('aria-label="Composição da receita"');
  expect(html).toContain("10.000");
  expect(html).toContain("Tela cheia");
  expect(html).toContain("Opções");
  expect(html).not.toContain("Recalcular receita pela quantidade");
  expect(html).toContain('href="/admin/receitas-tv/recipe-1/templates"');
  expect(html).not.toContain("/admin/mobile/receitas");
});

it.each([
  [1, "Falta 1 ingrediente", "border-red-400"],
  [2, "Faltam 2 ingredientes", "border-amber-400"],
])(
  "shows a fixed pending ingredient alert for %s remaining",
  (count, message, color) => {
    const ingredients = Array.from({ length: count }, (_, index) => ({
      ...recipe.ingredients[0],
      id: `ingredient-${index}`,
    }));
    const html = render(
      <RecipeTv />,
      { recipe: { ...recipe, ingredients }, configuration },
      "/admin/receitas-tv/recipe-1"
    );
    expect(html).toContain(message);
    expect(html).toContain(color);
    expect(html).toContain(
      count === 1 ? "bg-red-600 text-white" : "bg-amber-400 text-slate-950"
    );
    expect(html).toContain("motion-safe:animate-bounce");
    expect(html).toContain("fixed left-1/2 top-4");
  }
);
it.each([0, 3])("does not show a pending alert for %s remaining", (count) => {
  const ingredients = Array.from({ length: count }, (_, index) => ({
    ...recipe.ingredients[0],
    id: `ingredient-${index}`,
  }));
  const html = render(
    <RecipeTv />,
    { recipe: { ...recipe, ingredients }, configuration },
    "/admin/receitas-tv/recipe-1"
  );
  expect(html).not.toContain("Falta 1 ingrediente");
  expect(html).not.toContain("Faltam 2 ingredientes");
});

it.each([
  [1, "Falta 1 ingrediente", "border-red-400"],
  [2, "Faltam 2 ingredientes", "border-amber-400"],
])(
  "renders the same pending alert in mobile for %s remaining",
  (count, message, color) => {
    const ingredients = Array.from({ length: count }, (_, index) => ({
      ...recipe.ingredients[0],
      id: `ingredient-${index}`,
    }));
    const html = render(
      <MobileRecipe />,
      { payload: { recipe: { ...recipe, ingredients }, configuration } },
      "/admin/mobile/receitas/recipe-1"
    );
    expect(html).toContain(message);
    expect(html).toContain(color);
    expect(html).toContain(
      count === 1 ? "bg-red-600 text-white" : "bg-amber-400 text-slate-950"
    );
    expect(html).toContain("motion-safe:animate-bounce");
    expect(html).toContain("fixed left-1/2 top-4");
    expect(html).toContain("Marcar Farinha como adicionado");
  }
);

it("uses the mobile recipe layout for a saved template without recalculating it", () => {
  const html = render(
    <MobileTemplateDetail />,
    {
      payload: {
        recipe: {
          ...recipe,
          ingredients: [{ ...recipe.ingredients[0], quantity: 99 }],
        },
        template: {
          id: "template-1",
          name: "Dobro",
          description: null,
          snapshot,
        },
      },
    },
    "/admin/mobile/receitas/recipe-1/templates/template-1"
  );
  expect(html).toContain("Dobro");
  expect(html).toContain("Ingredientes");
  expect(html).toContain("Modo de preparo");
  expect(html).toContain("Rendimento salvo");
  expect(html).toContain('readonly=""');
  expect(html).toContain("10.000,00");
  expect(html).toContain("Marcar Farinha como adicionado");
  expect(html).toContain("Excluir template");
  expect(html).not.toContain("Recalcular receita pela quantidade");
  expect(html).toContain('href="/admin/mobile/receitas/recipe-1/templates"');
});

it("renders TV template cards with larger text, dark background and visible delete action", () => {
  const html = render(
    <TemplateList />,
    {
      payload: { recipe },
      templates: [
        {
          id: "template-1",
          name: "Produção da manhã",
          description: "3 kg de farinha",
          createdAt: "2026-10-15T12:00:00Z",
        },
      ],
    },
    "/admin/receitas-tv/recipe-1/templates"
  );
  expect(html).toContain("Produção da manhã");
  expect(html).toContain("3 kg de farinha");
  expect(html).toContain("text-3xl font-bold leading-snug text-white");
  expect(html).toContain("grid auto-rows-fr gap-5 xl:grid-cols-2");
  expect(html).toContain("Excluir template Produção da manhã");
  expect(html).toContain("Criar template");
  expect(html).not.toContain("bg-slate-50 p-6");
});
