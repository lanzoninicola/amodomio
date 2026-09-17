import { describe, expect, it } from "vitest";

import {
  buildRecipeChatGptPrompt,
  resolveRecipeBuilderContext,
} from "./recipe-composition-chatgpt-assistant";
import { buildExternalRecipeChatGptPrompt } from "./recipe-external-chatgpt-assistant";

const linkedVariations = [
  {
    itemVariationId: "size-medium",
    variationId: "medium",
    variationName: "Média",
    variationKind: "size",
    variationCode: "M",
    isReference: true,
  },
  {
    itemVariationId: "base-batch",
    variationId: "base",
    variationName: "Base",
    variationKind: "base",
    variationCode: "base",
    isReference: false,
  },
];

describe("recipe composition builder mode", () => {
  it("uses every linked size for a recipe costed per variation", () => {
    const context = resolveRecipeBuilderContext({
      recipe: { id: "recipe-1", name: "Pizza", costingMode: "per_variation" },
      linkedVariations,
    });

    expect(context.mode).toBe("per_variation");
    expect(context.allowedVariations.map((row) => row.itemVariationId)).toEqual(
      ["size-medium", "base-batch"]
    );
  });

  it("uses only the base batch and exposes yield and loss instructions", () => {
    const recipe = {
      id: "recipe-2",
      name: "Molho",
      costingMode: "yield",
      yieldQuantity: 4.5,
      yieldUnit: "kg",
    };
    const context = resolveRecipeBuilderContext({ recipe, linkedVariations });
    const prompt = buildRecipeChatGptPrompt({
      recipe,
      items: [],
      baseIngredients: [],
      recipeLines: [],
      linkedVariations,
    });
    const externalPrompt = buildExternalRecipeChatGptPrompt({
      recipe,
      items: [],
      linkedVariations,
    });

    expect(context.allowedVariations).toHaveLength(1);
    expect(context.allowedVariations[0].itemVariationId).toBe("base-batch");
    expect(prompt).toContain("Por rendimento");
    expect(prompt).toContain("4.5 KG");
    expect(prompt).toContain("defaultLossPct representa a perda eventual");
    expect(externalPrompt).toContain("4.5 KG");
    expect(externalPrompt).toContain("quantidade bruta usada no preparo");
  });

  it("uses the reference variation for yield when the item has no base variation", () => {
    const context = resolveRecipeBuilderContext({
      recipe: { id: "recipe-3", name: "Frango", costingMode: "yield" },
      linkedVariations: linkedVariations.filter(
        (variation) => variation.variationKind !== "base"
      ),
    });

    expect(context.allowedVariations).toHaveLength(1);
    expect(context.allowedVariations[0].itemVariationId).toBe("size-medium");
  });
});
