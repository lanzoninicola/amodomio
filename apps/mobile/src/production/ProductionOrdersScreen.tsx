import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, BackHandler, FlatList, Pressable, View, useWindowDimensions } from "react-native";
import { StatusBar } from "expo-status-bar";
import { ApiError, getProductionOrders, submitProductionOrder } from "../api/client";
import { IconButton } from "../ui/IconButton";
import { Screen } from "../ui/Screen";
import { KdsTypographyContext, Text } from "../ui/Text";
import { NewProduction } from "./NewProduction";
import { ProductionOrderDetail } from "./ProductionOrderDetail";
import { DayPicker } from "./DayPicker";
import { Action, Progress, colors, dayKey, Empty, ErrorNotice, labelDay, relativeDay, s, shiftDay, weekdayName, statusColors, statusLabels } from "./order-ui";
import type { PreparationSuggestion, ProductionMutation, ProductionOrder, ProductionSummary } from "./order-types";

type Page = { kind: "list" } | { kind: "new" } | { kind: "order"; id: string };
export function ProductionOrdersScreen({ apiUrl, token, onBack, onUnauthorized }: {
  apiUrl: string; token: string; onBack: () => void; onUnauthorized: () => void;
}) {
  const { width } = useWindowDimensions();
  const [page, setPage] = useState<Page>({ kind: "list" });
  const [date, setDate] = useState(dayKey);
  const [closed, setClosed] = useState(false);
  const [allDays, setAllDays] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [dayPicker, setDayPicker] = useState(false);
  const [orders, setOrders] = useState<ProductionSummary[]>([]);
  const [order, setOrder] = useState<ProductionOrder | null>(null);
  const [suggestions, setSuggestions] = useState<PreparationSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const epoch = useRef(0);
  const [revision, setRevision] = useState(0);
  const unauthorized = useRef(onUnauthorized); unauthorized.current = onUnauthorized;
  const selectedOrderId = page.kind === "order" ? page.id : "";
  function handleError(error: unknown) {
    if (error instanceof ApiError && error.status === 401) unauthorized.current();
  }
  function navigate(next: Page) {
    if (busyRef.current) return;
    epoch.current++; setSummaryOpen(false); setPage(next); setActionError(""); setLoadError("");
    if (next.kind === "order") setLoading(true);
  }
  function back() { if (busyRef.current) return; if (page.kind === "list") onBack(); else navigate({ kind: "list" }); }
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => { back(); return true; });
    return () => sub.remove();
  }, [page, onBack]);
  useEffect(() => {
    if (page.kind === "new" || busy) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let fetching = false;
    async function refresh(initial = false) {
      if (fetching || controller.signal.aborted) return;
      if (AppState.currentState !== "active" && AppState.currentState != null) { timer = setTimeout(() => void refresh(), 6000); return; }
      fetching = true; const requestEpoch = epoch.current;
      if (initial) setLoading(true);
      try {
        const result = await getProductionOrders(apiUrl, token, selectedOrderId ? `id=${encodeURIComponent(selectedOrderId)}` : allDays ? "" : `date=${date}`, controller.signal);
        if (controller.signal.aborted || requestEpoch !== epoch.current) return;
        if (selectedOrderId) { setOrder(result.order || null); setSuggestions(result.suggestions || []); } else setOrders(result.orders || []);
        setLoadError("");
      } catch (e) {
        if (!controller.signal.aborted && requestEpoch === epoch.current) { setLoadError(e instanceof Error ? e.message : "Não foi possível carregar a produção."); handleError(e); }
      } finally {
        fetching = false;
        if (!controller.signal.aborted && requestEpoch === epoch.current) setLoading(false);
        if (!controller.signal.aborted) timer = setTimeout(() => void refresh(), 6000);
      }
    }
    void refresh(true);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && !fetching) { clearTimeout(timer); void refresh(); }
    });
    return () => { controller.abort(); clearTimeout(timer); subscription.remove(); };
  }, [apiUrl, token, page.kind, selectedOrderId, date, allDays, busy, revision]);
  async function mutate(body: ProductionMutation): Promise<boolean> {
    if (busyRef.current) return false;
    busyRef.current = true; epoch.current++; setBusy(true); setActionError("");
    try {
      const result = await submitProductionOrder(apiUrl, token, body);
      if (result.order) { setOrder(result.order); setSuggestions(result.suggestions || []); }
      return true;
    } catch (e) { setActionError(e instanceof Error ? e.message : "Não foi possível salvar. Atualize a tela."); handleError(e); return false; }
    finally { busyRef.current = false; setBusy(false); }
  }
  const filtered = orders.filter((row) => (allDays || row.productionDate.slice(0, 10) === date) &&
    (closed ? row.status === "finished" || row.status === "cancelled" : row.status === "planned" || row.status === "in_progress"))
    .sort((a, b) => (a.status === "in_progress" ? -1 : 0) - (b.status === "in_progress" ? -1 : 0) || (allDays ? a.productionDate.localeCompare(b.productionDate) : 0) || b.number - a.number);
  const columns = width >= 1200 ? 3 : width >= 700 ? 2 : 1;
  const title = page.kind === "new" ? "Nova produção" : page.kind === "order" ? order?.id === selectedOrderId ? order.recipeName : "Produção" : "Produção";
  return <KdsTypographyContext.Provider value={true}>
    <Screen style={s.screen}>
      <StatusBar style="light" />
      <View style={s.header}>
        <IconButton icon={page.kind === "list" ? "home" : "previous"} label={page.kind === "list" ? "Voltar para funcionalidades" : "Voltar para produções"} onPress={back} disabled={busy} />
        <View style={[s.headerCopy, { flexDirection: width >= 700 ? "row" : "column", alignItems: width >= 700 ? "center" : "stretch", gap: 16 }]} >
          <View style={{ flex: 1, minWidth: 0 }}>
          <View style={[s.row, { gap: 10, flexWrap: "wrap" }]}>
            <Text style={s.eyebrow}>{page.kind === "order" && order?.id === selectedOrderId ? `PRODUÇÃO #${order.number}` : "COZINHA"}</Text>
            {page.kind === "order" && order?.id === selectedOrderId ? <Text style={{ color: statusColors[order.status], fontSize: 12, fontWeight: "700" }}>{statusLabels[order.status]}</Text> : null}
          </View>
          <Text numberOfLines={1} style={s.title}>{title}</Text>
          </View>
          {page.kind === "order" && order?.id === selectedOrderId ? <View style={{ gap: 6, flexShrink: 1, borderLeftWidth: 1, borderColor: colors.line, paddingLeft: 16 }}>
            {[{ title: "Produzir em", date: order.productionDate }, { title: "Consumir em", date: order.usageDate || order.productionDate }].map((entry) => <View key={entry.title} style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 8, rowGap: 2 }}>
              <Text style={{ color: colors.muted, fontSize: 12, width: 84 }}>{entry.title}</Text>
              <Text style={{ color: colors.text, fontSize: 12 }}>{labelDay(entry.date.slice(0, 10))} ({weekdayName(entry.date)})</Text>
            </View>)}
          </View> : null}
        </View>
        {page.kind === "order" && order?.id === selectedOrderId ? <Action compact secondary label="Resumo" onPress={() => setSummaryOpen(true)} /> : null}
        {page.kind === "list" ? <Action compact label="+ Nova" onPress={() => navigate({ kind: "new" })} /> : null}
        {page.kind !== "new" ? <IconButton icon="refresh" label="Atualizar produções" disabled={busy || loading} onPress={() => { setRevision((n) => n + 1); setActionError(""); }} /> : null}
      </View>
      <ErrorNotice message={actionError || loadError} />
      {page.kind === "new" ? <NewProduction apiUrl={apiUrl} token={token} onError={handleError}        onBusyChange={(value) => { busyRef.current = value; setBusy(value); }}
        onCreated={(created, hints) => { setOrder(created); setSuggestions(hints); setDate(created.productionDate.slice(0, 10)); epoch.current++; setPage({ kind: "order", id: created.id }); }} /> :
      page.kind === "order" ? loading && order?.id !== selectedOrderId ? <View style={s.empty}><ActivityIndicator color={colors.yellow} accessibilityLabel="Carregando produção" /></View> : order?.id === selectedOrderId ?
        <ProductionOrderDetail summaryOpen={summaryOpen} onSummaryClose={() => setSummaryOpen(false)} actionError={actionError} key={order.id} order={order} suggestions={suggestions} busy={busy || loading || Boolean(loadError)} onAction={(body) => mutate(body)} /> :
        <Empty title="Não foi possível abrir a produção" description="Atualize a tela para tentar novamente."><Action secondary label="Tentar novamente" onPress={() => setRevision((n) => n + 1)} /></Empty> : <>
        <View style={{ padding: 16, gap: 12 }}>
          <View style={[s.row, { flexWrap: "wrap", justifyContent: "space-between", columnGap: 32, rowGap: 16 }]}>
            <View style={[s.row, { flexShrink: 1, flexWrap: "wrap" }]}>
              <IconButton icon="previous" label="Dia anterior" disabled={allDays} onPress={() => setDate(shiftDay(date, -1))} />
              <Pressable accessibilityRole="button" accessibilityLabel={`Escolher outro dia. Dia atual: ${relativeDay(date)}`} disabled={allDays} onPress={() => setDayPicker(true)}
                style={({ pressed }) => [{ minWidth: width < 400 ? 140 : 190, alignItems: "center", minHeight: 48, justifyContent: "center", paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, opacity: allDays ? 0.45 : 1 }, pressed && s.dim]}>
                <Text style={[s.label, { fontWeight: "700" }]}>{allDays ? "Todos os dias" : relativeDay(date)}</Text>
                {!allDays ? <Text style={s.hint}>Toque para escolher o dia</Text> : null}
              </Pressable>
              <IconButton icon="next" label="Próximo dia" disabled={allDays} onPress={() => setDate(shiftDay(date, 1))} />
              <Pressable accessibilityRole="button" accessibilityState={{ selected: allDays }} onPress={() => setAllDays((v) => !v)}
                style={[s.action, s.compactAction, { backgroundColor: allDays ? colors.yellow : colors.raised }]}>
                <Text style={[s.actionText, { fontSize: 16, color: allDays ? colors.bg : colors.text }]}>Todos os dias</Text></Pressable>
            </View>
            <View style={[s.row, { gap: 4, padding: 4, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, borderRadius: 10 }]}>
              {[false, true].map((value) => <Pressable key={String(value)} accessibilityRole="button" accessibilityState={{ selected: closed === value }} onPress={() => setClosed(value)}
                style={[s.action, s.compactAction, { minWidth: 128, backgroundColor: closed === value ? colors.yellow : colors.panel }]}><Text style={[s.actionText, { color: closed === value ? colors.bg : colors.text, fontSize: 16 }]}>{value ? "Encerradas" : "Em aberto"}</Text></Pressable>)}
            </View>
          </View>
          {loading ? <ActivityIndicator color={colors.yellow} accessibilityLabel="Atualizando produções" /> : null}
        </View>
        <FlatList key={columns} numColumns={columns} data={filtered} keyExtractor={(item) => item.id} style={s.body} contentContainerStyle={[s.scroll, { paddingTop: 0, flexGrow: 1 }]}
          columnWrapperStyle={columns > 1 ? { gap: 16 } : undefined}
          ListEmptyComponent={!loading ? <Empty title={closed ? "Nenhuma produção encerrada" : "Nenhuma produção para este dia"} description={closed ? "As produções concluídas ou canceladas aparecem aqui." : "Toque em Nova para escolher a receita e começar."} /> : null}
          renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Abrir produção ${item.number}: ${item.recipeName}, ${statusLabels[item.status]}`} onPress={() => { setOrder(null); navigate({ kind: "order", id: item.id }); }}
            style={({ pressed }) => [s.panel, { flex: 1, maxWidth: `${100 / columns}%`, borderTopWidth: 4, borderTopColor: statusColors[item.status], marginBottom: 16 }, pressed && s.dim]}>
            <View style={[s.row, { justifyContent: "space-between", flexWrap: "wrap" }]}><Text style={s.hint}>#{item.number}</Text><Text style={[s.badge, { color: statusColors[item.status] }]}>{statusLabels[item.status]}</Text></View>
            <Text style={s.sectionTitle}>{item.recipeName}</Text>
            <View style={{ flexDirection: "row", gap: 12, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line }}>
              {[{ title: "Produzir em", date: item.productionDate }, { title: "Usar em", date: item.usageDate || item.productionDate }].map((entry, index) => {
                const day = entry.date.slice(0, 10);
                const relative = relativeDay(day);
                return <View key={entry.title} style={{ flex: 1, minWidth: 0, gap: 4, ...(index === 1 ? { borderLeftWidth: 1, borderColor: colors.line, paddingLeft: 12 } : {}) }}>
                  <Text style={{ color: colors.muted, fontSize: 13 }}>{entry.title}</Text>
                  <Text style={{ color: colors.text, fontSize: 19, fontWeight: "700" }}>{labelDay(day)}</Text>
                  <Text style={{ color: colors.muted, fontSize: 13 }}>{weekdayName(day)}</Text>
                  {["Hoje", "Amanhã", "Ontem"].includes(relative) ? <Text style={{ color: index === 0 ? colors.yellow : colors.muted, fontSize: 13 }}>{relative}</Text> : null}
                </View>;
              })}
            </View>
            <View style={[s.row, { justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 8 }]}>
              <View style={s.flex}><Progress done={item.Steps.filter((step) => step.status === "done").length} total={item.Steps.length} /></View>
              <Text numberOfLines={1} style={[s.label, { color: colors.yellow, flexShrink: 0 }]}>{item.status === "in_progress" ? "Continuar →" : item.status === "planned" ? "Abrir →" : "Ver →"}</Text>
            </View>
          </Pressable>} />
      </>}
    {dayPicker ? <DayPicker value={date} onChange={(day) => { setDate(day); setAllDays(false); }} onClose={() => setDayPicker(false)} /> : null}
    </Screen>
  </KdsTypographyContext.Provider>;
}
