export type MissingIngredient = {
    name: string
    unit: string | null
    notes: string | null
}

export function extractMissingIngredientsPreview(value: string): MissingIngredient[] {
    const raw = String(value || "").trim()
    if (!raw) return []

    const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
    const payload = fencedMatch?.[1]?.trim() || raw

    try {
        const parsed = JSON.parse(payload)
        const missingIngredients = Array.isArray(parsed?.missingIngredients) ? parsed.missingIngredients : []
        return missingIngredients
            .map((ingredient: any) => ({
                name: String(ingredient?.name || "").trim(),
                unit: String(ingredient?.unit || "").trim().toUpperCase() || null,
                notes: String(ingredient?.notes || "").trim() || null,
            }))
            .filter((ingredient: MissingIngredient) => ingredient.name)
    } catch (_error) {
        return []
    }
}

export default function MissingIngredientsPreview({ ingredients }: { ingredients: MissingIngredient[] }) {
    if (ingredients.length === 0) return null

    return (
        <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                Ingredientes ainda não cadastrados detectados na resposta
            </p>
            <div className="space-y-2">
                {ingredients.map((ingredient, index) => (
                    <div key={`${ingredient.name}-${index}`} className="rounded-md border border-amber-200 bg-white/70 px-3 py-2 text-sm text-amber-950">
                        <div className="font-medium">{ingredient.name}</div>
                        <div className="text-xs text-amber-800">
                            {ingredient.unit || "UM não informada"}{ingredient.notes ? ` · ${ingredient.notes}` : ""}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
