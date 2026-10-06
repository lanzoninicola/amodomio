export type RecipeTemplateConfiguration = {
  scaleFactor: number;
  selectedUnits: Record<string, string>;
};

export function readRecipeTemplateConfiguration(
  params: URLSearchParams
): RecipeTemplateConfiguration {
  const scaleFactor = Number(params.get("scaleFactor") ?? "1");
  const selectedUnits = JSON.parse(params.get("selectedUnits") || "{}");
  if (
    !Number.isFinite(scaleFactor) ||
    scaleFactor <= 0 ||
    !selectedUnits ||
    typeof selectedUnits !== "object" ||
    Array.isArray(selectedUnits) ||
    Object.values(selectedUnits).some((unit) => typeof unit !== "string")
  ) {
    throw new Error(
      "Ajuste as quantidades e unidades na receita antes de criar o template."
    );
  }
  return { scaleFactor, selectedUnits };
}

export function getRecipeTemplateSearch(
  configuration: RecipeTemplateConfiguration
) {
  return `?${new URLSearchParams({
    scaleFactor: String(configuration.scaleFactor),
    selectedUnits: JSON.stringify(configuration.selectedUnits),
  })}`;
}
