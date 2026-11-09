import { useRef, useState } from "react";
import { FlatList, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { compatibleUnits, convertQuantity } from "../../../../shared/production/order-plan";
import { previewRecipePreparations } from "./preparation-preview";
import { Text } from "../ui/Text";
import { submitProductionOrder } from "../api/client";
import { qty, normalize, numeric, Action, ErrorNotice, Field, Sheet, colors, s, Empty, stepColors } from "./order-ui";
import type { ProductionRecipe } from "./order-types";

const PREPARATION_NAMES = ["Tangzhong", "Biga", "Poolish", "Autólise"];

type Draft = { key: number; name: string; notes: string; ingredients: { recipeIngredientId: string; quantity: string; unit: string }[] };
export function RecipeProductionEditor({ recipe, apiUrl, token, onSaved, onClose, onError, onBusyChange }: {
  recipe: ProductionRecipe; apiUrl: string; token: string; onSaved: (recipe: ProductionRecipe) => void;
  onClose: () => void; onError: (error: unknown) => void; onBusyChange: (busy: boolean) => void;
}) {
  const wide = useWindowDimensions().width >= 900;
  const [namePicker, setNamePicker] = useState(false);
  const [customNameKey, setCustomNameKey] = useState<number | null>(null);
  const [selectedKey, setSelectedKey] = useState<number | null>(null);
  const [baseId, setBaseId] = useState(recipe.baseIngredientId || "");
  const [preparations, setPreparations] = useState<Draft[]>(() => recipe.preparations.map((p, key) => ({
    key, name: p.name, notes: p.notes || "", ingredients: p.ingredients.map((line) => ({
      ...line, quantity: String(line.quantity).replace(".", ","), unit: recipe.ingredients.find((i) => i.id === line.recipeIngredientId)?.unit || "",
    })),
  })));
  const nextKey = useRef(preparations.length);
  const [choosing, setChoosing] = useState<"base" | number | null>(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState("");
  function change(key: number, update: Partial<Draft>) {
    setPreparations((rows) => rows.map((row) => row.key === key ? { ...row, ...update } : row));
  }
  async function save() {
    if (savingRef.current || invalidDraft) return;
    savingRef.current = true; setSaving(true); onBusyChange(true); setError("");
    try {
      const result = await submitProductionOrder(apiUrl, token, { intent: "save-recipe", recipeId: recipe.id,
        baseIngredientId: baseId, preparations: preparations.map((p) => ({ name: p.name, notes: p.notes,
          ingredients: p.ingredients.map((line) => ({ ...line, quantity: numeric(line.quantity) })),
        })),
      });
      if (result.recipe) onSaved(result.recipe);
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar."); onError(e); }
    finally { savingRef.current = false; setSaving(false); onBusyChange(false); }
  }
  const currentPrep = preparations.find((p) => p.key === choosing);
  const available = recipe.ingredients.filter((i) => normalize(i.name).includes(normalize(search)) &&
    (choosing === "base" || !currentPrep?.ingredients.some((line) => line.recipeIngredientId === i.id)));
  let draftPlan: ReturnType<typeof previewRecipePreparations> | null = null;
  let previewError = "";
  try {
    draftPlan = previewRecipePreparations(recipe, preparations.map((p) => ({
      name: p.name, ingredients: p.ingredients.map((line) => ({ ...line, quantity: numeric(line.quantity) })),
    })));
    previewError = draftPlan.inconsistencies.join(" ");
  } catch (e) { previewError = e instanceof Error ? e.message : "Confira as quantidades."; }
  const invalidDraft = Boolean(previewError) || preparations.some((p) => !p.name.trim());
  const selected = preparations.find((p) => p.key === selectedKey) || preparations[0];
  function addPreparation() {
    const key = nextKey.current++;
    setPreparations((rows) => [...rows, { key, name: "", notes: "", ingredients: [] }]);
    setSelectedKey(key);
    setNamePicker(true);
  }
  const navigation = <View style={s.stack}>
    <Text style={s.label}>Preparações separadas</Text>
    {preparations.map((p, index) => <Pressable key={p.key} accessibilityRole="button" accessibilityState={{ selected: selected?.key === p.key }} disabled={saving}
      onPress={() => setSelectedKey(p.key)} style={({ pressed }) => [s.panel, { borderLeftWidth: 4, borderLeftColor: stepColors[index % stepColors.length], backgroundColor: selected?.key === p.key ? colors.raised : colors.panel }, pressed && s.dim]}>
      <Text style={s.label}>{p.name.trim() || `Preparação ${index + 1}`}</Text><Text style={s.hint}>{p.ingredients.length} ingredientes</Text>
    </Pressable>)}
    <Action secondary compact label="+ Preparação" onPress={addPreparation} disabled={saving} />
    <Text style={s.hint}>O que não for usado nas preparações entra na mistura final.</Text>
  </View>;
  const content = selected ? <View style={s.panel}>
    <Text style={s.label}>Tipo de preparação</Text>
    <Action secondary label={`${selected.name || "Escolher preparação"} ▾`} disabled={saving} onPress={() => setNamePicker(true)} />
    {customNameKey === selected.key || (selected.name && !PREPARATION_NAMES.includes(selected.name)) ?
      <Field label="Nome personalizado" value={selected.name} onChangeText={(name) => change(selected.key, { name })} placeholder="Nome da preparação" editable={!saving} /> : null}
    <Text style={s.hint}>Informe as quantidades da receita original que serão usadas nesta preparação. O sistema ajusta tudo quando você cria a produção.</Text>
    {selected.ingredients.map((line) => {
      const ingredient = recipe.ingredients.find((i) => i.id === line.recipeIngredientId);
      return <View key={line.recipeIngredientId} style={{ paddingVertical: 16, gap: 12, borderBottomWidth: 1, borderColor: colors.line }}>
        <View style={s.row}><View style={s.flex}><Text style={s.label}>{ingredient?.name}</Text>
          <Text style={s.hint}>Total na receita: {ingredient ? qty(ingredient.quantity, ingredient.unit) : "—"}</Text></View>
          <Pressable disabled={saving} accessibilityRole="button" accessibilityLabel={`Remover ${ingredient?.name || "ingrediente"}`} style={s.close}
            onPress={() => change(selected.key, { ingredients: selected.ingredients.filter((l) => l !== line) })}><Text style={s.closeText}>×</Text></Pressable>
        </View>
        <View style={s.row}><View style={{ width: 180, maxWidth: "75%" }}><Field value={line.quantity} keyboardType="decimal-pad" placeholder="0"
          accessibilityLabel={`Quantidade de ${ingredient?.name} em ${line.unit}`} editable={!saving}
          onChangeText={(quantity) => change(selected.key, { ingredients: selected.ingredients.map((l) => l === line ? { ...l, quantity } : l) })} /></View>
          <View style={[s.row, { flexWrap: "wrap", gap: 8, flexShrink: 1 }]}>
            {compatibleUnits(ingredient?.unit || line.unit).map((unit) => <Pressable key={unit} accessibilityRole="button"
              accessibilityLabel={`Usar ${unit.toLowerCase()} para ${ingredient?.name}`} accessibilityState={{ selected: line.unit.toUpperCase() === unit }} disabled={saving}
              onPress={() => {
                const converted = convertQuantity(numeric(line.quantity), line.unit, unit);
                change(selected.key, { ingredients: selected.ingredients.map((l) => l === line ? { ...l, unit,
                  quantity: !line.quantity.trim() ? "" : converted == null ? line.quantity : String(Number(converted.toPrecision(12))).replace(".", ","),
                } : l) });
              }} style={[s.action, s.compactAction, { minWidth: 60, backgroundColor: line.unit.toUpperCase() === unit ? colors.yellow : colors.raised }]}>
              <Text style={[s.actionText, { color: line.unit.toUpperCase() === unit ? colors.bg : colors.text }]}>{unit.toLowerCase()}</Text>
            </Pressable>)}
          </View>
        </View>
        {draftPlan ? <Text style={s.hint}>Na mistura final: {qty(draftPlan.final.ingredients.find((i) => i.id === line.recipeIngredientId)?.quantity || 0, ingredient?.unit || line.unit)}</Text> : null}
      </View>;
    })}
    <View style={{ gap: 8, paddingVertical: 12 }}>
      <Text style={s.label}>Conferência da receita</Text>
      <Text style={s.hint}>As quantidades usadas em todas as preparações são descontadas da mistura final, sem duplicar ingredientes.</Text>
      {draftPlan?.final.ingredients.map((line) => <View key={line.id} style={[s.row, { justifyContent: "space-between", flexWrap: "wrap" }]}>
        <Text style={s.hint}>{line.name}</Text><Text style={{ color: colors.green, fontSize: 17 }}>{qty(line.quantity, line.unit)} na mistura final</Text>
      </View>)}
      <ErrorNotice message={previewError} />
    </View>
    <Action compact secondary label="+ Ingrediente" disabled={saving} onPress={() => { setSearch(""); setChoosing(selected.key); }} />
    <Field label="Como preparar (opcional)" value={selected.notes} onChangeText={(notes) => change(selected.key, { notes })} editable={!saving} multiline style={{ minHeight: 120, textAlignVertical: "top" }} />
    <Action compact secondary danger label="Remover preparação" disabled={saving} onPress={() => { setPreparations((rows) => rows.filter((row) => row.key !== selected.key)); setSelectedKey(null); }} />
  </View> : <Empty title="Tudo vai para a mistura final" description="Se uma parte é preparada antes, como biga ou tangzhong, adicione uma preparação e separe os ingredientes dela.">
    <Action label="Adicionar preparação" onPress={addPreparation} disabled={saving} />
  </Empty>;
  return <View style={s.body}>
    <View style={{ padding: 16, gap: 12, borderBottomWidth: 1, borderColor: colors.line }}>
      <Text style={s.sectionTitle}>{recipe.name}</Text>
      <View style={[s.row, { flexWrap: "wrap" }]}>
        <Text style={s.hint}>Ingrediente principal: {recipe.ingredients.find((i) => i.id === baseId)?.name || "a escolher"}</Text>
        <Action secondary compact label={baseId ? "Alterar ingrediente principal" : "Escolher ingrediente principal"}
          onPress={() => { setSearch(""); setChoosing("base"); }} disabled={saving} />
      </View>
      <Text style={s.hint}>Configuração da receita para as próximas produções. As produções já criadas continuam iguais.</Text>
    </View>
    {wide ? <View style={[s.body, { flexDirection: "row" }]}>
      <ScrollView style={{ width: 280, flexGrow: 0, borderRightWidth: 1, borderColor: colors.line }} contentContainerStyle={s.scroll}>{navigation}</ScrollView>
      <ScrollView keyboardShouldPersistTaps="handled" style={s.flex} contentContainerStyle={s.scroll}>{content}<ErrorNotice message={error} /></ScrollView>
    </View> : <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.scroll}>{navigation}{content}<ErrorNotice message={error} /></ScrollView>}
    <View style={s.footer}>
      <Action secondary label="Voltar" disabled={saving} onPress={onClose} />
      <Action label={saving ? "Salvando…" : "Salvar configuração"} onPress={() => void save()} disabled={!baseId || saving || invalidDraft} />
    </View>
    {namePicker && selected ? <Sheet title="Tipo de preparação" onClose={() => setNamePicker(false)}>
      <ScrollView contentContainerStyle={s.scroll}>
        {PREPARATION_NAMES.map((name) => <Pressable key={name} accessibilityRole="button" accessibilityState={{ selected: selected.name === name }}
          onPress={() => { change(selected.key, { name }); setCustomNameKey(null); setNamePicker(false); }}
          style={[s.panel, { minHeight: 64, borderColor: selected.name === name ? colors.yellow : colors.line }]}>
          <Text style={s.label}>{name}{selected.name === name ? " ✓" : ""}</Text>
        </Pressable>)}
        <Action secondary label="Nome personalizado" onPress={() => {
          if (PREPARATION_NAMES.includes(selected.name)) change(selected.key, { name: "" });
          setCustomNameKey(selected.key); setNamePicker(false);
        }} />
      </ScrollView>
    </Sheet> : null}
    {choosing !== null ? <Sheet title={choosing === "base" ? "Ingrediente principal" : "Adicionar ingrediente"} onClose={() => setChoosing(null)}>
      <View style={{ maxHeight: 440 }}>
        <View style={{ padding: 16 }}><Field value={search} onChangeText={setSearch} placeholder="Buscar ingrediente" accessibilityLabel="Buscar ingrediente" /></View>
        <FlatList keyboardShouldPersistTaps="handled" data={available} keyExtractor={(i) => i.id}
          ListEmptyComponent={<Text style={[s.hint, { padding: 20 }]}>Nenhum ingrediente encontrado.</Text>}
          renderItem={({ item }) => <Pressable accessibilityRole="button" onPress={() => {
            if (choosing === "base") setBaseId(item.id);
            else if (currentPrep) change(currentPrep.key, { ingredients: [...currentPrep.ingredients, { recipeIngredientId: item.id, quantity: "", unit: item.unit }] });
            setChoosing(null); setSearch("");
          }} style={{ padding: 20, minHeight: 72, borderBottomWidth: 1, borderColor: colors.line }}>
            <Text style={s.label}>{item.name}</Text><Text style={s.hint}>Total da receita: {qty(item.quantity, item.unit)}</Text>
          </Pressable>} />
      </View>
    </Sheet> : null}
  </View>;
}
