type CostSnapshot = {
  lastUnitCostAmount: number
  avgUnitCostAmount: number
  lastTotalCostAmount: number
  avgTotalCostAmount: number
}

export type RecipeCompositionLine = {
  id: string
  recipeId: string
  recipeIngredientId: string | null
  itemId: string
  unit: string
  quantity: number
  defaultLossPct: number
  lossPct: number | null
  sortOrderIndex: number
  notes: string | null
  lastUnitCostAmount: number
  avgUnitCostAmount: number
  lastTotalCostAmount: number
  avgTotalCostAmount: number
  Item: { id: string; name: string }
  ItemVariation: {
    id: string
    variationId?: string | null
    Variation?: { id: string; name: string; kind?: string | null; code?: string | null } | null
  } | null
}

export type RecipeLinkedVariation = {
  itemVariationId: string
  variationId: string | null
  variationName: string | null
  variationKind: string | null
  variationCode: string | null
  isReference: boolean
}

function isNewCompositionModelAvailable(db: any) {
  return typeof db?.recipeIngredient?.findMany === "function" &&
    typeof db?.recipeVariationIngredient?.findMany === "function"
}

async function ensureOwnerItemVariationId(db: any, recipeId: string): Promise<string | null> {
  const recipe = await db.recipe.findUnique({
    where: { id: recipeId },
    select: { id: true, itemId: true, variationId: true },
  })
  if (!recipe) return null

  if (recipe.itemId && recipe.variationId) {
    let owner = await db.itemVariation.findFirst({
      where: { itemId: recipe.itemId, variationId: recipe.variationId, deletedAt: null },
      select: { id: true, recipeId: true },
    })

    if (!owner) {
      owner = await db.itemVariation.create({
        data: {
          itemId: recipe.itemId,
          variationId: recipe.variationId,
          recipeId,
        },
        select: { id: true, recipeId: true },
      })
      return owner.id
    }

    if (!owner.recipeId) {
      await db.itemVariation.update({
        where: { id: owner.id },
        data: { recipeId },
      })
    }

    return owner.id
  }

  const byRecipe = await db.itemVariation.findFirst({
    where: { recipeId, deletedAt: null },
    select: { id: true },
    orderBy: [{ createdAt: "asc" }],
  })
  return byRecipe?.id || null
}

export async function listRecipeLinkedVariations(db: any, recipeId: string): Promise<RecipeLinkedVariation[]> {
  const recipe = await db.recipe.findUnique({
    where: { id: recipeId },
    select: { itemId: true },
  })
  const itemId = String(recipe?.itemId || "").trim()

  const rows = await db.itemVariation.findMany({
    where: itemId
      ? { itemId, deletedAt: null }
      : { recipeId, deletedAt: null },
    select: {
      id: true,
      variationId: true,
      isReference: true,
      Variation: { select: { name: true, kind: true, code: true } },
    },
    orderBy: [{ createdAt: "asc" }],
  })
  return (rows || []).map((row: any) => ({
    itemVariationId: row.id,
    variationId: row.variationId || null,
    variationName: row.Variation?.name || null,
    variationKind: row.Variation?.kind || null,
    variationCode: row.Variation?.code || null,
    isReference: Boolean(row.isReference),
  }))
}

export async function listRecipeCompositionLines(db: any, recipeId: string): Promise<RecipeCompositionLine[]> {
  if (isNewCompositionModelAvailable(db)) {
    const ownerVariationIds = (await listRecipeLinkedVariations(db, recipeId))
      .map((row) => row.itemVariationId)

    const ingredients = await db.recipeIngredient.findMany({
      where: { recipeId },
      include: {
        IngredientItem: { select: { id: true, name: true } },
        RecipeVariationIngredient: {
          where: ownerVariationIds.length > 0 ? { itemVariationId: { in: ownerVariationIds } } : undefined,
          include: {
            ItemVariation: {
              select: {
                id: true,
                variationId: true,
                Variation: { select: { id: true, name: true, kind: true, code: true } },
              },
            },
          },
          orderBy: [{ itemVariationId: "asc" }, { updatedAt: "desc" }],
        },
      },
      orderBy: [{ sortOrderIndex: "asc" }, { createdAt: "asc" }],
    })

    const lines = ingredients
      .flatMap((ingredient: any) => {
        const rows = Array.isArray(ingredient.RecipeVariationIngredient)
          ? ingredient.RecipeVariationIngredient
          : []
        return rows.map((perVariation: any) => ({
          id: perVariation.id,
          recipeId,
          recipeIngredientId: ingredient.id,
          itemId: ingredient.ingredientItemId,
          unit: perVariation.unit,
          quantity: Number(perVariation.quantity || 0),
          defaultLossPct: Number(ingredient.defaultLossPct || 0),
          lossPct: perVariation.lossPct == null ? null : Number(perVariation.lossPct),
          sortOrderIndex: Number(ingredient.sortOrderIndex || 0),
          notes: ingredient.notes || null,
          lastUnitCostAmount: 0,
          avgUnitCostAmount: 0,
          lastTotalCostAmount: 0,
          avgTotalCostAmount: 0,
          Item: {
            id: ingredient.IngredientItem.id,
            name: ingredient.IngredientItem.name,
          },
          ItemVariation: perVariation.ItemVariation
            ? {
              id: perVariation.ItemVariation.id,
              variationId: perVariation.ItemVariation.variationId || null,
              Variation: perVariation.ItemVariation.Variation || null,
            }
            : null,
        } satisfies RecipeCompositionLine))
      }) as RecipeCompositionLine[]

    return lines
  }

  const legacyLines = typeof db?.recipeLine?.findMany === "function"
    ? await db.recipeLine.findMany({
      where: { recipeId },
      include: {
        Item: { select: { id: true, name: true } },
        ItemVariation: {
          include: { Variation: { select: { id: true, name: true, kind: true, code: true } } },
        },
      },
      orderBy: [{ sortOrderIndex: "asc" }, { createdAt: "asc" }],
    })
    : []

  return (legacyLines || []).map((line: any) => ({
    id: line.id,
    recipeId: line.recipeId,
    recipeIngredientId: null,
    itemId: line.itemId,
    unit: line.unit,
    quantity: Number(line.quantity || 0),
    defaultLossPct: 0,
    lossPct: null,
    sortOrderIndex: Number(line.sortOrderIndex || 0),
    notes: line.notes || null,
    lastUnitCostAmount: 0,
    avgUnitCostAmount: 0,
    lastTotalCostAmount: 0,
    avgTotalCostAmount: 0,
    Item: line.Item,
    ItemVariation: line.ItemVariation
      ? {
        id: line.ItemVariation.id,
        variationId: line.ItemVariation.variationId || null,
        Variation: line.ItemVariation.Variation || null,
      }
      : null,
  }))
}

export async function countRecipeCompositionLines(db: any, recipeId: string): Promise<number> {
  if (isNewCompositionModelAvailable(db)) {
    return Number(await db.recipeIngredient.count({ where: { recipeId } }))
  }
  if (typeof db?.recipeLine?.count === "function") {
    return Number(await db.recipeLine.count({ where: { recipeId } }))
  }
  return 0
}

async function resolveTargetItemVariationIdsForRecipe(db: any, recipeId: string): Promise<string[]> {
  const linked = await db.itemVariation.findMany({
    where: { recipeId, deletedAt: null },
    select: { id: true },
    orderBy: [{ createdAt: "asc" }],
  })
  if (linked.length > 0) return linked.map((row: { id: string }) => row.id)

  const recipe = await db.recipe.findUnique({
    where: { id: recipeId },
    select: { itemId: true },
  })
  const itemId = String(recipe?.itemId || "").trim()
  if (!itemId) return []

  const byItem = await db.itemVariation.findMany({
    where: { itemId, deletedAt: null },
    select: { id: true },
    orderBy: [{ createdAt: "asc" }],
  })
  if (byItem.length > 0) {
    await db.itemVariation.updateMany({
      where: { id: { in: byItem.map((row: { id: string }) => row.id) } },
      data: { recipeId },
    })
  }
  return byItem.map((row: { id: string }) => row.id)
}

export async function createRecipeCompositionIngredientSkeleton(params: {
  db: any
  recipeId: string
  itemId: string
  defaultUnit?: string
  defaultLossPct?: number
}): Promise<void> {
  const { db, recipeId, itemId, defaultUnit = "UN", defaultLossPct = 0 } = params

  if (!isNewCompositionModelAvailable(db)) {
    throw new Error("Modelo novo de composição indisponível")
  }

  const existing = await db.recipeIngredient.findUnique({
    where: { recipeId_ingredientItemId: { recipeId, ingredientItemId: itemId } },
    select: { id: true },
  })
  const sortOrderIndex = existing ? undefined : await countRecipeCompositionLines(db, recipeId)

  const recipeIngredient = existing || await db.recipeIngredient.create({
    data: {
      recipeId,
      ingredientItemId: itemId,
      defaultLossPct,
      sortOrderIndex: Number(sortOrderIndex || 0),
    },
    select: { id: true },
  })

  const targetItemVariationIds = await resolveTargetItemVariationIdsForRecipe(db, recipeId)
  for (const itemVariationId of targetItemVariationIds) {
    await db.recipeVariationIngredient.upsert({
      where: {
        recipeIngredientId_itemVariationId: {
          recipeIngredientId: recipeIngredient.id,
          itemVariationId,
        },
      },
      update: {
        unit: defaultUnit,
      },
      create: {
        recipeIngredientId: recipeIngredient.id,
        itemVariationId,
        unit: defaultUnit,
        quantity: 0,
        lossPct: null,
      },
    })
  }
}

export async function createRecipeCompositionLine(params: {
  db: any
  recipeId: string
  itemId: string
  unit: string
  quantity: number
  lossPct?: number | null
  snapshot?: Partial<CostSnapshot> | null
}): Promise<void> {
  const { db, recipeId, itemId, unit, quantity, lossPct = null, snapshot } = params
  void snapshot

  if (isNewCompositionModelAvailable(db)) {
    const ownerItemVariationId = await ensureOwnerItemVariationId(db, recipeId)
    if (!ownerItemVariationId) {
      throw new Error("Receita sem vínculo de item/variação para composição por variação")
    }
    const linkedVariations = await listRecipeLinkedVariations(db, recipeId)
    const targetItemVariationIds = linkedVariations.length > 0
      ? linkedVariations.map((row) => row.itemVariationId)
      : [ownerItemVariationId]

    const existing = await db.recipeIngredient.findUnique({
      where: { recipeId_ingredientItemId: { recipeId, ingredientItemId: itemId } },
      select: { id: true },
    })
    const sortOrderIndex = existing
      ? undefined
      : await countRecipeCompositionLines(db, recipeId)

    const recipeIngredient = existing || await db.recipeIngredient.create({
      data: {
        recipeId,
        ingredientItemId: itemId,
        sortOrderIndex: Number(sortOrderIndex || 0),
      },
      select: { id: true },
    })

    for (const itemVariationId of targetItemVariationIds) {
      await db.recipeVariationIngredient.upsert({
        where: {
          recipeIngredientId_itemVariationId: {
            recipeIngredientId: recipeIngredient.id,
            itemVariationId,
          },
        },
        update: {
          unit,
          quantity,
          lossPct,
        },
        create: {
          recipeIngredientId: recipeIngredient.id,
          itemVariationId,
          unit,
          quantity,
          lossPct,
        },
      })
    }
    return
  }

  if (typeof db?.recipeLine?.create !== "function") {
    throw new Error("Tabela de composição indisponível")
  }

  const recipeLineCount = await db.recipeLine.count({ where: { recipeId } })
  await db.recipeLine.create({
    data: {
      recipeId,
      itemId,
      itemVariationId: null,
      unit,
      quantity,
      sortOrderIndex: Number(recipeLineCount || 0),
    },
  })
}

export async function updateRecipeCompositionLine(params: {
  db: any
  lineId: string
  recipeId: string
  unit: string
  quantity: number
  lossPct?: number | null
  snapshot?: Partial<CostSnapshot> | null
}): Promise<void> {
  const { db, lineId, recipeId, unit, quantity, lossPct = null, snapshot } = params
  void snapshot

  if (isNewCompositionModelAvailable(db)) {
    const line = await db.recipeVariationIngredient.findUnique({
      where: { id: lineId },
      include: { RecipeIngredient: { select: { recipeId: true } } },
    })
    if (!line || line.RecipeIngredient.recipeId !== recipeId) throw new Error("Linha inválida")
    await db.recipeVariationIngredient.update({
      where: { id: lineId },
      data: {
        unit,
        quantity,
        lossPct,
      },
    })
    return
  }

  await db.recipeLine.update({
    where: { id: lineId },
    data: {
      unit,
      quantity,
    },
  })
}

export async function updateRecipeCompositionIngredientDefaultLoss(params: {
  db: any
  recipeId: string
  recipeIngredientId: string
  defaultLossPct: number
  applyToVariationLines?: boolean
}): Promise<void> {
  const { db, recipeId, recipeIngredientId, defaultLossPct, applyToVariationLines = false } = params
  if (!isNewCompositionModelAvailable(db)) return

  const ingredient = await db.recipeIngredient.findUnique({
    where: { id: recipeIngredientId },
    select: { id: true, recipeId: true },
  })
  if (!ingredient || ingredient.recipeId !== recipeId) throw new Error("Ingrediente inválido")

  await db.recipeIngredient.update({
    where: { id: recipeIngredientId },
    data: { defaultLossPct },
  })

  if (applyToVariationLines) {
    await db.recipeVariationIngredient.updateMany({
      where: { recipeIngredientId },
      data: { lossPct: defaultLossPct },
    })
  }
}

export async function updateRecipeCompositionLineItem(params: {
  db: any
  lineId: string
  recipeId: string
  itemId: string
  snapshot?: Partial<CostSnapshot> | null
  quantity: number
  unit: string
  lossPct?: number | null
}): Promise<void> {
  const { db, lineId, recipeId, itemId, snapshot, quantity, unit, lossPct = null } = params
  void snapshot

  if (isNewCompositionModelAvailable(db)) {
    const line = await db.recipeVariationIngredient.findUnique({
      where: { id: lineId },
      include: {
        RecipeIngredient: { select: { id: true, recipeId: true } },
      },
    })
    if (!line || line.RecipeIngredient.recipeId !== recipeId) throw new Error("Linha inválida")

    let targetRecipeIngredient = await db.recipeIngredient.findUnique({
      where: { recipeId_ingredientItemId: { recipeId, ingredientItemId: itemId } },
      select: { id: true },
    })

    if (!targetRecipeIngredient) {
      targetRecipeIngredient = await db.recipeIngredient.create({
        data: {
          recipeId,
          ingredientItemId: itemId,
          sortOrderIndex: Number(await countRecipeCompositionLines(db, recipeId)),
        },
        select: { id: true },
      })
    }

    await db.recipeVariationIngredient.upsert({
      where: {
        recipeIngredientId_itemVariationId: {
          recipeIngredientId: targetRecipeIngredient.id,
          itemVariationId: line.itemVariationId,
        },
      },
      update: {
        unit,
        quantity,
        lossPct,
      },
      create: {
        recipeIngredientId: targetRecipeIngredient.id,
        itemVariationId: line.itemVariationId,
        unit,
        quantity,
        lossPct,
      },
    })

    if (targetRecipeIngredient.id !== line.RecipeIngredient.id) {
      await db.recipeVariationIngredient.delete({ where: { id: lineId } })
      const remaining = await db.recipeVariationIngredient.count({
        where: { recipeIngredientId: line.RecipeIngredient.id },
      })
      if (remaining === 0) {
        await db.recipeIngredient.delete({ where: { id: line.RecipeIngredient.id } })
      }
    }
    return
  }

  await db.recipeLine.update({
    where: { id: lineId },
    data: {
      itemId,
      unit,
      quantity,
    },
  })
}

export async function deleteRecipeCompositionLine(db: any, lineId: string): Promise<void> {
  if (isNewCompositionModelAvailable(db)) {
    const line = await db.recipeVariationIngredient.findUnique({
      where: { id: lineId },
      select: { id: true, recipeIngredientId: true },
    })
    if (!line) return
    await db.recipeVariationIngredient.delete({ where: { id: line.id } })
    const remaining = await db.recipeVariationIngredient.count({
      where: { recipeIngredientId: line.recipeIngredientId },
    })
    if (remaining === 0) {
      await db.recipeIngredient.delete({ where: { id: line.recipeIngredientId } })
    }
    return
  }

  if (typeof db?.recipeLine?.delete === "function") {
    await db.recipeLine.delete({ where: { id: lineId } })
  }
}

export async function applyRecipeCompositionLineToVariations(params: {
  db: any
  recipeId: string
  lineId: string
  variationIds: string[]
  resolveCostByVariationId?: (variationId: string, itemId: string, quantity: number, lossPct: number) => Promise<CostSnapshot>
}): Promise<number> {
  const { db, recipeId, lineId, variationIds } = params

  if (!isNewCompositionModelAvailable(db)) return 0
  if (!Array.isArray(variationIds) || variationIds.length === 0) return 0

  const line = await db.recipeVariationIngredient.findUnique({
    where: { id: lineId },
    include: {
      RecipeIngredient: {
        select: {
          id: true,
          recipeId: true,
          ingredientItemId: true,
          defaultLossPct: true,
        },
      },
    },
  })
  if (!line || line.RecipeIngredient.recipeId !== recipeId) throw new Error("Linha inválida")

  const targets = await db.itemVariation.findMany({
    where: {
      recipeId,
      variationId: { in: variationIds },
      deletedAt: null,
    },
    select: { id: true, variationId: true },
  })

  let affected = 0
  for (const target of targets) {
    if (!target.variationId) continue
    await db.recipeVariationIngredient.upsert({
      where: {
        recipeIngredientId_itemVariationId: {
          recipeIngredientId: line.recipeIngredientId,
          itemVariationId: target.id,
        },
      },
      update: {
        unit: line.unit,
        quantity: Number(line.quantity || 0),
        lossPct: line.lossPct == null ? null : Number(line.lossPct),
      },
      create: {
        recipeIngredientId: line.recipeIngredientId,
        itemVariationId: target.id,
        unit: line.unit,
        quantity: Number(line.quantity || 0),
        lossPct: line.lossPct == null ? null : Number(line.lossPct),
      },
    })
    affected += 1
  }

  return affected
}
