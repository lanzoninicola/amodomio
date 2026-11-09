import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { ApiError, getDoughStock, submitDoughStock } from "../api/client";
import { Alert } from "../platform/alert";
import { Screen } from "../ui/Screen";
import { Button } from "../ui/Button";
import { DateCalendar } from "../ui/DateCalendar";
import { Text } from "../ui/Text";
import { theme } from "../ui/theme";
import type { DoughCounts, DoughStockData, DoughStockIntent } from "./types";

const emptyCounts = (): DoughCounts => ({ F: 0, M: 0, P: 0, I: 0, FT: 0 });
function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(now.getDate()).padStart(2, "0")}`;
}
const formatDate = (date: string) => date.split("-").reverse().join("/");

export function DoughStockScreen({
  initialDate,
  apiUrl,
  token,
  onBack,
  onUnauthorized,
}: {
  apiUrl: string;
  token: string;
  initialDate?: string;
  onBack: () => void;
  onUnauthorized: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const wide = width >= 700;
  const tabletLandscape = wide && width > height;
  const [date, setDate] = useState(() => initialDate ?? localDate());
  const [data, setData] = useState<DoughStockData | null>(null);
  const [counts, setCounts] = useState<DoughCounts>(emptyCounts);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<DoughStockIntent | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [calendar, setCalendar] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  const [reload, setReload] = useState(0);
  const scroll = useRef<ScrollView>(null);
  const positions = useRef<Partial<Record<keyof DoughCounts, number>>>({});
  const gridTop = useRef(0);
  const focused = useRef<keyof DoughCounts | null>(null);
  const inFlight = useRef(false);
  const unauthorized = useRef(onUnauthorized);
  unauthorized.current = onUnauthorized;
  const scrollToField = () => {
    if (focused.current)
      scroll.current?.scrollTo({
        y: gridTop.current + (positions.current[focused.current] ?? 0),
        animated: true,
      });
  };
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => {
      setKeyboard(true);
      scrollToField();
    });
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboard(false)
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setData(null);
    setError("");
    setMessage("");
    getDoughStock(apiUrl, token, date, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setData(result);
        setCounts(result.stock?.effective ?? emptyCounts());
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        if (reason instanceof ApiError && reason.status === 401)
          unauthorized.current();
        else
          setError(
            reason instanceof Error
              ? reason.message
              : "Não foi possível carregar o estoque."
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [apiUrl, token, date, reload]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (!inFlight.current) onBack();
        return true;
      }
    );
    return () => subscription.remove();
  }, [onBack]);

  async function submit(intent: DoughStockIntent) {
    if (inFlight.current || loading || !data) return;
    inFlight.current = true;
    Keyboard.dismiss();
    setBusy(intent);
    setError("");
    setMessage("");
    try {
      const result = await submitDoughStock(
        apiUrl,
        token,
        date,
        intent,
        counts
      );
      if (result.stock && result.ok) setCounts(result.stock.effective);
      if (result.ok) setMessage(result.message);
      else setError(result.message);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401)
        unauthorized.current();
      else
        setError(
          reason instanceof Error
            ? reason.message
            : "Não foi possível concluir a operação."
        );
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }
  const disabled = loading || Boolean(busy) || !data;
  const adjust = (key: keyof DoughCounts, delta: number) => {
    setCounts((current) => ({
      ...current,
      [key]: Math.min(
        Number.MAX_SAFE_INTEGER,
        Math.max(0, current[key] + delta)
      ),
    }));
    setMessage("");
  };

  const actions = (
    <View style={[styles.actions, wide && styles.sideActions]}>
      <View style={wide ? styles.stack : styles.row}>
        <Button
          variant="destructive"
          style={wide ? undefined : styles.flex}
          disabled={disabled}
          loading={busy === "reset"}
          onPress={() =>
            Alert.alert(
              "Zerar estoque?",
              `O estoque de ${formatDate(
                date
              )} será salvo com todas as quantidades zeradas.`,
              [
                { text: "Cancelar", style: "cancel" },
                {
                  text: "Zerar",
                  style: "destructive",
                  onPress: () => void submit("reset"),
                },
              ]
            )
          }
        >
          Zerar
        </Button>
        <Button
          style={wide ? undefined : styles.flex}
          disabled={disabled}
          loading={busy === "save"}
          onPress={() => void submit("save")}
        >
          Salvar
        </Button>
      </View>
      <Button
        style={{ backgroundColor: "#16804a" }}
        disabled={disabled || date !== data?.today}
        loading={busy === "sendWhatsapp"}
        onPress={() => void submit("sendWhatsapp")}
      >
        <Text style={styles.whatsapp}>Enviar estoque pelo WhatsApp</Text>
      </Button>
      {date !== data?.today && data ? (
        <Text style={styles.hint}>WhatsApp disponível apenas para hoje.</Text>
      ) : null}
      {message ? (
        <Text accessibilityLiveRegion="polite" style={styles.hint}>
          {message}
        </Text>
      ) : null}
      {error ? (
        <Text accessibilityLiveRegion="assertive" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
  return (
    <Screen>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.header, keyboard && styles.compactHeader]}>
          <Button variant="ghost" disabled={Boolean(busy)} onPress={onBack}>
            Voltar
          </Button>
          {!keyboard ? (
            <Text style={styles.title}>Estoque de massa</Text>
          ) : null}
          <Button
            variant="outline"
            disabled={Boolean(busy)}
            onPress={() => {
              Keyboard.dismiss();
              setCalendar(true);
            }}
          >
            {formatDate(date)}
          </Button>
          {date !== (data?.today ?? localDate()) ? (
            <Button
              variant="ghost"
              disabled={Boolean(busy)}
              onPress={() => setDate(data?.today ?? localDate())}
            >
              Hoje
            </Button>
          ) : null}
        </View>
        <View style={[styles.body, wide && styles.horizontal]}>
          <ScrollView
            ref={scroll}
            style={styles.flex}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {loading ? (
              <ActivityIndicator
                accessibilityLabel="Carregando estoque"
                color={theme.colors.foreground}
              />
            ) : null}
            {!loading && !data ? (
              <Button
                variant="outline"
                onPress={() => setReload((value) => value + 1)}
              >
                Tentar novamente
              </Button>
            ) : null}
            {data?.previousStock ? (
              <Button
                variant="secondary"
                disabled={disabled}
                onPress={() => {
                  setCounts(data.previousStock!.stock.effective);
                  setMessage("");
                }}
              >
                {`Carregar último estoque (${String(
                  data.previousStock.dateInt
                ).replace(/^(\d{4})(\d{2})(\d{2})$/, "$3/$2/$1")})`}
              </Button>
            ) : null}
            <View
              style={styles.grid}
              onLayout={(event) => {
                gridTop.current = event.nativeEvent.layout.y;
              }}
            >
              {data?.sizes
                .filter((size) => size.key !== "FT")
                .map((size) => (
                  <View
                    key={size.key}
                    style={[styles.cell, wide && styles.wideCell]}
                    onLayout={(event) => {
                      positions.current[size.key] = event.nativeEvent.layout.y;
                    }}
                  >
                    <Text style={styles.label}>
                      {size.label} · {size.abbr || size.key}
                    </Text>
                    <View style={styles.row}>
                      <TextInput
                        accessibilityLabel={`Quantidade de ${size.label}`}
                        editable={!disabled}
                        value={String(counts[size.key])}
                        keyboardType="number-pad"
                        selectTextOnFocus
                        onFocus={() => {
                          focused.current = size.key;
                          scrollToField();
                        }}
                        onChangeText={(value) => {
                          const number = Number(value.replace(/\D/g, ""));
                          setCounts((current) => ({
                            ...current,
                            [size.key]: Number.isSafeInteger(number)
                              ? number
                              : current[size.key],
                          }));
                          setMessage("");
                        }}
                        style={styles.quantity}
                      />
                      <Button
                        variant="outline"
                        style={styles.step}
                        disabled={disabled}
                        onPress={() => adjust(size.key, -1)}
                      >
                        <Text
                          accessibilityLabel={`Diminuir ${size.label}`}
                          style={styles.stepText}
                        >
                          −
                        </Text>
                      </Button>
                      <Button
                        variant="outline"
                        style={styles.step}
                        disabled={disabled}
                        onPress={() => adjust(size.key, 1)}
                      >
                        <Text
                          accessibilityLabel={`Aumentar ${size.label}`}
                          style={styles.stepText}
                        >
                          +
                        </Text>
                      </Button>
                    </View>
                    <View style={styles.row}>
                      {(tabletLandscape ? [-10, -5, 5, 10] : [-10, 10]).map(
                        (delta) => (
                          <Button
                            key={delta}
                            variant="secondary"
                            style={{
                              ...styles.quickStep,
                              backgroundColor:
                                delta === -10
                                  ? "#fecaca"
                                  : delta === -5
                                  ? "#fee2e2"
                                  : delta === 5
                                  ? "#dcfce7"
                                  : "#bbf7d0",
                            }}
                            disabled={disabled}
                            onPress={() => adjust(size.key, delta)}
                          >
                            <Text
                              style={{
                                color: delta < 0 ? "#991b1b" : "#166534",
                                fontFamily: theme.typography.semibold,
                                fontSize: 14,
                              }}
                            >
                              {delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`}
                            </Text>
                          </Button>
                        )
                      )}
                    </View>
                  </View>
                ))}
            </View>
            {!wide ? actions : null}
          </ScrollView>
          {wide ? (
            <ScrollView
              style={styles.sidebar}
              contentContainerStyle={styles.sideContent}
              keyboardShouldPersistTaps="handled"
            >
              {actions}
            </ScrollView>
          ) : null}
        </View>
      </KeyboardAvoidingView>
      {calendar ? (
        <DateCalendar
          value={date}
          onClose={() => setCalendar(false)}
          onSelect={(value) => {
            setCalendar(false);
            setDate(value);
          }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    padding: 12,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
  },
  compactHeader: { paddingVertical: 4 },
  title: {
    flex: 1,
    minWidth: 150,
    color: theme.colors.foreground,
    fontFamily: theme.typography.bold,
    fontSize: 20,
  },
  body: { flex: 1 },
  horizontal: { flexDirection: "row" },
  content: { padding: 12, gap: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  cell: {
    width: "100%",
    padding: 12,
    gap: 8,
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  wideCell: { width: "48%", flexGrow: 1 },
  label: {
    color: theme.colors.foreground,
    fontFamily: theme.typography.semibold,
    fontSize: 15,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  stack: { gap: 8 },
  quantity: {
    flex: 1,
    minWidth: 0,
    height: 60,
    borderWidth: 1,
    borderColor: theme.colors.input,
    borderRadius: 8,
    textAlign: "right",
    paddingHorizontal: 10,
    fontSize: 30,
    color: theme.colors.foreground,
    fontFamily: theme.typography.bold,
  },
  step: { width: 48, minHeight: 60, paddingHorizontal: 0, borderRadius: 8 },
  stepText: { fontSize: 26, color: theme.colors.foreground },
  quickStep: { flex: 1, paddingHorizontal: 4 },
  actions: { gap: 10, paddingVertical: 8 },
  sideActions: { paddingVertical: 0 },
  sidebar: {
    width: 220,
    flexGrow: 0,
    borderLeftWidth: 1,
    borderColor: theme.colors.border,
  },
  sideContent: { padding: 12 },
  whatsapp: {
    color: "white",
    textAlign: "center",
    fontFamily: theme.typography.medium,
    fontSize: 14,
  },
  hint: { color: theme.colors.mutedForeground, fontSize: 13 },
  error: { color: theme.colors.destructive, fontSize: 13 },
});
