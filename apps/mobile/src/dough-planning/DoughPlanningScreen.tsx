import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  AppState,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Alert } from "../platform/alert";
import { Screen } from "../ui/Screen";
import { Text } from "../ui/Text";
import { DateCalendar } from "../ui/DateCalendar";
import { usePlanningForecasts } from "./usePlanningForecasts";
import { isSalesField, SALES_FIELDS } from "./forecasts";
import {
  calculatePlan,
  productionShortfallLevel,
  emptyPlan,
  parsePlan,
  parseReferenceDate,
  planningDays,
  SIZES,
  type Plan,
  type Row,
} from "./calculation";

type Explanation = {
  description: string;
  steps?: string[];
  example?: string;
  note?: string;
};
const PRODUCTION_HELP: Explanation = {
  description:
    "Escolha quantas massas preparar de cada tamanho. A quantidade sugerida já vem preenchida.",
  example:
    "Família (2): faltam 2 massas Família para atender às vendas previstas.",
  steps: [
    "Use − e + para mudar a quantidade a preparar.",
    "O peso abaixo do título é o total de massa a preparar para esse dia.",
    "Laranja: falta um pouco. Vermelho: falta mais. Sem destaque: quantidade suficiente.",
  ],
  note: "Coloque 0 para não produzir. Apague o número para voltar à sugestão.",
};
const SALES_HELP =
  "É a quantidade de pizzas que esperamos vender nesse dia. O app já sugere os números; você pode ajustar se precisar.";
const BALANCE_HELP =
  "O saldo mostra quanto deve sobrar depois das vendas. Um número com sinal − significa que vai faltar massa.";
const EXPLANATIONS: Record<string, Explanation> = {
  incomingAndBalance: {
    description:
      "Informe as massas que entram nesse dia, separadas por tamanho. O saldo disponível soma essa entrada ao que sobrou do dia anterior.",
    example: "Sobraram 2 massas e entraram mais 8: o saldo disponível é 10.",
    note: "As vendas ainda não foram descontadas. Esta tela ajuda a planejar; preencher aqui não altera a contagem real das massas.",
  },
  todaySalesAndBalance: {
    description: SALES_HELP,
    steps: [BALANCE_HELP],
    example:
      "Você tem 10 massas e espera vender 12: o saldo fica −2. Faltam 2 massas.",
    note: "Se alterar uma previsão, ela fica guardada para a data escolhida.",
  },
  tomorrowSalesAndBalance: {
    description: SALES_HELP,
    steps: [
      BALANCE_HELP,
      "Esse saldo também conta as massas que você escolheu preparar para esse dia.",
    ],
    example:
      "Sobraram 2 massas, você vai preparar 8 e espera vender 9: deve sobrar 1.",
    note: "Se alterar uma previsão, ela fica guardada para a data escolhida.",
  },
  previous: {
    description:
      "Informe quantas massas sobraram desse dia, separadas por tamanho.",
    example: "Sobraram 4 massas Família? Coloque 4 na linha Família.",
    note: "Conte as massas, não o peso em gramas.",
  },
  incoming: {
    description:
      "Informe quantas massas entram no dia indicado, separadas por tamanho.",
    example: "Entram 8 massas Família nesse dia? Coloque 8 na linha Família.",
    note: "Use − e + para ajustar uma massa por vez, ou −5 e +5 para ajustar cinco de uma vez.",
  },
  available: {
    description:
      "É o total de massas que você terá antes das vendas: o que sobrou do dia anterior mais o que entra nesse dia.",
    example:
      "Sobraram 2 massas e entram mais 8: você terá 10 massas disponíveis.",
  },
  todaySales: {
    description: SALES_HELP,
    note: "Informe a quantidade de pizzas, não o peso da massa.",
  },
  tomorrowSales: {
    description: SALES_HELP,
    note: "A previsão ajuda a calcular quantas massas preparar para o dia indicado.",
  },
  laterSales: {
    description: SALES_HELP,
    note: "O app desconta o que deve sobrar do dia anterior para sugerir quantas massas preparar. Se alterar a previsão, ela fica guardada para essa data.",
  },
  balance: {
    description: BALANCE_HELP,
    example:
      "Você tem 10 massas e espera vender 12: o saldo fica −2. Faltam 2 massas.",
  },
  balanceTomorrow: {
    description: BALANCE_HELP,
    steps: [
      "O app soma as sobras do dia anterior às massas que você vai preparar e desconta as vendas previstas.",
    ],
    example:
      "Sobraram 2 massas, você vai preparar 8 e espera vender 9: deve sobrar 1.",
  },
  laterProduction: PRODUCTION_HELP,
  production: PRODUCTION_HELP,
  needTomorrow: PRODUCTION_HELP,
  needLater: PRODUCTION_HELP,
  grams: {
    description:
      "É o peso de uma massa de cada tamanho, em gramas. O app usa esses pesos para calcular o total de massa a preparar.",
    example:
      "Se uma massa Família pesa 1.250 g, preparar 2 precisa de 2.500 g de massa.",
    note: "Use os pesos da ficha de produção. Confira com o responsável antes de mudar, principalmente os tamanhos Individual e Pequena.",
  },
};
const number = (value: number) => value.toLocaleString("pt-BR");
function Action({
  children,
  onPress,
  label,
  disabled = false,
  expanded,
  compact = false,
}: {
  children: ReactNode;
  onPress: () => void;
  label?: string;
  disabled?: boolean;
  expanded?: boolean;
  compact?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, expanded }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        compact && styles.compactAction,
        (pressed || disabled) && { opacity: 0.5 },
      ]}
    >
      <Text style={styles.actionText}>{children}</Text>
    </Pressable>
  );
}
function OpeningQuantity({
  value,
  onChange,
  label,
  stacked,
  need,
  fiveSteps = false,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  stacked: boolean;
  need?: number;
  fiveSteps?: boolean;
}) {
  const [measuredWidth, setMeasuredWidth] = useState(100);
  const shortfall =
    need === undefined ? 0 : productionShortfallLevel(value, need);
  const shortfallColors = [
    undefined,
    { backgroundColor: "#302819", borderColor: "#a67a36" },
    { backgroundColor: "#493016", borderColor: "#d0933b" },
    { backgroundColor: "#54291c", borderColor: "#db8140" },
    { backgroundColor: "#572121", borderColor: "#e66b55" },
    { backgroundColor: "#6a2027", borderColor: "#f87171" },
  ];
  const numericFont = Math.min(
    20,
    Math.max(
      8,
      Math.floor(
        (measuredWidth - (stacked ? 8 : 24)) /
          (0.64 * Math.max(value.length, 1))
      )
    )
  );
  const numericInput = (
    <TextInput
      accessibilityLabel={label}
      accessibilityHint={
        shortfall > 0
          ? `Produção abaixo da necessidade: faltam ${
              need! - Number(value)
            } unidades.`
          : undefined
      }
      onLayout={(event) => setMeasuredWidth(event.nativeEvent.layout.width)}
      keyboardType="number-pad"
      selectTextOnFocus
      placeholder="0"
      placeholderTextColor="#919191"
      value={value}
      onChangeText={onChange}
      style={[
        styles.input,
        shortfallColors[shortfall],
        { fontSize: numericFont },
        stacked && {
          flex: 0,
          width: "100%",
          paddingHorizontal: 4,
          fontSize: numericFont,
        },
      ]}
    />
  );
  const step = (delta: number) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${delta < 0 ? "Diminuir" : "Aumentar"} ${Math.abs(
        delta
      )} ${Math.abs(delta) === 1 ? "unidade" : "unidades"}: ${label}`}
      accessibilityState={{
        disabled: delta < 0 ? Number(value) <= 0 : Number(value) >= 9999999,
      }}
      disabled={delta < 0 ? Number(value) <= 0 : Number(value) >= 9999999}
      onPress={() =>
        onChange(String(Math.max(0, Math.min(9999999, Number(value) + delta))))
      }
      style={({ pressed }) => [
        styles.openingStep,
        stacked && styles.openingStepSmall,
        (pressed || (delta < 0 && Number(value) <= 0)) && { opacity: 0.5 },
      ]}
    >
      <Text style={styles.actionText}>
        {delta < 0 ? "−" : "+"}
        {Math.abs(delta) > 1 ? Math.abs(delta) : ""}
      </Text>
    </Pressable>
  );
  return stacked ? (
    <View style={styles.openingStack}>
      {numericInput}
      <View style={styles.openingStepRow}>
        {step(-1)}
        {step(1)}
      </View>
      {fiveSteps ? (
        <View style={styles.openingStepRow}>
          {step(-5)}
          {step(5)}
        </View>
      ) : null}
    </View>
  ) : (
    <View style={styles.stepper}>
      {fiveSteps ? step(-5) : null}
      {step(-1)}
      {numericInput}
      {step(1)}
      {fiveSteps ? step(5) : null}
    </View>
  );
}
function Result({
  label,
  value,
  tone = "balance",
  grams = false,
  compact = false,
}: {
  label: string;
  value: number;
  tone?: "balance" | "need" | "mass";
  grams?: boolean;
  compact?: boolean;
}) {
  return (
    <View style={[styles.result, compact && styles.resultLine]}>
      <Text style={styles.label}>{label}</Text>
      <Text
        style={[
          styles.value,
          tone === "balance"
            ? styles.green
            : tone === "need"
            ? styles.yellow
            : styles.white,
          value < 0 && styles.danger,
        ]}
      >
        {number(value)} <Text style={styles.unit}>{grams ? "g" : "un."}</Text>
      </Text>
    </View>
  );
}
export function DoughPlanningScreen({
  apiUrl,
  token,
  onUnauthorized,
  storageScope,
  onBack,
}: {
  apiUrl: string;
  token: string;
  onUnauthorized: () => void;
  storageScope: string;
  onBack: () => void;
}) {
  const storageKey = `amodomio:dough-planning:v1:${storageScope}`;
  const [plan, setPlan] = useState<Plan>(emptyPlan);
  const [referenceDate, setReferenceDate] = useState<string | null>(null);
  const [clock, setClock] = useState(() => new Date());
  const [calendar, setCalendar] = useState(false);
  const [help, setHelp] = useState<
    (Explanation & { title: string; dayIndex?: number }) | null
  >(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [weights, setWeights] = useState(false);
  const [daysWidth, setDaysWidth] = useState(0);
  const [inputWidths, setInputWidths] = useState<Record<string, number>>({});
  const [headerWidth, setHeaderWidth] = useState(0);
  const [showD2, setShowD2] = useState(true);
  const visibleDays = showD2 ? [1, 2, 3] : [1, 2];
  const sideBySide = daysWidth >= (showD2 ? 1000 : 660);
  const days = planningDays(referenceDate ?? clock);
  const forecasts = usePlanningForecasts({
    apiUrl,
    token,
    storageScope,
    dates: days.slice(1).map((day) => day.key),
    legacyPlan: plan,
    planReady: ready,
    onUnauthorized,
  });
  const effectivePlan = forecasts.plan;
  const canCalculate = (dayIndex: number) =>
    ready &&
    days.slice(1, dayIndex + 1).every((day) => forecasts.hasDay(day.key));
  const queue = useRef(Promise.resolve());
  const revision = useRef(0);
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(storageKey)
      .then((raw) => {
        const restored = parsePlan(raw);
        const date = parseReferenceDate(raw);
        if (active) {
          setPlan(restored);
          setReferenceDate(date);
          setShowD2(raw ? JSON.parse(raw).showD2 !== false : true);
          setReady(true);
        }
      })
      .catch(() => {
        if (active)
          setError(
            "Não foi possível abrir o planejamento salvo. Volte ao início e tente abrir esta tela de novo."
          );
      });
    return () => {
      active = false;
    };
  }, [storageKey]);
  useEffect(() => {
    const refresh = () => setClock(new Date());
    const timer = setInterval(refresh, 30000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);
  function persist(next: Plan, date = referenceDate, showLater = showD2) {
    setPlan(next);
    setReferenceDate(date);
    setShowD2(showLater);
    setSaved(false);
    const current = ++revision.current;
    queue.current = queue.current
      .catch(() => {})
      .then(() =>
        AsyncStorage.setItem(
          storageKey,
          JSON.stringify({
            version: 2,
            rows: next,
            referenceDate: date,
            showD2: showLater,
          })
        )
      )
      .then(() => {
        if (revision.current === current) {
          setSaved(true);
          setError("");
        }
      })
      .catch(() => {
        if (revision.current === current)
          setError(
            "Não foi possível salvar as quantidades. Toque em Tentar salvar."
          );
      });
  }
  function update(key: keyof Plan, field: keyof Row, value: string) {
    const sanitized = value.replace(/[^0-9]/g, "").slice(0, 7);
    if (isSalesField(field)) {
      forecasts.setManual(field, key, sanitized);
      return;
    }
    persist({
      ...plan,
      [key]: {
        ...plan[key],
        [field]: value.replace(/[^0-9]/g, "").slice(0, 7),
      },
    });
  }
  function input(
    key: keyof Plan,
    field: keyof Row,
    label: string,
    context = label,
    balance?: number
  ) {
    const size = SIZES.find((size) => size.key === key)!;
    const combined = balance !== undefined;
    const salesRow = combined || field === "laterSales";
    const computedReady =
      !isSalesField(field) || canCalculate(SALES_FIELDS.indexOf(field) + 1);
    const inline = salesRow || (sideBySide && field !== "grams");
    const inputId = `${key}:${field}`;
    const numericFontSize = Math.min(
      20,
      Math.max(
        10,
        Math.floor(
          ((inputWidths[inputId] ?? 80) - 12) /
            (0.64 * Math.max(effectivePlan[key][field].length, 1))
        )
      )
    );
    return (
      <View key={key} style={[styles.field, inline && styles.fieldLine]}>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          style={[
            styles.inputLabel,
            inline && styles.sizeLabel,
            salesRow && styles.combinedSizeLabel,
          ]}
        >
          {label}
        </Text>
        <View
          style={[
            styles.stepper,
            inline && styles.stepperLine,
            salesRow && styles.combinedStepper,
          ]}
        >
          <Action
            compact={salesRow}
            label={`Diminuir ${context}: ${size.label}`}
            disabled={
              (isSalesField(field) && !forecasts.ready) ||
              Number(effectivePlan[key][field]) <= (field === "grams" ? 1 : 0)
            }
            onPress={() =>
              update(
                key,
                field,
                String(
                  Math.max(
                    field === "grams" ? 1 : 0,
                    Number(effectivePlan[key][field]) - 1
                  )
                )
              )
            }
          >
            −
          </Action>
          <TextInput
            accessibilityLabel={`${size.label}: ${context}`}
            onLayout={
              salesRow
                ? (event) => {
                    const width = event.nativeEvent.layout.width;
                    setInputWidths((previous) =>
                      previous[inputId] === width
                        ? previous
                        : { ...previous, [inputId]: width }
                    );
                  }
                : undefined
            }
            editable={!isSalesField(field) || forecasts.ready}
            keyboardType="number-pad"
            selectTextOnFocus
            placeholder="0"
            placeholderTextColor="#919191"
            value={effectivePlan[key][field]}
            onChangeText={(value) => update(key, field, value)}
            style={[
              styles.input,
              salesRow && { paddingHorizontal: 6, fontSize: numericFontSize },
              field === "production" && styles.productionInput,
            ]}
          />
          <Action
            compact={salesRow}
            label={`Aumentar ${context}: ${size.label}`}
            disabled={
              (isSalesField(field) && !forecasts.ready) ||
              Number(effectivePlan[key][field]) >= 9999999
            }
            onPress={() =>
              update(
                key,
                field,
                String(Math.min(9999999, Number(effectivePlan[key][field]) + 1))
              )
            }
          >
            +
          </Action>
          {balance !== undefined ? (
            <View
              style={[
                styles.inlineBalance,
                computedReady && balance < 0 && styles.inlineBalanceNegative,
              ]}
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.5}
                accessibilityLabel={
                  computedReady
                    ? `${size.label}: ${
                        field === "incoming"
                          ? "saldo disponível"
                          : "saldo após vendas"
                      }, ${balance} unidades`
                    : `${size.label}: aguardando previsão para calcular o saldo`
                }
                style={[
                  styles.value,
                  !computedReady
                    ? styles.label
                    : balance < 0
                    ? styles.danger
                    : styles.green,
                ]}
              >
                {computedReady ? number(balance) : "—"}
              </Text>
            </View>
          ) : null}
        </View>
        {field === "grams" && Number(effectivePlan[key].grams) <= 0 ? (
          <Text style={styles.danger}>Informe um peso maior que zero.</Text>
        ) : null}
      </View>
    );
  }
  function helpButton(title: string, key: string, dayIndex?: number) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Entender ${title}${
          dayIndex !== undefined
            ? ` de ${days[dayIndex].label.toLowerCase()}`
            : ""
        }`}
        onPress={() => setHelp({ ...EXPLANATIONS[key], title, dayIndex })}
        style={styles.helpButton}
      >
        <Text style={styles.helpSymbol}>?</Text>
      </Pressable>
    );
  }
  const result = calculatePlan(effectivePlan);
  return (
    <Screen style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <View style={styles.heading}>
          <Text style={styles.title}>Planejamento de Massa</Text>
        </View>
        <Action onPress={onBack}>Início</Action>
      </View>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          onLayout={(event) => setHeaderWidth(event.nativeEvent.layout.width)}
          style={[
            styles.headerControls,
            headerWidth >= 1040 && styles.headerControlsWide,
          ]}
        >
          <View style={styles.controlGroup}>
            <View style={styles.dateBar}>
              <Action
                disabled={!ready || !forecasts.ready}
                label="Dia anterior"
                onPress={() => persist(plan, days[0].key)}
              >
                ‹
              </Action>
              <Pressable
                disabled={!ready || !forecasts.ready}
                accessibilityRole="button"
                accessibilityLabel="Escolher o dia do planejamento"
                onPress={() => setCalendar(true)}
                style={styles.dateButton}
              >
                <Text style={styles.eyebrow}>PLANEJAR DIA ▾</Text>
                <Text style={styles.dateText}>
                  {days[1].date}/{days[1].key.slice(0, 4)}
                </Text>
              </Pressable>
              <Action
                disabled={!ready || !forecasts.ready}
                label="Próximo dia"
                onPress={() => persist(plan, days[2].key)}
              >
                ›
              </Action>
              <Action
                disabled={!ready || !forecasts.ready}
                onPress={() => {
                  setClock(new Date());
                  persist(plan, null);
                }}
              >
                Hoje
              </Action>
            </View>
            <View style={styles.tools}>
              <Action
                disabled={!ready || !forecasts.ready}
                onPress={forecasts.useAutomatic}
                label={
                  forecasts.manualCount
                    ? "Usar as previsões sugeridas nos três dias"
                    : "Buscar a previsão de vendas mais recente"
                }
              >
                {forecasts.manualCount ? "Usar sugestão" : "Atualizar previsão"}
              </Action>
              <Action
                disabled={!ready || !forecasts.ready}
                expanded={showD2}
                onPress={() => persist(plan, referenceDate, !showD2)}
              >
                {`${
                  showD2 ? "Ocultar" : "Mostrar"
                } ${days[3].label.toLowerCase()}`}
              </Action>
              <Action
                disabled={!ready || !forecasts.ready}
                onPress={() => setWeights(!weights)}
              >
                {weights ? "Ocultar pesos" : "Pesos"}
              </Action>
              <Action
                disabled={!ready || !forecasts.ready}
                onPress={() =>
                  Alert.alert(
                    "Limpar planejamento?",
                    "As quantidades dos três dias vão ficar em zero. Os pesos das massas e a data não mudam.",
                    [
                      { text: "Cancelar", style: "cancel" },
                      {
                        text: "Limpar",
                        style: "destructive",
                        onPress: () => {
                          forecasts.clearSales();
                          const next = emptyPlan();
                          for (const { key } of SIZES)
                            next[key].grams = plan[key].grams;
                          persist(next);
                        },
                      },
                    ]
                  )
                }
              >
                Limpar
              </Action>
            </View>
          </View>
          <View style={styles.summary}>
            {[
              {
                day: days[2],
                total: result.gramsTomorrow,
                over: result.overTomorrow,
                offset: "D+1",
              },
              {
                day: days[3],
                total: result.gramsLater,
                over: result.overLater,
                offset: "D+2",
              },
            ]
              .filter(({ offset }) => showD2 || offset !== "D+2")
              .map(({ day, total, over, offset }) => (
                <View
                  key={offset}
                  style={[
                    styles.total,
                    !showD2 && { maxWidth: 320 },
                    canCalculate(offset === "D+1" ? 2 : 3) &&
                      over &&
                      styles.totalDanger,
                  ]}
                >
                  <View style={styles.totalHeading}>
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                      style={styles.summaryLabel}
                    >
                      {day.label} · {day.date}
                    </Text>
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.7}
                      style={[
                        styles.totalValue,
                        canCalculate(offset === "D+1" ? 2 : 3) &&
                          over &&
                          styles.danger,
                      ]}
                    >
                      {canCalculate(offset === "D+1" ? 2 : 3)
                        ? `${(total / 1000).toLocaleString("pt-BR", {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                          })} kg`
                        : "—"}
                    </Text>
                  </View>
                  <Text style={styles.label}>
                    {canCalculate(offset === "D+1" ? 2 : 3)
                      ? `${number(total)} g · limite 22 kg`
                      : "Buscando previsão de vendas…"}
                  </Text>
                  <Text
                    style={[
                      styles.status,
                      !canCalculate(offset === "D+1" ? 2 : 3)
                        ? styles.yellow
                        : over
                        ? styles.danger
                        : styles.green,
                    ]}
                  >
                    {!canCalculate(offset === "D+1" ? 2 : 3)
                      ? "AGUARDANDO PREVISÃO"
                      : over
                      ? "ACIMA DO LIMITE DE 22 KG"
                      : "DENTRO DO LIMITE"}
                  </Text>
                </View>
              ))}
          </View>
        </View>
        {error ? (
          <View style={styles.message}>
            <Text accessibilityRole="alert" style={styles.danger}>
              {error}
            </Text>
            {ready ? (
              <Action onPress={() => persist(plan)}>Tentar salvar</Action>
            ) : null}
          </View>
        ) : null}
        {forecasts.storageError || forecasts.hasError ? (
          <View style={styles.message}>
            <Text accessibilityRole="alert" style={styles.danger}>
              {forecasts.storageError ||
                "Não foi possível buscar todas as previsões. Mantivemos as quantidades já salvas. Toque em Tentar novamente."}
            </Text>
            <Action onPress={forecasts.retry}>Tentar novamente</Action>
          </View>
        ) : null}
        {!ready ? (
          <ActivityIndicator style={{ margin: 24 }} color="#ffffff" />
        ) : (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          >
            <Text style={styles.note}>
              {saved
                ? "Quantidades salvas."
                : "Esta tela salva as quantidades automaticamente."}{" "}
              Ao mudar o dia, as previsões são atualizadas. Os saldos e a
              produção que você preencheu continuam iguais.
            </Text>
            {weights ? (
              <View style={styles.dayGroup}>
                <View style={styles.dayHeader}>
                  <Text style={styles.dayTitle}>PESO DE CADA MASSA (g)</Text>
                  {helpButton("Peso de cada massa", "grams")}
                </View>
                <View style={styles.metricGrid}>
                  {SIZES.map(({ key, label }) => (
                    <View key={key} style={styles.metricCell}>
                      {input(
                        key,
                        "grams",
                        label.toUpperCase(),
                        "Peso por unidade (g)"
                      )}
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
            <View style={styles.dayGroup}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayTitle}>SALDO INICIAL E ENTRADA</Text>
                <Text style={styles.label}>{days[1].date}</Text>
              </View>
              <View style={styles.openingTable}>
                <View
                  style={[
                    styles.openingTableRow,
                    daysWidth >= 700 && styles.openingTableRowWide,
                  ]}
                >
                  <Text
                    style={[
                      styles.label,
                      styles.openingSize,
                      daysWidth >= 700 && styles.openingSizeWide,
                    ]}
                  >
                    TAMANHO
                  </Text>
                  {[
                    { title: `SALDO DE ${days[0].label}`, key: "previous" },
                    { title: `ENTRADA · ${days[1].label}`, key: "incoming" },
                    { title: "SALDO DISPONÍVEL", key: "available" },
                  ].map(({ title, key }) => (
                    <View key={key} style={styles.openingValueColumn}>
                      <View
                        style={[
                          styles.metricHeading,
                          daysWidth < 700 && styles.openingSmallHeading,
                        ]}
                      >
                        <Text
                          style={[
                            styles.metricTitle,
                            daysWidth < 700 && { fontSize: 9 },
                          ]}
                        >
                          {title}
                        </Text>
                        {helpButton(title, key, key === "previous" ? 0 : 1)}
                      </View>
                    </View>
                  ))}
                </View>
                {SIZES.map(({ key, label }, index) => (
                  <View
                    key={key}
                    style={[
                      styles.openingTableRow,
                      daysWidth >= 700 && styles.openingTableRowWide,
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      style={[
                        styles.inputLabel,
                        styles.openingSize,
                        daysWidth >= 700 && styles.openingSizeWide,
                      ]}
                    >
                      {label.toUpperCase()}
                    </Text>
                    <View style={styles.openingValueColumn}>
                      <OpeningQuantity
                        value={plan[key].previous}
                        onChange={(value) => update(key, "previous", value)}
                        label={`${label}: saldo de ${days[0].label.toLowerCase()}`}
                        fiveSteps
                        stacked={daysWidth < 1000}
                      />
                    </View>
                    <View style={styles.openingValueColumn}>
                      <OpeningQuantity
                        value={plan[key].incoming}
                        onChange={(value) => update(key, "incoming", value)}
                        label={`${label}: entrada de massa`}
                        fiveSteps
                        stacked={daysWidth < 1000}
                      />
                    </View>
                    <View style={styles.openingValueColumn}>
                      <View style={styles.openingAvailable}>
                        <Text
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.5}
                          accessibilityLabel={`${label}: saldo disponível, ${result.rows[index].available} unidades`}
                          style={[styles.value, styles.green]}
                        >
                          {number(result.rows[index].available)}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
                <Text style={styles.label}>Valores em unidades.</Text>
              </View>
            </View>
            <View
              onLayout={(event) => setDaysWidth(event.nativeEvent.layout.width)}
              style={[styles.daysLayout, sideBySide && styles.daysRow]}
            >
              {visibleDays.map((dayIndex) => {
                type Metric = {
                  label: string;
                  field?: keyof Row;
                  resultField?: Exclude<
                    keyof (typeof result.rows)[number],
                    "key"
                  >;
                  tone?: "balance" | "need" | "mass";
                  grams?: boolean;
                  massField?: "gramsTomorrow" | "gramsLater";
                  balanceField?: "available" | "balance" | "balanceTomorrow";
                };
                const metrics: Metric[] =
                  dayIndex === 1
                    ? [
                        {
                          label: "Previsão de vendas e saldo",
                          field: "todaySales",
                          balanceField: "balance",
                        },
                      ]
                    : dayIndex === 2
                    ? [
                        {
                          label: "Previsão de vendas e saldo",
                          field: "tomorrowSales",
                          balanceField: "balanceTomorrow",
                        },
                        {
                          label: `Produção para ${days[2].label.toLowerCase()}`,
                          field: "production",
                          resultField: "needTomorrow",
                          massField: "gramsTomorrow",
                          tone: "need",
                        },
                      ]
                    : [
                        { label: "Previsão de vendas", field: "laterSales" },
                        {
                          label: `Produção para ${days[3].label.toLowerCase()}`,
                          field: "laterProduction",
                          resultField: "needLater",
                          massField: "gramsLater",
                          tone: "need",
                        },
                      ];
                return (
                  <View
                    key={dayIndex}
                    style={[
                      styles.dayGroup,
                      sideBySide && {
                        width:
                          (daysWidth - 12 * (visibleDays.length - 1)) /
                          visibleDays.length,
                      },
                    ]}
                  >
                    <View style={styles.dayHeader}>
                      <Text style={styles.dayTitle}>
                        {days[dayIndex].label}
                      </Text>
                      <Text style={styles.label}>{days[dayIndex].date}</Text>
                    </View>
                    {metrics.map((metric) => (
                      <View
                        key={metric.label}
                        style={[
                          styles.metric,
                          metric.massField && styles.productionMetric,
                        ]}
                      >
                        <View style={styles.metricHeading}>
                          <Text style={styles.metricTitle}>
                            {metric.label.toUpperCase()}
                            {metric.grams ? " (g)" : ""}
                          </Text>
                          {helpButton(
                            metric.label,
                            metric.balanceField
                              ? `${metric.field}AndBalance`
                              : metric.field ?? metric.resultField!,
                            dayIndex
                          )}
                        </View>
                        {metric.balanceField ||
                        metric.field === "laterSales" ? (
                          <View style={styles.combinedColumnLabels}>
                            <Text
                              style={[styles.label, styles.combinedSizeLabel]}
                            >
                              TAMANHO
                            </Text>
                            <Text style={[styles.label, styles.editCaption]}>
                              {metric.field === "incoming"
                                ? "ENTRADA (un.)"
                                : "PREVISÃO (un.)"}
                            </Text>
                            {metric.balanceField ? (
                              <Text
                                style={[styles.label, styles.resultCaption]}
                              >
                                SALDO (un.)
                              </Text>
                            ) : null}
                          </View>
                        ) : null}
                        {metric.massField ? (
                          <View style={styles.productionBody}>
                            <Text
                              accessibilityLabel={`Massa total a produzir em ${days[
                                dayIndex
                              ].label.toLowerCase()}`}
                              style={styles.productionTotal}
                            >
                              {canCalculate(dayIndex)
                                ? `${number(
                                    dayIndex === 2
                                      ? result.gramsTomorrow
                                      : result.gramsLater
                                  )} g`
                                : "— g"}
                            </Text>
                            {SIZES.map(({ key, label }, index) => (
                              <View
                                key={key}
                                style={styles.productionControlRow}
                              >
                                <Text
                                  numberOfLines={1}
                                  adjustsFontSizeToFit
                                  style={styles.productionName}
                                >
                                  {label.toUpperCase()}{" "}
                                  <Text style={styles.yellow}>
                                    (
                                    {canCalculate(dayIndex)
                                      ? number(
                                          result.rows[index][
                                            metric.resultField!
                                          ]
                                        )
                                      : "—"}
                                    )
                                  </Text>
                                </Text>
                                <View style={styles.productionControl}>
                                  <OpeningQuantity
                                    need={
                                      canCalculate(dayIndex)
                                        ? result.rows[index][
                                            metric.resultField!
                                          ]
                                        : undefined
                                    }
                                    value={
                                      plan[key][metric.field!] ||
                                      (canCalculate(dayIndex)
                                        ? String(
                                            result.rows[index][
                                              metric.resultField!
                                            ]
                                          )
                                        : "")
                                    }
                                    onChange={(value) =>
                                      update(key, metric.field!, value)
                                    }
                                    label={`${label}: produção para ${days[
                                      dayIndex
                                    ].label.toLowerCase()}, necessidade estimada ${
                                      result.rows[index][metric.resultField!]
                                    } unidades`}
                                    stacked={false}
                                  />
                                </View>
                              </View>
                            ))}
                          </View>
                        ) : (
                          <View style={styles.metricGrid}>
                            {SIZES.map(({ key, label }, index) =>
                              metric.field ? (
                                <View
                                  key={key}
                                  style={[
                                    styles.metricCell,
                                    sideBySide && styles.columnCell,
                                  ]}
                                >
                                  {input(
                                    key,
                                    metric.field,
                                    label.toUpperCase(),
                                    `${metric.label} (${days[dayIndex].label})`,
                                    metric.balanceField
                                      ? result.rows[index][metric.balanceField]
                                      : undefined
                                  )}
                                </View>
                              ) : (
                                <View
                                  key={key}
                                  style={[
                                    styles.metricCell,
                                    sideBySide && styles.columnCell,
                                  ]}
                                >
                                  <Result
                                    compact={sideBySide}
                                    label={label.toUpperCase()}
                                    value={
                                      result.rows[index][metric.resultField!]
                                    }
                                    tone={metric.tone}
                                    grams={metric.grams}
                                  />
                                </View>
                              )
                            )}
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
      <Modal
        visible={help !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setHelp(null)}
        supportedOrientations={[
          "portrait",
          "landscape-left",
          "landscape-right",
        ]}
      >
        <View style={styles.helpBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel="Fechar explicação"
            onPress={() => setHelp(null)}
          />
          <View style={styles.helpCard} accessibilityViewIsModal>
            <ScrollView contentContainerStyle={styles.helpContent}>
              <Text accessibilityRole="header" style={styles.title}>
                {help?.title}
              </Text>
              {help?.dayIndex !== undefined ? (
                <Text style={styles.helpText}>
                  {days[help.dayIndex].label} · {days[help.dayIndex].date}
                </Text>
              ) : null}
              <Text style={styles.helpText}>{help?.description}</Text>
              {help?.example ? (
                <View style={styles.helpFormula}>
                  <Text style={styles.helpExampleLabel}>Exemplo</Text>
                  <Text style={styles.helpText}>{help.example}</Text>
                </View>
              ) : null}
              {help?.steps?.map((step) => (
                <View key={step} style={styles.helpStep}>
                  <Text style={styles.helpText}>•</Text>
                  <Text style={[styles.helpText, { flex: 1 }]}>{step}</Text>
                </View>
              ))}
              {help?.note ? (
                <Text style={styles.helpText}>{help.note}</Text>
              ) : null}
              <Action onPress={() => setHelp(null)}>Entendi</Action>
            </ScrollView>
          </View>
        </View>
      </Modal>
      {calendar ? (
        <DateCalendar
          value={days[1].key}
          onSelect={(date) => {
            persist(plan, date);
            setCalendar(false);
          }}
          onNavigateDay={(date) => persist(plan, date)}
          onClose={() => setCalendar(false)}
        />
      ) : null}
    </Screen>
  );
}
const styles = StyleSheet.create({
  screen: { backgroundColor: "#000000" },
  flex: { flex: 1 },
  header: {
    backgroundColor: "#111111",
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    justifyContent: "space-between",
  },
  heading: { flexShrink: 1, gap: 4 },
  eyebrow: { color: "#b3b3b3", fontSize: 10 },
  title: { color: "#ffffff", fontSize: 16, fontFamily: "IBMPlexMono_Bold" },
  action: {
    minWidth: 44,
    flexShrink: 0,
    alignSelf: "center",
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#282828",
    borderWidth: 1,
    borderColor: "#555555",
    alignItems: "center",
    justifyContent: "center",
  },
  compactAction: { minWidth: 44, width: 44, paddingHorizontal: 0 },
  actionText: { color: "#ffffff", fontSize: 12 },
  headerControls: {
    backgroundColor: "#111111",
    padding: 10,
    gap: 12,
    borderBottomWidth: 1,
    borderColor: "#383838",
  },
  headerControlsWide: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  controlGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
    flexShrink: 1,
  },
  totalHeading: {
    gap: 4,
    alignItems: "stretch",
  },
  dateBar: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    backgroundColor: "#111111",
  },
  dateButton: {
    width: 120,
    flexShrink: 1,
    minWidth: 0,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 8,
    gap: 4,
  },
  dateText: {
    color: "#ffffff",
    fontSize: 13,
    fontFamily: "IBMPlexMono_SemiBold",
  },
  summary: {
    width: "100%",
    maxWidth: 440,
    flexShrink: 1,
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#111111",
  },
  total: {
    flex: 1,
    gap: 2,
    backgroundColor: "#282828",
    borderWidth: 1,
    borderColor: "#444444",
    borderRadius: 10,
    padding: 10,
  },
  totalDanger: { borderColor: "#f87171", backgroundColor: "#351f23" },
  summaryLabel: { color: "#dedede", fontSize: 11, lineHeight: 16 },
  totalValue: {
    color: "#ffffff",
    fontSize: 20,
    fontFamily: "IBMPlexMono_Bold",
  },
  status: { fontSize: 9, lineHeight: 13 },
  content: { padding: 10, gap: 12, paddingBottom: 32 },
  tools: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  note: {
    color: "#b3b3b3",
    fontSize: 11,
    lineHeight: 17,
    flexShrink: 1,
  },
  openingTable: { padding: 10, gap: 10 },
  openingTableRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  openingTableRowWide: { gap: 24 },
  openingSize: { width: 64, fontSize: 10, flexShrink: 0 },
  openingSizeWide: { width: 120, fontSize: 11 },
  openingValueColumn: { flex: 1, minWidth: 0 },
  openingAvailable: {
    minHeight: 48,
    paddingHorizontal: 8,
    backgroundColor: "#1a2316",
    borderWidth: 1,
    borderColor: "#3c4830",
    borderRadius: 8,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  openingStep: {
    width: 44,
    minHeight: 44,
    backgroundColor: "#282828",
    borderWidth: 1,
    borderColor: "#555555",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  openingStepSmall: { flex: 1, width: undefined, minHeight: 36 },
  openingStack: { gap: 4 },
  openingStepRow: { flexDirection: "row", gap: 4 },
  openingSmallHeading: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 0,
  },
  daysLayout: { gap: 12 },
  daysRow: { flexDirection: "row", alignItems: "flex-start" },
  columnCell: { flexBasis: "100%", flexGrow: 0 },
  fieldLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  sizeLabel: { width: 82, flexShrink: 0 },
  stepperLine: { flex: 1, minWidth: 0 },
  resultLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
    gap: 8,
  },
  dayGroup: {
    gap: 10,
    borderWidth: 1,
    borderColor: "#444444",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#111111",
    paddingBottom: 10,
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    padding: 12,
    backgroundColor: "#333333",
  },
  dayTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontFamily: "IBMPlexMono_Bold",
    flexShrink: 1,
  },
  metric: {
    padding: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderColor: "#383838",
  },
  productionBody: { gap: 12 },
  productionTotal: {
    color: "#ffffff",
    fontSize: 18,
    fontFamily: "IBMPlexMono_Bold",
  },
  productionControlRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  productionName: { width: 112, fontSize: 10, color: "#dedede" },
  productionControl: { flex: 1, minWidth: 0 },
  productionMetric: { backgroundColor: "#172330" },
  metricHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  helpButton: {
    minHeight: 44,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  helpSymbol: {
    color: "#ffffff",
    borderWidth: 1,
    borderColor: "#919191",
    borderRadius: 12,
    width: 24,
    height: 24,
    textAlign: "center",
    lineHeight: 22,
    fontSize: 14,
  },
  helpBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  helpCard: {
    width: "100%",
    maxWidth: 460,
    maxHeight: "90%",
    backgroundColor: "#282828",
    borderWidth: 1,
    borderColor: "#555555",
    borderRadius: 12,
  },
  helpContent: { padding: 20, gap: 16 },
  helpText: { color: "#dedede", fontSize: 13, lineHeight: 21 },
  helpFormula: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#111111",
    gap: 6,
  },
  helpExampleLabel: {
    color: "#ffffff",
    fontSize: 12,
    fontFamily: "IBMPlexMono_SemiBold",
  },
  helpStep: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  metricTitle: {
    flexShrink: 1,
    color: "#ffffff",
    fontSize: 12,
    fontFamily: "IBMPlexMono_SemiBold",
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingHorizontal: 2,
  },
  metricCell: { flexGrow: 1, flexBasis: 240, minWidth: 0 },
  combinedLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 20,
  },
  combinedColumnLabels: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 2,
  },
  combinedSizeLabel: { width: 64, fontSize: 10, flexShrink: 0 },
  combinedStepper: { gap: 4 },
  editCaption: { flex: 1, fontSize: 10 },
  resultCaption: { width: 60, textAlign: "center", fontSize: 9 },
  inlineBalance: {
    width: 60,
    marginLeft: 6,
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#3c4830",
    backgroundColor: "#1a2316",
    justifyContent: "center",
    alignItems: "flex-end",
    paddingHorizontal: 4,
  },
  inlineBalanceNegative: { backgroundColor: "#351f23", borderColor: "#704044" },
  field: { minWidth: 0, gap: 6 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 6 },
  inputLabel: { color: "#dedede", fontSize: 11, lineHeight: 16 },
  input: {
    flex: 1,
    minWidth: 0,
    backgroundColor: "#101010",
    borderWidth: 1,
    borderColor: "#707070",
    borderRadius: 8,
    color: "#ffffff",
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 20,
    fontFamily: "IBMPlexMono_SemiBold",
    textAlign: "right",
  },
  productionInput: { backgroundColor: "#1b2c40", borderColor: "#8eafdb" },
  label: { color: "#b3b3b3", fontSize: 11, lineHeight: 16 },
  value: { fontSize: 20, fontFamily: "IBMPlexMono_Bold" },
  unit: { color: "#b3b3b3", fontSize: 11 },
  result: { flexGrow: 1, minWidth: 120, gap: 4 },
  green: { color: "#aec355" },
  yellow: { color: "#fdbc12" },
  white: { color: "#ffffff" },
  danger: { color: "#f87171", fontFamily: "IBMPlexMono_Bold" },
  message: { padding: 12, gap: 8 },
});
