import { beforeEach, expect, it, vi } from "vitest";
import { createDeferredReadableStream } from "@remix-run/server-runtime/dist/responses.js";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  recipe: vi.fn(),
  create: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  deleteMany: vi.fn(),
  updateMany: vi.fn(),
  findRecipe: vi.fn(),
}));
vi.mock("~/domain/auth/google.server", () => ({
  authenticator: { isAuthenticated: mocks.auth },
}));
vi.mock("~/domain/recipe/mobile-recipe.server", () => ({
  getMobileRecipe: mocks.recipe,
}));
vi.mock("~/lib/prisma/client.server", () => ({
  default: {
    recipeTemplate: {
      create: mocks.create,
      findFirst: mocks.findFirst,
      findMany: mocks.findMany,
      deleteMany: mocks.deleteMany,
    },
    recipeIngredient: { updateMany: mocks.updateMany },
    recipe: { findUnique: mocks.findRecipe },
  },
}));
import { action, loader } from "./admin.mobile.receitas.$recipeId";
import {
  action as createAction,
  loader as createLoader,
} from "./admin.mobile.receitas.$recipeId_.templates_.novo";
import {
  action as listAction,
  loader as listLoader,
  shouldRevalidate,
} from "./admin.mobile.receitas.$recipeId_.templates";
import { loader as detailLoader } from "./admin.mobile.receitas.$recipeId_.templates_.$templateId";

async function submit(values: Record<string, string>, recipeId = "recipe-1") {
  const args = {
    request: new Request(`http://localhost/admin/mobile/receitas/${recipeId}`, {
      method: "POST",
      body: new URLSearchParams(values),
    }),
    params: { recipeId },
    context: {},
  };
  if (values.intent === "create-template") return createAction(args);
  if (values.intent === "delete-template") return listAction(args);
  if (values.intent === "view-template") {
    try {
      return await detailLoader({
        ...args,
        params: { recipeId, templateId: values.templateId },
      });
    } catch (error) {
      if (error instanceof Response) return error;
      throw error;
    }
  }
  return action(args);
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ id: "user-1" });
  mocks.findRecipe.mockResolvedValue({
    id: "recipe-1",
    name: "Massa com margarina",
  });
  mocks.recipe.mockResolvedValue({
    id: "recipe-1",
    name: "Massa com margarina",
    costingMode: "yield",
    yieldQuantity: 10,
    yieldUnit: "KG",
    ingredients: [
      { id: "flour", name: "Farinha", quantity: 5, unit: "KG", notes: null },
    ],
  });
  mocks.create.mockResolvedValue({ id: "template-1" });
});

it("creates a named template from the server composition with adjusted quantities", async () => {
  const response = await submit({
    intent: "create-template",
    name: "  Dobro  ",
    description: "  Produção da manhã  ",
    scaleFactor: "2",
    ingredients: "untrusted",
  });
  expect(await response.json()).toEqual({ createdTemplateId: "template-1" });
  expect(mocks.create).toHaveBeenCalledWith({
    data: {
      recipeId: "recipe-1",
      name: "Dobro",
      description: "Produção da manhã",
      snapshot: {
        version: 1,
        recipeName: "Massa com margarina",
        scaleFactor: 2,
        yieldQuantity: 20,
        yieldUnit: "KG",
        ingredients: [
          {
            id: "flour",
            name: "Farinha",
            quantity: 10,
            unit: "KG",
            notes: null,
          },
        ],
      },
    },
    select: { id: true },
  });
});

it("uses the selected consumption unit and the server conversion when saving", async () => {
  mocks.recipe.mockResolvedValue({
    name: "Massa",
    costingMode: "yield",
    yieldQuantity: 10,
    yieldUnit: "KG",
    ingredients: [
      {
        id: "flour",
        name: "Farinha",
        quantity: 5,
        unit: "KG",
        notes: null,
        displayUnits: [
          { unit: "KG", factor: 1 },
          { unit: "G", factor: 1000 },
        ],
      },
    ],
  });
  const response = await submit({
    intent: "create-template",
    name: "Em gramas",
    scaleFactor: "2",
    selectedUnits: JSON.stringify({ flour: "G" }),
    factor: "500",
  });
  expect(response.status).toBe(200);
  expect(
    mocks.create.mock.calls[0][0].data.snapshot.ingredients[0]
  ).toMatchObject({ quantity: 10000, unit: "G" });
});

it.each(["null", "[]", "invalid", '{"flour":123}', '{"flour":"ML"}'])(
  "rejects invalid selected units %s",
  async (selectedUnits) => {
    const response = await submit({
      intent: "create-template",
      name: "Template",
      scaleFactor: "2",
      selectedUnits,
    });
    expect(response.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  }
);

it.each(["", "0", "-2", "NaN", "Infinity"])(
  "rejects invalid scale %s without writing",
  async (scaleFactor) => {
    expect(
      (
        await submit({
          intent: "create-template",
          name: "Template",
          scaleFactor,
        })
      ).status
    ).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  }
);

it.each(["", " ", "a".repeat(121)])(
  "rejects invalid template names",
  async (name) => {
    expect(
      (await submit({ intent: "create-template", name, scaleFactor: "1" }))
        .status
    ).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  }
);

it("requires authentication before reading or creating templates", async () => {
  mocks.auth.mockResolvedValue(null);
  const response = await submit({
    intent: "view-template",
    templateId: "template-1",
  });
  expect(response.status).toBe(302);
  expect(response.headers.get("Location")).toBe("/login");
  expect(mocks.findFirst).not.toHaveBeenCalled();
  expect(mocks.create).not.toHaveBeenCalled();
});

it("protects the recipe and template list when the loader is requested directly", async () => {
  mocks.auth.mockResolvedValue(null);
  const response = await loader({
    request: new Request("http://localhost/admin/mobile/receitas/recipe-1"),
    params: { recipeId: "recipe-1" },
    context: {},
  });
  expect(response.status).toBe(302);
  expect(mocks.recipe).not.toHaveBeenCalled();
  expect(mocks.findMany).not.toHaveBeenCalled();
});

it("streams template metadata scoped to the recipe without loading snapshots", async () => {
  const templates = [
    {
      id: "template-1",
      name: "Dobro",
      description: null,
      createdAt: new Date(),
    },
  ];
  mocks.findMany.mockResolvedValue(templates);
  const response = await listLoader({
    request: new Request("http://localhost/admin/mobile/receitas/recipe-1"),
    params: { recipeId: "recipe-1" },
    context: {},
  });
  expect("data" in response).toBe(true);
  if (!("data" in response)) throw new Error("Expected deferred data");
  expect(response.deferredKeys).toContain("templates");
  expect(await response.data.templates).toEqual(templates);
  const stream = createDeferredReadableStream(
    response,
    new AbortController().signal,
    "development"
  );
  const transmitted = await new Response(stream).text();
  expect(transmitted).toContain('"templates":"__deferred_promise:templates"');
  expect(transmitted).toContain(`data:${JSON.stringify({ templates })}`);
  expect(mocks.findMany).toHaveBeenCalledWith({
    where: { recipeId: "recipe-1" },
    select: { id: true, name: true, description: true, createdAt: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
});

it("transfers adjusted quantities and selected units to the create route", async () => {
  mocks.recipe.mockResolvedValue({
    id: "recipe-1",
    name: "Massa",
    costingMode: "yield",
    yieldQuantity: 10,
    yieldUnit: "KG",
    ingredients: [
      {
        id: "flour",
        name: "Farinha",
        quantity: 5,
        unit: "KG",
        notes: null,
        displayUnits: [{ unit: "G", factor: 1000 }],
      },
    ],
  });
  const search = new URLSearchParams({
    scaleFactor: "0.5",
    selectedUnits: JSON.stringify({ flour: "G" }),
  });
  const response = await createLoader({
    request: new Request(
      `http://localhost/admin/mobile/receitas/recipe-1/templates/novo?${search}`
    ),
    params: { recipeId: "recipe-1" },
    context: {},
  });
  const { payload } = await response.json();
  expect(payload.configuration).toEqual({
    scaleFactor: 0.5,
    selectedUnits: { flour: "G" },
  });
  expect(payload.snapshot.ingredients[0]).toMatchObject({
    quantity: 2500,
    unit: "G",
  });
  expect(payload.snapshot.yieldQuantity).toBe(5);
});

it.each([listLoader, createLoader, detailLoader])(
  "protects each independent template page before database access",
  async (routeLoader) => {
    mocks.auth.mockResolvedValue(null);
    const response = await routeLoader({
      request: new Request(
        "http://localhost/admin/mobile/receitas/recipe-1/templates"
      ),
      params: { recipeId: "recipe-1", templateId: "template-1" },
      context: {},
    });
    expect(response.status).toBe(302);
    expect(mocks.recipe).not.toHaveBeenCalled();
    expect(mocks.findRecipe).not.toHaveBeenCalled();
    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.findFirst).not.toHaveBeenCalled();
  }
);

it("keeps template data when only search or pagination changes", () => {
  const args = {
    currentUrl: new URL("http://localhost/recipes/1/templates?q=a"),
    nextUrl: new URL("http://localhost/recipes/1/templates?q=b&page=1"),
    defaultShouldRevalidate: true,
  };
  expect(shouldRevalidate(args as Parameters<typeof shouldRevalidate>[0])).toBe(
    false
  );
  expect(
    shouldRevalidate({ ...args, formMethod: "POST" } as Parameters<
      typeof shouldRevalidate
    >[0])
  ).toBe(true);
});

it("loads the recipe without querying its templates", async () => {
  const response = await loader({
    request: new Request(
      "http://localhost/admin/mobile/receitas/recipe-1?scaleFactor=2"
    ),
    params: { recipeId: "recipe-1" },
    context: {},
  });
  expect((await response.json()).payload.configuration.scaleFactor).toBe(2);
  expect(mocks.findMany).not.toHaveBeenCalled();
});

it("restricts template lookup to the current recipe", async () => {
  mocks.findFirst.mockResolvedValue(null);
  const response = await submit({
    intent: "view-template",
    templateId: "other-recipe-template",
  });
  expect(response.status).toBe(404);
  expect(mocks.findFirst).toHaveBeenCalledWith({
    where: { id: "other-recipe-template", recipeId: "recipe-1" },
  });
});

it("returns the stored snapshot without recalculating from the current recipe", async () => {
  const template = {
    id: "template-1",
    name: "Salvo",
    snapshot: { ingredients: [{ name: "Farinha", quantity: 10 }] },
  };
  mocks.findFirst.mockResolvedValue(template);
  const response = await submit({
    intent: "view-template",
    templateId: "template-1",
  });
  expect((await response.json()).payload.template).toEqual(template);
  expect(mocks.recipe).toHaveBeenCalledWith("recipe-1");
});

it("deletes only the selected template belonging to the current recipe", async () => {
  mocks.deleteMany.mockResolvedValue({ count: 1 });
  const response = await submit({
    intent: "delete-template",
    templateId: "template-1",
  });
  expect(await response.json()).toEqual({ deletedTemplateId: "template-1" });
  expect(mocks.deleteMany).toHaveBeenCalledWith({
    where: { id: "template-1", recipeId: "recipe-1" },
  });
});

it("does not report a foreign or missing template as deleted", async () => {
  mocks.deleteMany.mockResolvedValue({ count: 0 });
  expect(
    (await submit({ intent: "delete-template", templateId: "foreign" })).status
  ).toBe(404);
});

it("saves a display preference only for the ingredient in this recipe", async () => {
  mocks.recipe.mockResolvedValue({
    ingredients: [{ id: "flour", displayUnits: [{ unit: "G", factor: 1000 }] }],
  });
  mocks.updateMany.mockResolvedValue({ count: 1 });
  const response = await submit({
    intent: "save-display-unit",
    ingredientId: "flour",
    unit: "G",
  });
  expect(await response.json()).toEqual({
    savedDisplayUnit: "G",
    ingredientId: "flour",
  });
  expect(mocks.updateMany).toHaveBeenCalledWith({
    where: { id: "flour", recipeId: "recipe-1" },
    data: { mobileDisplayUnit: "G" },
  });
});

it.each([
  { ingredientId: "foreign", unit: "G" },
  { ingredientId: "flour", unit: "ML" },
])("rejects a foreign ingredient or unsupported unit %s", async (values) => {
  mocks.recipe.mockResolvedValue({
    ingredients: [{ id: "flour", displayUnits: [{ unit: "G", factor: 1000 }] }],
  });
  expect(
    (await submit({ intent: "save-display-unit", ...values })).status
  ).toBe(400);
  expect(mocks.updateMany).not.toHaveBeenCalled();
});

it.each(["save-display-unit", "delete-template"])(
  "requires authentication for %s",
  async (intent) => {
    mocks.auth.mockResolvedValue(null);
    expect(
      (
        await submit({
          intent,
          ingredientId: "flour",
          unit: "G",
          templateId: "template-1",
        })
      ).status
    ).toBe(302);
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  }
);
