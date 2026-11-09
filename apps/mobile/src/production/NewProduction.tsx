import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { getProductionOrders, submitProductionOrder } from "../api/client";
import { Text } from "../ui/Text";
import { compatibleUnits } from "../../../../shared/production/order-plan";
import { RecipeSearchPanel } from "../recipes/RecipeSearchPanel";
import { DayPicker } from "./DayPicker";
import { Action, Workflow, colors, dayKey, Empty, ErrorNotice, Field, labelDay, Lines, normalize, numeric, Panel, qty, relativeDay, s, Sheet, shiftDay } from "./order-ui";
import type { PreparationSuggestion, ProductionOrder, ProductionPlan, ProductionRecipe, ProductionRecipeSummary } from "./order-types";

const RECENT_KEY = "production:recent-recipe-searches";
const RECENT_LIMIT = 5;

export function NewProduction({ apiUrl, token, onCreated, onError, onBusyChange }: {
  apiUrl: string; token: string; onCreated: (order: ProductionOrder, suggestions: PreparationSuggestion[]) => void;
  onError: (error: unknown) => void; onBusyChange: (busy: boolean) => void;
}) {
  const { width, height } = useWindowDimensions();
  const wide = width >= 980;
  const splitSearch = width >= 800;
  const choiceColumns = width >= 1100 ? 2 : 1;
  const [recipes, setRecipes] = useState<ProductionRecipeSummary[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listRetry, setListRetry] = useState(0);
  const [picker, setPicker] = useState(false);
  const [basePicker, setBasePicker] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => {
    AsyncStorage.getItem(RECENT_KEY).then((raw) => {
      const list = raw ? JSON.parse(raw) : [];
      if (Array.isArray(list)) setRecent(list.filter((x) => typeof x === "string").slice(0, RECENT_LIMIT));
    }).catch(() => undefined);
  }, []);
  /** Guarda o texto buscado quando ele levou a uma receita escolhida. */
  function rememberSearch(text: string) {
    const value = text.trim();
    if (!value) return;
    setRecent((current) => {
      const next = [value, ...current.filter((x) => normalize(x) !== normalize(value))].slice(0, RECENT_LIMIT);
      AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }
  const [search, setSearch] = useState("");
  const [recipeId, setRecipeId] = useState("");
  const [recipe, setRecipe] = useState<ProductionRecipe | null>(null);
  const [recipeRetry, setRecipeRetry] = useState(0);
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [date, setDate] = useState<string | null>(null);
  const [usageDate, setUsageDate] = useState<string | null>(null);
  const [dayPick, setDayPick] = useState<"production" | "usage" | null>(null);
  const productionDay = date ?? dayKey();
  const [notes, setNotes] = useState("");
  const [plan, setPlan] = useState<ProductionPlan | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [previewRetry, setPreviewRetry] = useState(0);
  const [error, setError] = useState("");
  const [baseId, setBaseId] = useState("");
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);
  const [uncertainCreation, setUncertainCreation] = useState(false);
  const [previewKey, setPreviewKey] = useState("");
  const expectedPreviewKey = `${recipeId}:${baseId}:${quantity}:${unit}`;
  const base = recipe?.ingredients.find((i) => i.id === baseId);
  const onErrorRef = useRef(onError); onErrorRef.current = onError;

  useEffect(() => {
    const controller = new AbortController();
    setListLoading(true); setError("");
    getProductionOrders(apiUrl, token, "recipes=1", controller.signal).then((data) => {
      if (!controller.signal.aborted) setRecipes(data.recipes || []);
    }).catch((e) => { if (!controller.signal.aborted) { setError(e.message); onErrorRef.current(e); } })
      .finally(() => { if (!controller.signal.aborted) setListLoading(false); });
    return () => controller.abort();
  }, [apiUrl, token, listRetry]);
  useEffect(() => {
    setRecipe(null); setPlan(null); setUnit(""); setBaseId(""); setError("");
    if (!recipeId) return;
    const controller = new AbortController(); setRecipeLoading(true);
    getProductionOrders(apiUrl, token, `recipeId=${encodeURIComponent(recipeId)}`, controller.signal).then((data) => {
      if (controller.signal.aborted) return;
      setRecipe(data.recipe || null);
      const ingredient = data.recipe?.ingredients.find((i) => i.id === data.recipe?.baseIngredientId);
      setBaseId(ingredient?.id || "");
      setUnit(ingredient?.unit || "");
    }).catch((e) => { if (!controller.signal.aborted) { setError(e.message); onErrorRef.current(e); } })
      .finally(() => { if (!controller.signal.aborted) setRecipeLoading(false); });
    return () => controller.abort();
  }, [apiUrl, token, recipeId, recipeRetry]);
  useEffect(() => {
    setPlan(null); setPreviewError(""); setPreviewKey("");
    const amount = numeric(quantity);
    if (!recipe || !base || !Number.isFinite(amount) || amount <= 0) { setPreviewLoading(false); return; }
    const controller = new AbortController(); setPreviewLoading(true);
    const timer = setTimeout(() => {
      submitProductionOrder(apiUrl, token, { intent: "preview", recipeId: recipe.id, baseIngredientId: base.id, quantity: amount, unit }, controller.signal)
        .then((data) => { if (!controller.signal.aborted) { setPlan(data.plan || null); setPreviewKey(`${recipe.id}:${base.id}:${quantity}:${unit}`); } })
        .catch((e) => { if (!controller.signal.aborted) { setPreviewError(e.message); onErrorRef.current(e); } })
        .finally(() => { if (!controller.signal.aborted) setPreviewLoading(false); });
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [apiUrl, token, recipe, base, quantity, unit, previewRetry]);

  const canCreate = Boolean(plan && !plan.inconsistencies.length && previewKey === expectedPreviewKey && !previewLoading && !creating && !uncertainCreation);
  async function create() {
    if (!canCreate || creatingRef.current) return;
    creatingRef.current = true; setCreating(true); onBusyChange(true); setError("");
    try {
      const data = await submitProductionOrder(apiUrl, token, { intent: "create", recipeId, baseIngredientId: baseId, quantity: numeric(quantity), unit, date: date ?? dayKey(), usageDate: usageDate && usageDate > (date ?? dayKey()) ? usageDate : null, notes });
      if (!data.order) throw new Error("Não foi possível confirmar o resultado. Confira a lista de produções.");
      onCreated(data.order, data.suggestions || []);
    } catch (e) {
      // Uma queda de conexão pode ocorrer depois de salvar. Evita reenviar a criação às cegas.
      const validation = e && typeof e === "object" && "status" in e && Number(e.status) >= 400 && Number(e.status) < 500;
      if (!validation) setUncertainCreation(true);
      setError(e instanceof Error ? e.message : "Não foi possível criar a produção."); onErrorRef.current(e);
    } finally { creatingRef.current = false; setCreating(false); onBusyChange(false); }
  }
  const form = <Panel>
    <Text style={s.label}>Receita</Text>
    <Action secondary label={recipes.find((r) => r.id === recipeId)?.name || "Buscar receita"} disabled={creating || listLoading} onPress={() => { setSearch(""); setPicker(true); }} />
    {listLoading || recipeLoading ? <ActivityIndicator color={colors.yellow} accessibilityLabel="Carregando receitas" /> : null}
    {!listLoading && !recipes.length ? <Action secondary compact label="Carregar receitas novamente" onPress={() => setListRetry((n) => n + 1)} /> : null}
    {recipeId && !recipe && !recipeLoading ? <Action secondary compact label="Tentar carregar receita" onPress={() => setRecipeRetry((n) => n + 1)} /> : null}
    {recipe && !recipe.ingredients.length ? <Text style={{ color: colors.red }}>Esta receita ainda não tem ingredientes. Complete a receita na administração.</Text> : null}
    {recipe?.ingredients.length ? <>
      <Text style={s.label}>Quantidade da produção</Text>
      <Action secondary label={base ? `${base.name}${numeric(quantity) > 0 ? ` · ${quantity} ${unit.toLowerCase()}` : ""} ▾` : "Escolher ingrediente"} disabled={creating} onPress={() => setBasePicker(true)} />
    </> : null}
    <View style={{ gap: 10, paddingTop: 8 }}>
      <Text style={s.label}>Produzir em</Text>
      <Action secondary label={`${relativeDay(productionDay)} · ${labelDay(productionDay)} ▾`} disabled={creating} onPress={() => setDayPick("production")} />
    </View>
    <View style={{ gap: 10 }}>
      <Text style={s.label}>Usar em</Text>
      <Text style={s.hint}>Para qual dia é esta produção? Ex.: biga feita hoje para a massa de amanhã.</Text>
      <Action secondary label={usageDate ? `${relativeDay(usageDate)} · ${labelDay(usageDate)} ▾` : "Mesmo dia da produção ▾"} disabled={creating} onPress={() => setDayPick("usage")} />
      <View style={[s.row, { flexWrap: "wrap", gap: 8 }]}>
        <Pressable disabled={creating} accessibilityRole="button" accessibilityState={{ selected: !usageDate }} onPress={() => setUsageDate(null)}
          style={[s.action, s.compactAction, { backgroundColor: !usageDate ? colors.yellow : colors.raised }]}><Text style={[s.actionText, { fontSize: 16, color: !usageDate ? colors.bg : colors.text }]}>Mesmo dia</Text></Pressable>
        <Pressable disabled={creating} accessibilityRole="button" accessibilityState={{ selected: usageDate === shiftDay(productionDay, 1) }} onPress={() => setUsageDate(shiftDay(productionDay, 1))}
          style={[s.action, s.compactAction, { backgroundColor: usageDate === shiftDay(productionDay, 1) ? colors.yellow : colors.raised }]}><Text style={[s.actionText, { fontSize: 16, color: usageDate === shiftDay(productionDay, 1) ? colors.bg : colors.text }]}>Dia seguinte</Text></Pressable>
      </View>
    </View>
    <Field label="Observação (opcional)" value={notes} onChangeText={setNotes} editable={!creating} placeholder="Ex.: separar em duas porções" multiline />
  </Panel>;
  const preview = <View style={s.stack}>
    <Text style={s.sectionTitle}>Ingredientes desta produção</Text>
    {previewLoading ? <ActivityIndicator color={colors.yellow} accessibilityLabel="Calculando quantidades" /> : null}
    <ErrorNotice message={previewError} />
    {previewError ? <Action secondary label="Calcular novamente" onPress={() => setPreviewRetry((n) => n + 1)} /> : null}
    {plan && previewKey === expectedPreviewKey ? <>
      <Text style={s.hint}>{recipe?.name} · na próxima etapa você informa as preparações intermediárias.</Text>
      <ErrorNotice message={plan.inconsistencies.join(" ")} /><Lines lines={plan.totals} />
    </> : !previewLoading ? <Empty title="Escolha a receita, o ingrediente-base e a quantidade" description="Os ingredientes da produção vão aparecer aqui." /> : null}
  </View>;
  const recentSearches = recent.length ? <View style={{ gap: 8 }}>
    <Text style={s.hint}>Buscas recentes</Text>
    {recent.map((text) => <Pressable key={text} accessibilityRole="button" accessibilityLabel={`Buscar ${text} novamente`} onPress={() => setSearch(text)}
      style={({ pressed }) => [s.action, s.compactAction, { alignSelf: "stretch", justifyContent: "flex-start", backgroundColor: colors.raised }, pressed && s.dim]}>
      <Text numberOfLines={1} style={[s.actionText, { color: colors.text, fontWeight: "500" }]}>{text}</Text></Pressable>)}
  </View> : null;
  const matchingRecipes = recipes.filter((r) => normalize(r.name).includes(normalize(search.trim())));
  const recipeChoice = (item: ProductionRecipeSummary, grid = false) => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Selecionar ${item.name}`}
    onPress={() => { rememberSearch(search); setRecipeId(item.id); setPicker(false); setQuantity(""); }}
    style={({ pressed }) => [s.panel, grid && { flex: 1, maxWidth: choiceColumns === 2 ? "49%" : "100%" }, { minHeight: 120, backgroundColor: item.id === recipeId ? colors.raised : colors.panel }, pressed && s.dim]}>
    <View style={s.row}><Text style={[s.sectionTitle, s.flex]}>{item.name}{item.id === recipeId ? " ✓" : ""}</Text><Text style={{ color: colors.yellow, fontSize: 26 }}>›</Text></View>
    <Text style={s.hint}>{item.status === "draft" ? "Rascunho" : "Pronta para produzir"}</Text>
  </Pressable>;
  return <View style={s.body}>
    <Workflow phase={0} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.scroll}>
      <View style={[s.stack, wide && { flexDirection: "row", alignItems: "flex-start" }]}>
        <View style={wide ? { width: 340 } : undefined}>{form}</View>
        <View style={wide ? { flex: 1, minWidth: 0 } : undefined}>{preview}</View>
      </View>
      <ErrorNotice message={error} />
      {uncertainCreation ? <Text style={{ color: colors.yellow, fontSize: 16 }}>Volte à lista e confira se a produção foi criada antes de tentar novamente.</Text> : null}
    </ScrollView>
    <View style={s.footer}>
      <Text style={[s.hint, { flex: 1 }]}>A ordem será salva. A seguir, defina as preparações.</Text>
      <Action label={creating ? "Criando produção…" : "Criar e continuar"} disabled={!canCreate} onPress={() => void create()} />
    </View>
    {dayPick ? <DayPicker value={dayPick === "usage" ? usageDate ?? productionDay : productionDay}
      onChange={(day) => {
        if (dayPick === "usage") setUsageDate(day <= productionDay ? null : day);
        else { setDate(day); setUsageDate((u) => u && u <= day ? null : u); }
      }} onClose={() => setDayPick(null)} /> : null}
    {basePicker && recipe ? <Sheet title="Ingrediente-base e quantidade" maxWidth={wide ? 1000 : 740} onClose={() => setBasePicker(false)}
      footer={<Action label="Confirmar" disabled={!base} onPress={() => setBasePicker(false)} />}>
      <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: Math.min(680, height - 220) }} contentContainerStyle={s.scroll}>
        <View style={[s.stack, wide && { flexDirection: "row", alignItems: "flex-start" }]}>
          <View style={[s.stack, wide && { flex: 1 }]}>
            <Text style={s.label}>Qual ingrediente define a quantidade?</Text>
            <Text style={s.hint}>Os demais são calculados em proporção.</Text>
            {recipe.ingredients.map((i) => <Pressable key={i.id} accessibilityRole="button" accessibilityLabel={`Usar ${i.name} como base`} accessibilityState={{ selected: baseId === i.id }}
              onPress={() => { if (baseId !== i.id) { setBaseId(i.id); setUnit(i.unit); } }}
              style={({ pressed }) => [s.panel, { minHeight: 64, justifyContent: "center", borderColor: baseId === i.id ? colors.yellow : colors.line, backgroundColor: baseId === i.id ? colors.raised : colors.panel }, pressed && s.dim]}>
              <View style={s.row}><Text style={[s.label, s.flex]}>{i.name}{baseId === i.id ? " ✓" : ""}</Text><Text style={s.hint}>{qty(i.quantity, i.unit)} na receita</Text></View>
            </Pressable>)}
          </View>
          <View style={[s.stack, wide && { width: 340 }]}>
            {base ? <>
              <Text style={s.label}>Quanto de {base.name}?</Text>
              <Field value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" selectTextOnFocus placeholder="0" editable={!creating} accessibilityLabel={`Quantidade de ${base.name}`} style={{ fontSize: 36, fontWeight: "700", minHeight: 76 }} />
              <View style={s.row}>{compatibleUnits(base.unit).map((u) => <Pressable key={u} disabled={creating} accessibilityRole="button" accessibilityLabel={`Usar ${u.toLowerCase()}`} accessibilityState={{ selected: unit === u }} onPress={() => setUnit(u)}
                style={[s.action, { minWidth: 88, backgroundColor: unit === u ? colors.yellow : colors.raised }]}><Text style={[s.actionText, { color: unit === u ? colors.bg : colors.text }]}>{u.toLowerCase()}</Text></Pressable>)}</View>
            </> : <Text style={s.hint}>Escolha o ingrediente para informar a quantidade.</Text>}
          </View>
        </View>
      </ScrollView>
    </Sheet> : null}
    {picker ? <Sheet title="Escolher receita" maxWidth={1100} onClose={() => setPicker(false)}>
      <View style={{ height: Math.min(720, height - 160), minHeight: 240 }}>
        {splitSearch ? <View style={{ flex: 1, flexDirection: "row", minHeight: 0 }}>
          <ScrollView style={{ width: 280, flexGrow: 0, backgroundColor: "#181818", borderRightWidth: 1, borderColor: colors.line }} keyboardShouldPersistTaps="handled" contentContainerStyle={s.scroll}>
            {recentSearches}
            <RecipeSearchPanel value={search} onChange={setSearch} />
          </ScrollView>
          <FlatList key={choiceColumns} numColumns={choiceColumns} columnWrapperStyle={choiceColumns > 1 ? { gap: 12 } : undefined} style={s.flex} contentContainerStyle={{ padding: 20, gap: 12 }}
            ListHeaderComponent={<Text style={s.hint} accessibilityLiveRegion="polite">{matchingRecipes.length} receitas</Text>}
            data={matchingRecipes} keyExtractor={(r) => r.id} keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Empty title="Nenhuma receita encontrada" description="Tente buscar por outra parte do nome." />}
            renderItem={({ item }) => recipeChoice(item, true)} />
        </View> : <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.scroll}>
          {recentSearches}
          <RecipeSearchPanel value={search} onChange={setSearch} />
          <Text style={s.hint} accessibilityLiveRegion="polite">{matchingRecipes.length} receitas</Text>
          {matchingRecipes.map((item) => recipeChoice(item))}
          {!matchingRecipes.length ? <Empty title="Nenhuma receita encontrada" description="Tente buscar por outra parte do nome." /> : null}
        </ScrollView>}
      </View>
    </Sheet> : null}
  </View>;
}
