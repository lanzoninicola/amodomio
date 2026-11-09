import { useRef, useState } from "react";
import { Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { applyPreparationsToPlan, compatibleUnits, convertQuantity } from "../../../../shared/production/order-plan";
import { Text } from "../ui/Text";
import { CalculatorSheet } from "./Calculator";
import { qty, numeric, Action, ErrorNotice, Field, Sheet, colors, s, stepColors, Workflow, FadeContent } from "./order-ui";
import type { PreparationSuggestion, ProductionMutation, ProductionOrder } from "./order-types";

const PREPARATION_NAMES = ["Tangzhong", "Biga", "Poolish", "Levain", "Autólise", "Pré-massa"];
type Draft = { key: number; name: string; ingredients: { recipeIngredientId: string; quantity: string; unit: string }[] };

/** Quanto de 0,5 kg aparece como 500 g para facilitar a digitação. */
function toInput(quantity: number, unit: string) {
  const u = unit.toUpperCase();
  const [value, shown] = u === "KG" && quantity < 1 ? [quantity * 1000, "G"] : u === "L" && quantity < 1 ? [quantity * 1000, "ML"] : [quantity, u];
  return { quantity: String(Number(value.toFixed(4))).replace(".", ","), unit: shown };
}

const PERCENT = "%";
type Total = { quantity: number; unit: string };
/** Quantidade digitada (absoluta ou %) na unidade do total da produção. */
function toTotalUnit(value: number, unit: string, total: Total) {
  if (!Number.isFinite(value)) return null;
  return unit === PERCENT ? (value / 100) * total.quantity : convertQuantity(value, unit, total.unit);
}
function fromTotalUnit(value: number, unit: string, total: Total) {
  return unit === PERCENT ? (total.quantity > 0 ? (value / total.quantity) * 100 : null) : convertQuantity(value, total.unit, unit);
}

/** Fase 2: o funcionário informa se há preparações intermediárias e monta cada uma. */
export function OrderPreparationsStep({ order, suggestions, busy, onAction, onCancel }: {
  order: ProductionOrder; suggestions: PreparationSuggestion[]; busy: boolean; onAction: (body: ProductionMutation) => void; onCancel?: () => void;
}) {
  const wide = useWindowDimensions().width >= 900;
  const totals = order.plan.totals;
  const nextKey = useRef(suggestions.length);
  const [has, setHas] = useState<boolean | null>(suggestions.length ? true : null);
  const [saveToRecipe, setSaveToRecipe] = useState(false);
  const [selectedKey, setSelectedKey] = useState<number | null>(null);
  const [namePicker, setNamePicker] = useState(false);
  const [showOverview, setShowOverview] = useState(false);
  const [calculator, setCalculator] = useState(false);
  const [explainId, setExplainId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>(() => suggestions.map((p, key) => ({
    key, name: p.name, ingredients: p.ingredients.map((l) => {
      const v = toInput(l.quantity, l.unit); return { recipeIngredientId: l.recipeIngredientId, quantity: v.quantity, unit: v.unit };
    }),
  })));
  const selected = drafts.find((d) => d.key === selectedKey) || drafts[0];
  /** Cola da área de transferência o primeiro número encontrado (ex.: o resultado da calculadora). */
  async function pasteQuantity(key: number, ingredientId: string) {
    try {
      // Carregado sob demanda: em um APK sem o módulo nativo, só o botão falha.
      const Clipboard = require("expo-clipboard") as typeof import("expo-clipboard");
      const match = (await Clipboard.getStringAsync()).match(/\d+(?:[.,]\d+)?/);
      if (!match) return;
      const quantity = match[0].replace(".", ",");
      setDrafts((rows) => rows.map((r) => r.key === key ? { ...r, ingredients: r.ingredients.map((l) => l.recipeIngredientId === ingredientId ? { ...l, quantity } : l) } : r));
    } catch { /* sem acesso à área de transferência */ }
  }
  const change = (key: number, update: Partial<Draft>) => setDrafts((rows) => rows.map((r) => r.key === key ? { ...r, ...update } : r));
  const send = (list: Draft[]) => onAction({ intent: "define-preparations", id: order.id, saveToRecipe: list.length > 0 && saveToRecipe,
    preparations: list.map((p) => ({ name: p.name, ingredients: p.ingredients.map((l) => {
      const total = totals.find((t) => t.id === l.recipeIngredientId);
      const value = numeric(l.quantity || "0");
      return { recipeIngredientId: l.recipeIngredientId, quantity: (total && toTotalUnit(value, l.unit, total)) ?? value, unit: total && toTotalUnit(value, l.unit, total) != null ? total.unit : l.unit };
    }) })) });

  let preview: ReturnType<typeof applyPreparationsToPlan> | null = null;
  let previewError = "";
  try {
    preview = applyPreparationsToPlan(order.plan, drafts.map((p, index) => ({ id: String(index), name: p.name || `Preparação ${index + 1}`,
      ingredients: p.ingredients.map((l) => {
        const total = totals.find((t) => t.id === l.recipeIngredientId);
        const value = numeric(l.quantity || "0");
        const converted = total ? toTotalUnit(value, l.unit, total) : null;
        if (converted == null) throw new Error("Confira as quantidades e unidades.");
        return { recipeIngredientId: l.recipeIngredientId, quantity: converted };
      }) })));
    previewError = preview.inconsistencies.join(" ");
  } catch (e) { previewError = e instanceof Error ? e.message : "Confira as quantidades."; }
  const nameless = drafts.findIndex((p) => !p.name.trim());
  const empty = drafts.findIndex((p) => !p.ingredients.some((l) => numeric(l.quantity || "0") > 0));
  const label = (index: number) => drafts[index].name.trim() || `Preparação ${index + 1}`;
  const blockReason = previewError
    || (!drafts.length ? "Adicione uma preparação." : "")
    || (nameless >= 0 ? `Escolha o nome da preparação ${nameless + 1}.` : "")
    || (empty >= 0 ? `Informe a quantidade de ao menos um ingrediente em ${label(empty)}.` : "");
  const invalid = Boolean(blockReason);
  /** Quanto de cada ingrediente já foi usado somando todas as preparações. */
  const usedOf = (id: string) => {
    const total = totals.find((t) => t.id === id);
    if (!total) return 0;
    return drafts.reduce((sum, p) => sum + p.ingredients.filter((l) => l.recipeIngredientId === id)
      .reduce((acc, l) => acc + (toTotalUnit(numeric(l.quantity || "0"), l.unit, total) ?? 0), 0), 0);
  };

  if (has === null) return <ScrollView contentContainerStyle={s.scroll}>
    <Workflow phase={1} />
    <View style={s.panel}>
      <Text style={s.sectionTitle}>Esta produção tem preparações intermediárias?</Text>
      <Text style={s.hint}>Biga, poolish, tangzhong, autólise, levain… Se não houver, vá direto para a mistura final.</Text>
      <Action label="Sim, montar preparações" disabled={busy} onPress={() => { nextKey.current = 1; setDrafts([{ key: 0, name: "", ingredients: [] }]); setHas(true); setNamePicker(true); }} />
      <Action secondary label="Não, só mistura final" disabled={busy} onPress={() => send([])} />
    </View>
  </ScrollView>;

  const nav = <View style={s.stack}>
    <Text style={s.label}>Preparações</Text>
    {drafts.map((p, index) => <Pressable key={p.key} accessibilityRole="button" accessibilityState={{ selected: selected?.key === p.key }} disabled={busy}
      onPress={() => setSelectedKey(p.key)} style={({ pressed }) => [s.panel, { borderLeftWidth: 4, borderLeftColor: stepColors[p.key % stepColors.length], backgroundColor: selected?.key === p.key ? colors.raised : colors.panel }, pressed && s.dim]}>
      <View style={s.row}><View style={s.flex}><Text style={s.label}>{p.name.trim() || `Preparação ${index + 1}`}</Text><Text style={s.hint}>{p.ingredients.length} ingredientes</Text></View>
        <Pressable disabled={busy} accessibilityRole="button" accessibilityLabel={`Remover preparação ${p.name.trim() || index + 1}`} style={s.close}
          onPress={() => { setDrafts((r) => r.filter((x) => x.key !== p.key)); setSelectedKey(null); }}><Text style={[s.closeText, { color: colors.red }]}>🗑</Text></Pressable></View>
    </Pressable>)}
    <Action secondary compact label="+ Preparação" disabled={busy} onPress={() => { const key = nextKey.current++; setDrafts((r) => [...r, { key, name: "", ingredients: [] }]); setSelectedKey(key); setNamePicker(true); }} />
    <Action secondary compact label="Não há preparações" disabled={busy} onPress={() => { setHas(null); setDrafts([]); }} />
    <View style={[s.panel, { borderLeftWidth: 4, borderLeftColor: colors.green }]}>
      <Text style={s.label}>Mistura final</Text>
      <Text style={s.hint}>O que sobra depois de todas as preparações.</Text>
      {totals.map((t) => {
        const rest = t.quantity - usedOf(t.id);
        return <View key={t.id} style={[s.row, { justifyContent: "space-between", gap: 8 }]}>
          <Text style={[s.hint, s.flex]}>{t.name}</Text>
          <Text style={{ color: rest < -1e-6 ? colors.red : colors.green, fontSize: 17, fontWeight: "600" }}>{rest < -1e-6 ? `Excesso de ${qty(-rest, t.unit)}` : qty(Math.max(rest, 0), t.unit)}</Text>
        </View>;
      })}
    </View>
  </View>;
  const content = selected ? <FadeContent changeKey={String(selected.key)}><View style={s.panel}>
    <Text style={s.eyebrow}>EDITANDO PREPARAÇÃO</Text><Text style={s.sectionTitle}>{selected.name || "Nova preparação"}</Text>
    {!PREPARATION_NAMES.includes(selected.name) ? <Field label="Nome da preparação" value={selected.name} onChangeText={(name) => change(selected.key, { name })} editable={!busy} /> : null}
    {totals.map((total) => {
      const line = selected.ingredients.find((l) => l.recipeIngredientId === total.id);
      const color = stepColors[selected.key % stepColors.length];
      const active = Boolean(line);
      const over = usedOf(total.id) > total.quantity + 1e-6;
      const inPrep = line ? toTotalUnit(numeric(line.quantity || "0"), line.unit, total) : null;
      const addLine = () => change(selected.key, { ingredients: [...selected.ingredients, { recipeIngredientId: total.id, quantity: "", unit: toInput(0, total.unit).unit }] });
      return <View key={total.id} style={[s.panel, { gap: 12, borderWidth: 2, borderColor: over ? colors.red : active ? color : colors.line, backgroundColor: active ? colors.raised : colors.panel }]}>
        <View style={s.row}>
          {over ? <Pressable accessibilityRole="button" accessibilityLabel={`Ver problema em ${total.name}`} onPress={() => setExplainId(total.id)}
            style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: colors.red, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: colors.red, fontSize: 20, fontWeight: "700" }}>!</Text></Pressable> : null}
          <Pressable style={s.flex} accessibilityRole="button" accessibilityState={{ selected: active }} disabled={busy || active} onPress={addLine}>
            <Text style={s.label}>{total.name}</Text>
            {!line ? <Text style={s.hint}>Total desta produção: {qty(total.quantity, total.unit)}</Text> : null}
          </Pressable>
          {active ? <Pressable disabled={busy} accessibilityRole="button" accessibilityLabel={`Remover ${total.name}`} style={s.close}
            onPress={() => change(selected.key, { ingredients: selected.ingredients.filter((l) => l !== line) })}><Text style={s.closeText}>×</Text></Pressable>
            : <Pressable accessibilityRole="button" accessibilityLabel={`Usar ${total.name}`} disabled={busy} onPress={addLine} style={s.close}><Text style={{ color, fontSize: 26 }}>+</Text></Pressable>}
        </View>
        {line ? <>
          <View style={s.row}>
            <Pressable disabled={busy} accessibilityRole="button" accessibilityLabel={`Colar quantidade de ${total.name}`} hitSlop={8} onPress={() => void pasteQuantity(selected.key, total.id)}
              style={({ pressed }) => ({ width: 44, minHeight: 44, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.5 : 1 })}><View style={{ width: 18, height: 22, borderWidth: 2, borderColor: colors.muted, borderRadius: 4, alignItems: "center" }}>
                <View style={{ width: 8, height: 4, backgroundColor: colors.muted, borderRadius: 2, marginTop: -4 }} /></View></Pressable>
            <View style={{ width: 180, maxWidth: "65%" }}><Field value={line.quantity} keyboardType="decimal-pad" placeholder="0" editable={!busy}
            accessibilityLabel={`Quantidade de ${total.name} em ${line.unit}`}
            onChangeText={(quantity) => change(selected.key, { ingredients: selected.ingredients.map((l) => l === line ? { ...l, quantity } : l) })} /></View>
            <View style={[s.row, { flexWrap: "wrap", gap: 8, flexShrink: 1 }]}>
              {[...compatibleUnits(total.unit), PERCENT].map((unit) => <Pressable key={unit} accessibilityRole="button" disabled={busy}
                accessibilityState={{ selected: line.unit.toUpperCase() === unit }}
                onPress={() => {
                  const absolute = toTotalUnit(numeric(line.quantity || "0"), line.unit, total);
                  const converted = absolute == null ? null : fromTotalUnit(absolute, unit, total);
                  change(selected.key, { ingredients: selected.ingredients.map((l) => l === line ? { ...l, unit,
                    quantity: !line.quantity.trim() ? "" : converted == null ? line.quantity : String(Number(converted.toPrecision(12))).replace(".", ",") } : l) });
                }} style={[s.action, s.compactAction, { minWidth: 60, backgroundColor: line.unit.toUpperCase() === unit ? colors.yellow : colors.raised }]}>
                <Text style={[s.actionText, { color: line.unit.toUpperCase() === unit ? colors.bg : colors.text }]}>{unit.toLowerCase()}</Text></Pressable>)}
            </View></View>
          <View style={{ gap: 8 }}>
            <Text style={s.hint}>Distribuição de {total.name}</Text>
            <View style={{ flexDirection: "row", height: 8, borderRadius: 4, overflow: "hidden", backgroundColor: colors.line }}>
              {drafts.map((p) => {
                const amount = p.ingredients.filter((l) => l.recipeIngredientId === total.id).reduce((sum, l) => sum + (toTotalUnit(numeric(l.quantity || "0"), l.unit, total) ?? 0), 0);
                return amount > 0 ? <View key={p.key} style={{ width: `${Math.max(0, Math.min(100, amount / (total.quantity || 1) * 100))}%`, backgroundColor: stepColors[p.key % stepColors.length] }} /> : null;
              })}
            </View>
            <Text style={{ color: over ? colors.red : colors.muted, fontSize: 14 }}>{over ? `Excesso de ${qty(usedOf(total.id) - total.quantity, total.unit)}` : `Disponível para a mistura final: ${qty(Math.max(0, total.quantity - usedOf(total.id)), total.unit)}`}</Text>
          </View>
          <View style={[s.row, { justifyContent: "flex-end", alignItems: "flex-start", flexWrap: "wrap", columnGap: 28, rowGap: 8 }]}>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={s.hint}>Total da produção</Text>
              <Text style={{ color: colors.muted, fontSize: 22, fontWeight: "400" }}>{qty(total.quantity, total.unit)}</Text>
            </View>
            {inPrep != null ? <View style={{ alignItems: "flex-end" }}>
              <Text style={s.hint}>Nesta preparação</Text>
              <Text style={{ color, fontSize: 22, fontWeight: "700" }}>{qty(inPrep, total.unit)}</Text>
            </View> : null}
          </View>
        </> : null}
      </View>;
    })}
  </View></FadeContent> : null;

  return <View style={s.body}>
    <Workflow phase={1} />
    <View style={[s.row, { padding: 16, justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderColor: colors.line }]}>
      <Text style={s.sectionTitle}>Preparações intermediárias</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Abrir calculadora" onPress={() => setCalculator(true)} style={s.close}><Text style={s.closeText}>🧮</Text></Pressable>
    </View>
    {blockReason ? <View accessibilityRole="alert" style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: previewError ? "#3a1f1d" : colors.panel, borderBottomWidth: 1, borderColor: previewError ? colors.red : colors.line }}>
      <Text style={{ color: previewError ? colors.red : colors.muted, fontSize: 17, fontWeight: "600" }}>{blockReason}</Text></View> : null}
    {wide ? <View style={[s.body, { flexDirection: "row" }]}>
      <ScrollView style={{ width: 280, flexGrow: 0, borderRightWidth: 1, borderColor: colors.line }} contentContainerStyle={s.scroll}>{nav}</ScrollView>
      <ScrollView keyboardShouldPersistTaps="handled" style={s.flex} contentContainerStyle={s.scroll}>{content}<ErrorNotice message={previewError} /></ScrollView>
    </View> : <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.scroll}>
      <View style={[s.row, { flexWrap: "wrap" }]}>
        {drafts.map((p, index) => <Action key={p.key} compact secondary={selected?.key !== p.key} label={p.name || `Preparação ${index + 1}`} disabled={busy} onPress={() => setSelectedKey(p.key)} />)}
      </View>
      {content}
      <Action secondary compact label={showOverview ? "Ocultar organização ↑" : "Organizar preparações e ver mistura final ↓"} onPress={() => setShowOverview((v) => !v)} />
      {showOverview ? nav : null}
    </ScrollView>}
    <View style={s.footer}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: saveToRecipe }} disabled={busy} onPress={() => setSaveToRecipe((v) => !v)} style={{ minHeight: 48, justifyContent: "center", paddingHorizontal: 8 }}>
        <Text style={s.hint}>{saveToRecipe ? "☑" : "☐"} Salvar como padrão da receita</Text></Pressable>
      {onCancel ? <Action secondary label="Cancelar" disabled={busy} onPress={onCancel} /> : null}
      <Action label={busy ? "Salvando…" : "Confirmar preparações"} disabled={busy || invalid} onPress={() => send(drafts)} />
    </View>
    {explainId ? (() => {
      const total = totals.find((t) => t.id === explainId);
      if (!total) return null;
      const used = usedOf(total.id);
      const parts = drafts.map((p, i) => ({ name: label(i), amount: p.ingredients.filter((l) => l.recipeIngredientId === total.id)
        .reduce((acc, l) => acc + (toTotalUnit(numeric(l.quantity || "0"), l.unit, total) ?? 0), 0) })).filter((x) => x.amount > 0);
      return <Sheet title={`Problema em ${total.name}`} maxWidth={560} onClose={() => setExplainId(null)} footer={<Action label="Entendi" onPress={() => setExplainId(null)} />}>
        <ScrollView contentContainerStyle={s.scroll}>
          <Text style={{ color: colors.red, fontSize: 20, fontWeight: "700" }}>As preparações usam mais do que existe nesta produção.</Text>
          <View style={s.panel}>
            <View style={[s.row, { justifyContent: "space-between" }]}><Text style={s.hint}>Total desta produção</Text><Text style={s.label}>{qty(total.quantity, total.unit)}</Text></View>
            {parts.map((x, i) => <View key={`${i}:${x.name}`} style={[s.row, { justifyContent: "space-between" }]}><Text style={s.hint}>{x.name}</Text><Text style={s.label}>{qty(x.amount, total.unit)}</Text></View>)}
            <View style={[s.row, { justifyContent: "space-between" }]}><Text style={s.hint}>Soma das preparações</Text><Text style={s.label}>{qty(used, total.unit)}</Text></View>
            <View style={[s.row, { justifyContent: "space-between" }]}><Text style={{ color: colors.red, fontSize: 17 }}>Passou do total em</Text><Text style={{ color: colors.red, fontSize: 22, fontWeight: "700" }}>{qty(used - total.quantity, total.unit)}</Text></View>
          </View>
          <Text style={s.hint}>Reduza a quantidade de {total.name} em uma das preparações até a soma ficar igual ou menor que o total.</Text>
        </ScrollView>
      </Sheet>;
    })() : null}
    {calculator ? <CalculatorSheet onClose={() => setCalculator(false)} /> : null}
    {namePicker && selected ? <Sheet title="Tipo de preparação" onClose={() => setNamePicker(false)}>
      <ScrollView contentContainerStyle={s.scroll}>
        {PREPARATION_NAMES.map((name) => <Pressable key={name} accessibilityRole="button" onPress={() => { change(selected.key, { name }); setNamePicker(false); }}
          style={[s.panel, { minHeight: 64, borderColor: selected.name === name ? colors.yellow : colors.line }]}><Text style={s.label}>{name}{selected.name === name ? " ✓" : ""}</Text></Pressable>)}
        <Action secondary label="Nome personalizado" onPress={() => { if (PREPARATION_NAMES.includes(selected.name)) change(selected.key, { name: "" }); setNamePicker(false); }} />
      </ScrollView>
    </Sheet> : null}
  </View>;
}
