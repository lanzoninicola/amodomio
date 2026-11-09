import { useState } from "react";
import { Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { Text } from "../ui/Text";
import { OrderPreparationsStep } from "./OrderPreparationsStep";
import { ReorderableList } from "./ReorderableList";
import type { PreparationSuggestion, ProductionMutation, ProductionOrder, ProductionStep } from "./order-types";
import { Action, FadeContent, Workflow, Progress, ErrorNotice, colors, Field, labelDay, Lines, relativeDay, Panel, qty, s, Sheet, statusColors, statusLabels, stepColors } from "./order-ui";

export function ProductionOrderDetail({ order, suggestions, busy, actionError, summaryOpen, onSummaryClose, onAction }: {
  order: ProductionOrder; suggestions: PreparationSuggestion[]; busy: boolean; actionError?: string; summaryOpen: boolean; onSummaryClose: () => void; onAction: (body: ProductionMutation) => void | Promise<boolean>;
}) {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const stepsWidth = Math.min(420, Math.max(340, width * 0.32));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [finalPart, setFinalPart] = useState(0);
  const [confirm, setConfirm] = useState<"cancel" | "finish" | null>(null);
  const [editingPreps, setEditingPreps] = useState(false);
  const [producedQuantity, setProducedQuantity] = useState("");
  const [producedUnit, setProducedUnit] = useState("UN");
  // Fase 2: antes de iniciar, o funcionário informa se há preparações intermediárias.
  // Antes de iniciar, também é possível rever e editar as preparações.
  if (!summaryOpen && order.status === "planned" && (order.plan.preparationsDefined === false || editingPreps))
    return <OrderPreparationsStep key={editingPreps ? "edit" : "new"} order={order} suggestions={suggestions} busy={busy}
      onCancel={editingPreps ? () => setEditingPreps(false) : undefined}
      onAction={async (body) => { const saved = await onAction(body); if (saved) setEditingPreps(false); }} />;
  const running = order.status === "in_progress";
  const terminal = order.status === "finished" || order.status === "cancelled";
  const allDone = order.Steps.length > 0 && order.Steps.every((step) => step.status === "done");
  const prepsDone = order.Steps.filter((step) => step.kind === "preparation").every((step) => step.status === "done");
  const final = order.Steps.find((step) => step.kind === "final");
  const current = order.Steps.find((step) => step.id === selectedId) || order.Steps.find((step) => step.status === "in_progress") || order.Steps.find((step) => step.status !== "done") || final;
  if (!current) return <Panel><Text style={s.label}>Esta produção não tem etapas. Volte à lista e abra novamente.</Text></Panel>;
  const preparation = order.plan.preparations.find((p) => p.id === current.preparationId);
  const stepColor = (step: ProductionStep) => step.kind === "final" ? colors.muted : stepColors[Math.max(0, order.plan.preparations.findIndex((p) => p.id === step.preparationId)) % stepColors.length];
  const blocked = current.kind === "final" && !prepsDone;
  const stepBlocked = (step: ProductionStep) => step.kind === "final" && !prepsDone;
  // Preparação concluída só pode ser anulada com a mistura final ainda pendente.
  const canUndo = (step: ProductionStep) => step.status !== "pending" && (step.kind === "final" || step.status !== "done" || final?.status === "pending");
  const setStep = async (step: ProductionStep, to: "done" | "pending") => {
    const saved = await onAction({ intent: "step", id: order.id, stepId: step.id, to });
    if (saved && to === "done") setSelectedId(null);
  };
  const usageLabel = order.usageDate && order.usageDate.slice(0, 10) !== order.productionDate.slice(0, 10) ? relativeDay(order.usageDate.slice(0, 10)) : "";
  const finishedCount = order.Steps.filter((step) => step.status === "done").length;
  const canReorder = (order.status === "planned" || running) && order.Steps.filter((step) => step.kind === "preparation").length > 1;
  const steps = <View style={s.stack}>
    {wide ? <Progress done={finishedCount} total={order.Steps.length} /> : null}
    <ReorderableList items={order.Steps.map((step) => ({ ...step, fixed: step.kind === "final" }))} disabled={!canReorder || busy}
      onReorder={(ids) => onAction({ intent: "reorder", id: order.id, stepIds: ids })}
      renderItem={(step, index, handle) => <Pressable key={step.id} accessibilityRole="button" accessibilityState={{ selected: current.id === step.id }}
      onPress={() => setSelectedId(step.id)} style={({ pressed }) => [s.panel, { borderLeftWidth: 4, borderLeftColor: stepColor(step), borderColor: current.id === step.id ? stepColor(step) : colors.line, backgroundColor: current.id === step.id ? colors.raised : colors.panel }, pressed && s.dim]}>
      <View style={s.row}>{handle ?? (canReorder ? <View style={{ width: 44 }} /> : null)}<Text style={{ color: stepColor(step), fontSize: 24, fontWeight: "700" }}>{step.status === "done" ? "✓" : String(index + 1).padStart(2, "0")}</Text>
        <View style={s.flex}><Text style={s.label}>{step.name}</Text>
          <Text style={s.hint}>{step.kind === "final" && !prepsDone ? "Aguarda as preparações" : step.status === "done" ? "Concluída" : step.status === "in_progress" ? "Em andamento" : "A fazer"}</Text>
        </View>
        {running ? <>
          {canUndo(step) ? <Pressable disabled={busy} accessibilityRole="button" accessibilityLabel={`Reabrir etapa ${step.name}`} onPress={() => setStep(step, "pending")} style={({ pressed }) => [{ width: 44, height: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line, borderRadius: 6 }, (pressed || busy) && s.dim]}><Text style={{ color: colors.muted, fontSize: 28 }}>↶</Text></Pressable> : null}
          {step.status !== "done" && !stepBlocked(step) ? <Pressable disabled={busy} accessibilityRole="button" accessibilityLabel={`Concluir ${step.name}`} onPress={() => setStep(step, "done")} style={s.close}><Text style={[s.closeText, { color: colors.green }]}>✓</Text></Pressable> : null}
        </> : null}
      </View>
    </Pressable>} />
  </View>;
  let primary: { label: string; action: () => void; disabled?: boolean } | null = null;
  if (order.status === "planned") primary = { label: "Iniciar produção", action: () => onAction({ intent: "start", id: order.id }) };
  else if (running && !allDone && current.status !== "done" && !blocked) primary = { label: `Concluí ${current.name}`, action: () => { void setStep(current, "done"); } };
  else if (running && allDone) primary = { label: "Finalizar produção", action: () => setConfirm("finish") };

  const hasFinalParts = current.kind === "final" && order.plan.final.preparedItems.length > 0;
  const ingredients = <FadeContent changeKey={`${current.id}:${finalPart}`} >
    <View style={[s.panel, { padding: wide ? 20 : 16, gap: 0 }]}>
      <View style={[s.row, { gap: 16, flexWrap: "wrap", alignItems: "center" }]}>
        <View style={{ flex: 1, minWidth: 160, gap: 4 }}>
        <Text style={[s.eyebrow, { color: stepColor(current) }]}>ETAPA {order.Steps.findIndex((step) => step.id === current.id) + 1}/{order.Steps.length}</Text>
        <Text style={[s.title, { fontSize: 23 }]}>{current.name}</Text>
        </View>
        {primary && !(hasFinalParts && finalPart === 0 && running && !allDone) ? <Action compact label={busy ? "Salvando…" : primary.label} disabled={busy || primary.disabled} onPress={primary.action} /> : terminal ? <Text style={{ color: statusColors[order.status], fontSize: 13 }}>{statusLabels[order.status]}</Text> : null}
      </View>
      {hasFinalParts ? <>
        <View style={{ flexDirection: "row", gap: 12, marginTop: 20, marginBottom: 16 }}>
          {["Juntar preparações", "Acrescentar ingredientes"].map((label, index) => <Pressable key={label} accessibilityRole="button" accessibilityState={{ selected: finalPart === index }} onPress={() => setFinalPart(index)} style={{ flex: 1, minHeight: 44, gap: 8, paddingTop: 0, paddingBottom: 6 }}>
            <View style={{ height: 3, borderRadius: 2, backgroundColor: index === finalPart ? colors.yellow : index < finalPart ? colors.green : colors.line }} />
            <Text style={{ color: index === finalPart ? colors.text : colors.muted, fontSize: 12 }}>{index + 1}. {label}</Text>
          </Pressable>)}
        </View>
        {finalPart === 0 ? <View style={{ gap: 8 }}>
          <Text style={s.hint}>Junte as preparações:</Text>
          <View style={[s.row, { flexWrap: "wrap", gap: 12 }]}>{order.plan.final.preparedItems.map((name, index) => <Text key={`${index}:${name}`} style={{ color: prepsDone ? colors.green : colors.muted, fontSize: 16 }}>{prepsDone ? "✓" : "○"} {name}</Text>)}</View>
          <View style={{ alignItems: "flex-end", marginTop: 16 }}><Action compact label="Acrescentar ingredientes →" onPress={() => setFinalPart(1)} /></View>
        </View> : <View style={{ gap: 8 }}>
          <Text style={s.hint}>Depois, acrescente:</Text>
          <Lines lines={order.plan.final.ingredients} />
        </View>}
      </> : <View style={{ marginTop: 20, gap: 8 }}>
        <Text style={s.hint}>Separe e pese:</Text>
        <Lines lines={current.kind === "final" ? order.plan.final.ingredients : preparation?.ingredients || []} />
      </View>}
      {preparation?.notes ? <View style={{ marginTop: 20 }}><Text style={s.label}>Como preparar</Text><Text style={[s.hint, { marginTop: 8 }]}>{preparation.notes}</Text></View> : null}
      {order.status === "planned" ? <Action compact secondary label="Editar preparações" disabled={busy} onPress={() => setEditingPreps(true)} /> : null}
      {blocked ? <Text style={{ color: colors.yellow, fontSize: 16 }}>Conclua as preparações antes de começar a mistura final.</Text> : null}
    </View>
    {order.notes ? <Panel><Text style={s.label}>Observação</Text><Text style={s.hint}>{order.notes}</Text></Panel> : null}
  </FadeContent>;

  return <View style={s.body}>
    <Workflow phase={terminal ? 3 : 2} />
    {wide ? <View style={[s.body, { flexDirection: "row", paddingHorizontal: 16, gap: 28 }]}>
      <ScrollView style={{ width: stepsWidth, flexGrow: 0 }} contentContainerStyle={{ paddingBottom: 12 }}>{steps}</ScrollView>
      <ScrollView style={s.flex} contentContainerStyle={{ paddingBottom: 20 }}>{ingredients}</ScrollView>
    </View> : <ScrollView contentContainerStyle={s.scroll}><Progress done={finishedCount} total={order.Steps.length} />{ingredients}<Text style={s.sectionTitle}>Etapas da produção</Text>{steps}</ScrollView>}
    {summaryOpen ? <Sheet title="Resumo da produção" onClose={() => onSummaryClose()}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.sectionTitle}>{order.recipeName}</Text><Text style={s.hint}>Produção #{order.number} · Produzir: {labelDay(order.productionDate.slice(0, 10))}{usageLabel ? ` · Usar em: ${labelDay(order.usageDate!.slice(0, 10))}` : ""}</Text>
        <Text style={s.label}>Todos os ingredientes</Text><Lines lines={order.plan.totals} />
        {order.producedQuantity != null ? <Text style={s.prepared}>Produzido: {qty(order.producedQuantity, order.producedUnit || "UN")}</Text> : null}
        {!terminal ? <Action secondary danger label="Cancelar esta produção" disabled={busy} onPress={() => { onSummaryClose(); setConfirm("cancel"); }} /> : null}
      </ScrollView>
    </Sheet> : null}
    {confirm ? <Sheet title={confirm === "cancel" ? "Cancelar esta produção?" : "Produção pronta?"} onClose={() => { if (!busy) setConfirm(null); }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.scroll}>
        <ErrorNotice message={actionError || ""} />
        <Text style={s.label}>{order.recipeName}</Text>
        <Text style={s.hint}>{confirm === "cancel" ? "A produção será encerrada como cancelada e suas etapas não poderão mais ser alteradas." : "Todas as etapas foram concluídas. Se quiser, informe quanto ficou pronto."}</Text>
        {confirm === "finish" ? <>
          <Field label="Quantidade produzida (opcional)" value={producedQuantity} onChangeText={setProducedQuantity} keyboardType="decimal-pad" placeholder="0" />
          <View style={s.row}>{["UN", "KG"].map((unit) => <Pressable key={unit} accessibilityRole="button" accessibilityState={{ selected: producedUnit === unit }} onPress={() => setProducedUnit(unit)} style={[s.action, { minWidth: 136, backgroundColor: producedUnit === unit ? colors.yellow : colors.raised }]}><Text style={[s.actionText, { color: producedUnit === unit ? colors.bg : colors.text }]}>{unit === "UN" ? "Unidades" : "Quilos"}</Text></Pressable>)}</View>
        </> : null}
        <Action disabled={busy || (confirm === "finish" && Boolean(producedQuantity.trim()) && (!Number.isFinite(Number(producedQuantity.replace(",", "."))) || Number(producedQuantity.replace(",", ".")) <= 0))}
          label={busy ? "Salvando…" : confirm === "cancel" ? "Sim, cancelar produção" : "Confirmar finalização"} onPress={async () => {
            const saved = await onAction({ intent: confirm, id: order.id, producedQuantity, producedUnit }); if (saved) setConfirm(null);
          }} />
        <Action secondary disabled={busy} label="Voltar" onPress={() => setConfirm(null)} />
      </ScrollView>
    </Sheet> : null}
  </View>;
}
