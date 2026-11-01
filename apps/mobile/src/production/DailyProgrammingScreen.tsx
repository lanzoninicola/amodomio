import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import {
  ApiError,
  getDailyProgramming,
  getWeeklyProductionHistory,
} from "../api/client";
import { Button } from "../ui/Button";
import { IconButton } from "../ui/IconButton";
import { Screen } from "../ui/Screen";
import { KdsTypographyContext, Text } from "../ui/Text";
import type { DailyProgramming, StatsRow, WeeklyHistory } from "./types";

const DAYS = [
  ["domingo", "Domingo"],
  ["segunda", "Segunda"],
  ["terca", "Terça"],
  ["quarta", "Quarta"],
  ["quinta", "Quinta"],
  ["sexta", "Sexta"],
  ["sabado", "Sábado"],
];
const SIZE_COLORS: Record<string, string> = {
  Família: "#fdbc12",
  Médio: "#aec355",
  Individual: "#ee8043",
  Pequena: "#bf9bd6",
};
const integer = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
};
const clampPct = (value: number) => Math.max(-50, Math.min(200, value));
function shortDate(value: number) {
  const raw = String(value);
  return `${raw.slice(6, 8)}/${raw.slice(4, 6)}`;
}

function ProductionCard({
  item,
  stock,
  onStock,
}: {
  item: StatsRow;
  stock: number;
  onStock: (value: number) => void;
}) {
  const color = SIZE_COLORS[item.size] ?? "#ffffff";
  return (
    <View style={styles.productionCard}>
      <View style={styles.cardTop}>
        <View style={styles.sizeHeading}>
          <View style={[styles.sizeBadge, { backgroundColor: color }]}>
            <Text style={styles.sizeLetter}>{item.size.charAt(0)}</Text>
          </View>
          <Text style={styles.sizeName}>{item.size}</Text>
        </View>
        <View style={styles.productionCount}>
          <Text style={styles.darkLabel}>A PRODUZIR</Text>
          <Text style={[styles.quantity, { color }]}>
            {Math.max(0, item.forecast - stock)}
          </Text>
        </View>
      </View>
      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Text style={styles.darkLabel}>PREVISÃO</Text>
          <Text style={styles.metricValue}>{item.forecast}</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.darkLabel}>MÉDIA</Text>
          <Text style={styles.metricValue}>{item.avg}</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.darkLabel}>MÍN / MÁX</Text>
          <Text style={styles.metricValue}>
            {item.min} / {item.max}
          </Text>
        </View>
      </View>
      <View style={styles.stockRow}>
        <View style={styles.stockCopy}>
          <Text style={styles.stockLabel}>Estoque atual</Text>
          <Text style={styles.darkHint}>
            {item.freqPct}% dos dias com venda
          </Text>
        </View>
        <View style={styles.stepper}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Diminuir estoque ${item.size}`}
            disabled={stock === 0}
            onPress={() => onStock(Math.max(0, stock - 1))}
            style={({ pressed }) => [
              styles.stockStep,
              (pressed || stock === 0) && styles.dim,
            ]}
          >
            <Text style={styles.stepSymbol}>−</Text>
          </Pressable>
          <TextInput
            accessibilityLabel={`Estoque atual ${item.size}`}
            keyboardType="number-pad"
            selectTextOnFocus
            value={String(stock)}
            onChangeText={(value) => onStock(integer(value))}
            style={styles.stockInput}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Aumentar estoque ${item.size}`}
            onPress={() => onStock(stock + 1)}
            style={({ pressed }) => [styles.stockStep, pressed && styles.dim]}
          >
            <Text style={styles.stepSymbol}>+</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function DailyProgrammingScreen({
  apiUrl,
  token,
  onBack,
  onUnauthorized,
}: {
  apiUrl: string;
  token: string;
  onBack: () => void;
  onUnauthorized: () => void;
}) {
  const [weekday, setWeekday] = useState(DAYS[new Date().getDay()][0]);
  const [pct, setPct] = useState(10);
  const [n, setN] = useState(6);
  const [stocks, setStocks] = useState<Record<string, number>>({});
  const [data, setData] = useState<DailyProgramming | null>(null);
  const [weekly, setWeekly] = useState<WeeklyHistory | null>(null);
  const [showWeekly, setShowWeekly] = useState(false);
  const [weeks, setWeeks] = useState(3);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [draftDay, setDraftDay] = useState(weekday);
  const [draftPct, setDraftPct] = useState(String(pct));
  const [draftN, setDraftN] = useState(n);
  const { width } = useWindowDimensions();
  const dayLabel = DAYS.find(([value]) => value === weekday)?.[1] ?? weekday;
  const cardWidth =
    width >= 1100 ? styles.quarter : width >= 650 ? styles.half : styles.full;
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setData(null);
    setWeekly(null);
    const load = showWeekly
      ? getWeeklyProductionHistory(
          apiUrl,
          token,
          weeks,
          controller.signal
        ).then((result) => {
          if (!controller.signal.aborted) setWeekly(result);
        })
      : getDailyProgramming(
          apiUrl,
          token,
          weekday,
          pct,
          n,
          controller.signal
        ).then((result) => {
          if (!controller.signal.aborted) setData(result);
        });
    load
      .catch((cause) => {
        if (controller.signal.aborted) return;
        if (cause instanceof ApiError && cause.status === 401) onUnauthorized();
        else
          setError(
            cause instanceof Error
              ? cause.message
              : "Não foi possível carregar a programação."
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [apiUrl, token, weekday, pct, n, weeks, showWeekly, retry]);
  function openFilters() {
    setDraftDay(weekday);
    setDraftPct(String(pct));
    setDraftN(n);
    setFiltersOpen(true);
  }
  function navigateDay(delta: number) {
    const index = DAYS.findIndex(([value]) => value === weekday);
    setWeekday(DAYS[(index + delta + 7) % 7][0]);
  }
  function applyFilters() {
    const value = Number(draftPct);
    setWeekday(draftDay);
    setPct(clampPct(Number.isFinite(value) ? value : pct));
    setN(draftN);
    setFiltersOpen(false);
  }
  const total =
    data?.stats.perSize.reduce(
      (sum, item) =>
        sum + Math.max(0, item.forecast - (stocks[item.size] ?? 0)),
      0
    ) ?? 0;

  const headerControls = (
    <View style={[styles.toolbar, width >= 800 && styles.toolbarInline]}>
      {showWeekly ? (
        <View style={styles.dayControl}>
          <IconButton
            icon="previous"
            label="Diminuir semanas"
            disabled={weeks <= 1}
            onPress={() => setWeeks(weeks - 1)}
          />
          <View style={styles.dayCopy}>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={styles.dayTitle}
            >
              {weeks} semanas
            </Text>
            <Text style={styles.toolbarHint}>Semanas completas</Text>
          </View>
          <IconButton
            icon="next"
            label="Aumentar semanas"
            disabled={weeks >= 12}
            onPress={() => setWeeks(weeks + 1)}
          />
        </View>
      ) : (
        <View style={styles.dayControl}>
          <IconButton
            icon="previous"
            label="Dia anterior"
            onPress={() => navigateDay(-1)}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Escolher dia e ajustes da previsão"
            onPress={openFilters}
            style={styles.dayCopy}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={styles.dayTitle}
            >
              {dayLabel}
            </Text>
            <Text style={styles.toolbarHint}>
              {pct > 0 ? "+" : ""}
              {pct}% · {n} semanas
            </Text>
          </Pressable>
          <IconButton
            icon="next"
            label="Próximo dia"
            onPress={() => navigateDay(1)}
          />
        </View>
      )}
      {!showWeekly ? (
        <IconButton
          icon="filter"
          label="Ajustar previsão"
          onPress={openFilters}
        />
      ) : null}
      <IconButton
        icon={showWeekly ? "reduced" : "calendar"}
        label={showWeekly ? "Ver previsão diária" : "Ver histórico semanal"}
        active={showWeekly}
        onPress={() => setShowWeekly((value) => !value)}
      />
    </View>
  );

  return (
    <KdsTypographyContext.Provider value={true}>
      <Screen style={styles.screen}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <IconButton
            icon="home"
            label="Voltar para funcionalidades"
            onPress={onBack}
          />
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>PRODUÇÃO</Text>
            <Text numberOfLines={1} adjustsFontSizeToFit style={styles.title}>
              Programação diária
            </Text>
          </View>
          {width >= 800 ? headerControls : null}
          <IconButton
            icon="refresh"
            label="Atualizar programação"
            onPress={() => setRetry((value) => value + 1)}
            disabled={loading}
          />
        </View>
        {width < 800 ? headerControls : null}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.board}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionCopy}>
                <Text style={styles.sectionTitle}>
                  {showWeekly ? "Vendas por tamanho" : "Plano de produção"}
                </Text>
                <Text style={styles.darkHint}>
                  {showWeekly
                    ? "Totais das semanas completas"
                    : "Previsão − estoque informado"}
                </Text>
              </View>
              {!showWeekly && data ? (
                <View style={styles.total}>
                  <Text style={styles.darkLabel}>TOTAL</Text>
                  <Text style={styles.totalValue}>{total}</Text>
                </View>
              ) : null}
            </View>
            {loading ? (
              <View style={styles.loading}>
                <ActivityIndicator
                  accessibilityLabel="Carregando programação"
                  size="large"
                  color="#fdbc12"
                />
                <Text style={styles.darkHint}>
                  Carregando {showWeekly ? "histórico" : "previsão"}…
                </Text>
              </View>
            ) : null}
            {error ? (
              <View style={styles.message}>
                <Text accessibilityRole="alert" style={styles.error}>
                  {error}
                </Text>
                <Button onPress={() => setRetry((value) => value + 1)}>
                  Tentar novamente
                </Button>
              </View>
            ) : null}
            {data ? (
              <>
                <View style={styles.grid}>
                  {data.stats.perSize.map((item) => (
                    <View key={item.size} style={cardWidth}>
                      <ProductionCard
                        item={item}
                        stock={stocks[item.size] ?? 0}
                        onStock={(value) =>
                          setStocks((current) => ({
                            ...current,
                            [item.size]: value,
                          }))
                        }
                      />
                    </View>
                  ))}
                </View>
                <Text style={styles.simulationHint}>
                  Estoque apenas para simulação. Não altera o saldo de massas.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: historyOpen }}
                  onPress={() => setHistoryOpen(!historyOpen)}
                  style={styles.disclosure}
                >
                  <View style={styles.sectionCopy}>
                    <Text style={styles.disclosureTitle}>
                      Vendas de {dayLabel.toLowerCase()}
                    </Text>
                    <Text style={styles.darkHint}>
                      Últimas {n} semanas · por tamanho
                    </Text>
                  </View>
                  <Text style={styles.disclosureIcon}>
                    {historyOpen ? "−" : "+"}
                  </Text>
                </Pressable>
                {historyOpen ? (
                  <View style={styles.historyTable}>
                    <View style={styles.historyRow}>
                      <Text style={[styles.tableDate, styles.darkLabel]}>
                        DATA
                      </Text>
                      {data.stats.sizes.map((size) => (
                        <Text
                          key={size}
                          accessibilityLabel={size}
                          style={[
                            styles.tableCell,
                            styles.tableHead,
                            { color: SIZE_COLORS[size] },
                          ]}
                        >
                          {size.charAt(0)}
                        </Text>
                      ))}
                    </View>
                    {[...data.stats.lastByDate].reverse().map((row) => (
                      <View key={row.dateInt} style={styles.historyRow}>
                        <Text style={styles.tableDate}>
                          {shortDate(row.dateInt)}
                        </Text>
                        {data.stats.sizes.map((size) => (
                          <Text key={size} style={styles.tableCell}>
                            {row.counts[size] ?? 0}
                          </Text>
                        ))}
                      </View>
                    ))}
                  </View>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: infoOpen }}
                  onPress={() => setInfoOpen(!infoOpen)}
                  style={styles.disclosure}
                >
                  <Text style={styles.disclosureTitle}>
                    Como funciona a previsão
                  </Text>
                  <Text style={styles.disclosureIcon}>
                    {infoOpen ? "−" : "+"}
                  </Text>
                </Pressable>
                {infoOpen ? (
                  <Text style={styles.explanation}>
                    A média ponderada dá mais peso às semanas recentes. A
                    frequência de venda e o ajuste percentual completam a
                    previsão. Dias sem vendas em todos os tamanhos ficam fora
                    das estatísticas.
                  </Text>
                ) : null}
              </>
            ) : null}
            {weekly ? (
              <View style={styles.grid}>
                {weekly.weeklyBySize.map((item) => (
                  <View key={item.size} style={cardWidth}>
                    <View style={styles.productionCard}>
                      <View style={styles.sizeHeading}>
                        <View
                          style={[
                            styles.sizeBadge,
                            { backgroundColor: SIZE_COLORS[item.size] },
                          ]}
                        >
                          <Text style={styles.sizeLetter}>
                            {item.size.charAt(0)}
                          </Text>
                        </View>
                        <Text style={styles.sizeName}>{item.size}</Text>
                      </View>
                      <Text style={styles.darkLabel}>TOTAL VENDIDO</Text>
                      <Text
                        style={[
                          styles.quantity,
                          { color: SIZE_COLORS[item.size] },
                        ]}
                      >
                        {item.total}
                      </Text>
                      <View style={styles.metrics}>
                        <Text style={styles.darkHint}>Mín/sem: {item.min}</Text>
                        <Text style={styles.darkHint}>Máx/sem: {item.max}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </ScrollView>
        <Modal
          visible={filtersOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setFiltersOpen(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.modalRoot}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fechar ajustes"
              style={StyleSheet.absoluteFill}
              onPress={() => setFiltersOpen(false)}
            />
            <View accessibilityViewIsModal style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Ajustar previsão</Text>
                <IconButton
                  icon="cancel"
                  label="Fechar ajustes"
                  onPress={() => setFiltersOpen(false)}
                />
              </View>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.modalContent}
              >
                <Text style={styles.fieldLabel}>Dia da semana</Text>
                <View style={styles.dayOptions}>
                  {DAYS.map(([value, label]) => (
                    <Pressable
                      key={value}
                      accessibilityRole="button"
                      accessibilityState={{ selected: draftDay === value }}
                      onPress={() => setDraftDay(value)}
                      style={[
                        styles.dayOption,
                        draftDay === value && styles.daySelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          draftDay === value && styles.optionSelected,
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.fieldHeader}>
                  <Text style={styles.fieldLabel}>Ajuste percentual</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setDraftPct("0")}
                    style={styles.reset}
                  >
                    <Text style={styles.resetText}>Zerar</Text>
                  </Pressable>
                </View>
                <View style={styles.percentRow}>
                  <TextInput
                    accessibilityLabel="Ajuste percentual da previsão"
                    keyboardType="numbers-and-punctuation"
                    selectTextOnFocus
                    value={draftPct}
                    onChangeText={setDraftPct}
                    style={styles.percentInput}
                  />
                  <Text style={styles.percentSign}>%</Text>
                  <Text style={styles.fieldHint}>De −50% a +200%</Text>
                </View>
                <View style={styles.quickSteps}>
                  {[-10, -5, 5, 10].map((step) => (
                    <Pressable
                      key={step}
                      accessibilityRole="button"
                      accessibilityLabel={`Ajustar ${step} por cento`}
                      onPress={() =>
                        setDraftPct(
                          String(clampPct((Number(draftPct) || 0) + step))
                        )
                      }
                      style={[
                        styles.quickStep,
                        step < 0 ? styles.decrease : styles.increase,
                      ]}
                    >
                      <Text
                        style={[
                          styles.quickStepText,
                          { color: step < 0 ? "#993b35" : "#52652c" },
                        ]}
                      >
                        {step > 0 ? "+" : ""}
                        {step}%
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.fieldLabel}>Semanas de referência</Text>
                <View style={styles.referenceRow}>
                  <Button
                    variant="secondary"
                    disabled={draftN <= 1}
                    onPress={() => setDraftN(draftN - 1)}
                  >
                    −
                  </Button>
                  <Text style={styles.referenceValue}>{draftN} semanas</Text>
                  <Button
                    variant="secondary"
                    disabled={draftN >= 52}
                    onPress={() => setDraftN(draftN + 1)}
                  >
                    +
                  </Button>
                </View>
                <Text style={styles.fieldHint}>
                  Compara o mesmo dia da semana nas últimas {draftN} semanas.
                </Text>
              </ScrollView>
              <View style={styles.modalFooter}>
                <Button onPress={applyFilters}>Aplicar ajustes</Button>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </Screen>
    </KdsTypographyContext.Provider>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#000000" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
  },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 10, color: "#626262", letterSpacing: 1.2 },
  title: { fontSize: 17, fontWeight: "700", color: "#111111" },
  toolbar: {
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 6,
  },
  toolbarInline: {
    paddingHorizontal: 0,
    paddingBottom: 0,
    flexShrink: 0,
    width: 340,
  },
  dayControl: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  dayCopy: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  dayTitle: { fontSize: 13, fontWeight: "700", color: "#111111" },
  toolbarHint: { fontSize: 9, color: "#626262", marginTop: 2 },
  scrollContent: { padding: 10, paddingBottom: 32, alignItems: "center" },
  board: { width: "100%", maxWidth: 1440, gap: 10 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 4,
  },
  sectionCopy: { flex: 1, gap: 4 },
  sectionTitle: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
  total: { flexDirection: "row", alignItems: "center", gap: 10 },
  totalValue: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  full: { width: "100%" },
  half: { width: "48%", flexGrow: 1 },
  quarter: { width: "23%", flexGrow: 1 },
  productionCard: {
    backgroundColor: "#181818",
    borderWidth: 1,
    borderColor: "#333333",
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  sizeHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  sizeBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  sizeLetter: { color: "#111111", fontSize: 18, fontWeight: "700" },
  sizeName: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
    flexShrink: 1,
  },
  productionCount: { alignItems: "flex-end" },
  quantity: {
    fontSize: 48,
    lineHeight: 56,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  darkLabel: { fontSize: 9, color: "#a3a3a3", letterSpacing: 0.6 },
  darkHint: { fontSize: 10, color: "#a3a3a3", lineHeight: 16 },
  metrics: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#333333",
  },
  metric: { gap: 4 },
  metricValue: {
    color: "#eeeeee",
    fontSize: 14,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  stockRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#333333",
  },
  stockCopy: { flex: 1 },
  stockLabel: { color: "#eeeeee", fontSize: 11, fontWeight: "600" },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#444444",
    overflow: "hidden",
  },
  stockStep: {
    minWidth: 44,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#282828",
  },
  stepSymbol: { color: "#ffffff", fontSize: 20 },
  stockInput: {
    width: 48,
    minHeight: 46,
    padding: 0,
    fontFamily: "IBMPlexMono_SemiBold",
    fontSize: 18,
    textAlign: "center",
    color: "#ffffff",
  },
  dim: { opacity: 0.4 },
  simulationHint: {
    color: "#a3a3a3",
    fontSize: 10,
    lineHeight: 16,
    paddingHorizontal: 2,
  },
  disclosure: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    minHeight: 54,
    padding: 12,
    backgroundColor: "#181818",
    borderRadius: 10,
  },
  disclosureTitle: {
    color: "#eeeeee",
    fontSize: 12,
    fontWeight: "600",
    flexShrink: 1,
  },
  disclosureIcon: { color: "#a3a3a3", fontSize: 22 },
  explanation: { color: "#b3b3b3", fontSize: 12, lineHeight: 20, padding: 12 },
  historyTable: {
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#181818",
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 42,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#333333",
  },
  tableDate: { width: 64, color: "#b3b3b3", fontSize: 12 },
  tableCell: {
    flex: 1,
    textAlign: "right",
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  tableHead: { fontSize: 12 },
  loading: { padding: 36, alignItems: "center", gap: 14 },
  message: { padding: 16, gap: 12 },
  error: { color: "#f3a29c", fontSize: 12, lineHeight: 20 },
  modalRoot: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 460,
    maxHeight: "94%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    overflow: "hidden",
    flexShrink: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    gap: 8,
    borderBottomWidth: 1,
    borderColor: "#e0e0e0",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111111",
    flexShrink: 1,
  },
  modalContent: { padding: 16, gap: 12 },
  modalFooter: { padding: 16, borderTopWidth: 1, borderColor: "#e0e0e0" },
  fieldLabel: { fontSize: 12, fontWeight: "600", color: "#171717" },
  dayOptions: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  dayOption: {
    width: "31%",
    flexGrow: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#f1f1f1",
  },
  daySelected: { backgroundColor: "#111111" },
  optionText: { color: "#333333", fontSize: 12 },
  optionSelected: { color: "#ffffff" },
  fieldHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reset: { minHeight: 44, paddingHorizontal: 10, justifyContent: "center" },
  resetText: {
    fontSize: 11,
    color: "#626262",
    textDecorationLine: "underline",
  },
  percentRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  percentInput: {
    width: 82,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d4d4d4",
    fontFamily: "IBMPlexMono_SemiBold",
    color: "#111111",
    textAlign: "center",
    fontSize: 20,
  },
  percentSign: { fontSize: 18, color: "#333333" },
  fieldHint: { flexShrink: 1, fontSize: 10, lineHeight: 16, color: "#626262" },
  quickSteps: { flexDirection: "row", gap: 6 },
  quickStep: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  decrease: { backgroundColor: "#faebe9" },
  increase: { backgroundColor: "#f0f4e3" },
  quickStepText: { fontSize: 12, fontWeight: "600" },
  referenceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  referenceValue: { fontSize: 16, fontWeight: "600", color: "#111111" },
});
