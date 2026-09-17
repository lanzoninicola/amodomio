import { StatusBar } from "expo-status-bar";
import * as Device from "expo-device";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNetInfo } from "@react-native-community/netinfo";
import {
  ApiError,
  getMe,
  listOrders,
  login,
  logout,
  updateOvenRequest,
  updateStatus,
} from "./src/api/client";
import {
  KDS_STATUSES,
  type KdsOrder,
  type KdsStatus,
  type KdsUser,
} from "./src/kds/types";
import { notifyNewOrders, prepareNotifications } from "./src/kds/notifications";
import { sessionStorage } from "./src/storage/session";

const DEFAULT_API_URL = process.env.EXPO_PUBLIC_API_URL || "";
const POLLING_MS = 4_000;

function localDate() {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}
function shiftDate(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  })
    .format(new Date(`${value}T12:00:00`))
    .replace(".", "");
}
function elapsed(createdAt: string, now: number) {
  const minutes = Math.max(
    0,
    Math.floor((now - new Date(createdAt).getTime()) / 60_000)
  );
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(
    minutes % 60
  ).padStart(2, "0")}`;
}

function LoginScreen({
  onAuthenticated,
}: {
  onAuthenticated: (data: {
    token: string;
    user: KdsUser;
    apiUrl: string;
  }) => void;
}) {
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    sessionStorage.getApiUrl().then((stored) => stored && setApiUrl(stored));
  }, []);
  const submit = async () => {
    if (!apiUrl.trim() || !identifier.trim() || !password)
      return setError("Informe servidor, usuário e senha.");
    setBusy(true);
    setError("");
    try {
      const result = await login(apiUrl, {
        identifier,
        password,
        deviceLabel: `KDS Mobile · ${
          Device.deviceName || Device.modelName || "Expo"
        }`,
      });
      const cleanUrl = apiUrl.trim().replace(/\/+$/, "");
      await Promise.all([
        sessionStorage.setToken(result.token),
        sessionStorage.setApiUrl(cleanUrl),
      ]);
      onAuthenticated({
        token: result.token,
        user: result.user,
        apiUrl: cleanUrl,
      });
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Não foi possível entrar."
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <SafeAreaView style={styles.loginSafe}>
      <StatusBar style="light" />
      <View style={styles.loginHero}>
        <Text style={styles.brandEyebrow}>AMODOMIO</Text>
        <Text style={styles.loginTitle}>KDS Atendimento</Text>
        <Text style={styles.loginSubtitle}>
          Pedidos em movimento, da entrada à finalização.
        </Text>
      </View>
      <View style={styles.loginCard}>
        <Text style={styles.fieldLabel}>Servidor Amodomio</Text>
        <TextInput
          style={styles.input}
          value={apiUrl}
          onChangeText={setApiUrl}
          autoCapitalize="none"
          keyboardType="url"
          placeholder="https://seu-dominio.com"
          placeholderTextColor="#94a3b8"
        />
        <Text style={styles.fieldLabel}>Usuário ou e-mail</Text>
        <TextInput
          style={styles.input}
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="operador"
          placeholderTextColor="#94a3b8"
        />
        <Text style={styles.fieldLabel}>Senha</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Sua senha"
          placeholderTextColor="#94a3b8"
          onSubmitEditing={submit}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.pressed,
          ]}
          onPress={submit}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Entrar no KDS</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function OrderCard({
  order,
  now,
  busy,
  onChooseStatus,
  onToggleOven,
}: {
  order: KdsOrder;
  now: number;
  busy: boolean;
  onChooseStatus: () => void;
  onToggleOven: () => void;
}) {
  const sizes = order.sizes
    ? Object.entries(order.sizes)
        .filter(([, count]) => count > 0)
        .map(([size, count]) => `${count}${size}`)
        .join(" · ")
    : "";
  return (
    <Pressable
      style={({ pressed }) => [
        styles.orderCard,
        pressed && styles.pressed,
        busy && styles.busyCard,
      ]}
      onPress={onChooseStatus}
      disabled={busy}
    >
      <View style={styles.orderTop}>
        <Text style={styles.command}>#{order.commandNumber ?? "VL"}</Text>
        <Text style={styles.elapsed}>{elapsed(order.createdAt, now)}</Text>
      </View>
      <Text style={styles.orderMeta}>
        {order.takeAway ? "Retirada" : "Entrega"}
        {order.channel ? ` · ${order.channel}` : ""}
      </Text>
      {sizes ? <Text style={styles.sizes}>{sizes}</Text> : null}
      {order.customerName ? (
        <Text style={styles.customer} numberOfLines={1}>
          {order.customerName}
        </Text>
      ) : null}
      {order.status === "aguardandoForno" ? (
        <Pressable
          style={[
            styles.ovenButton,
            order.requestedForOven && styles.ovenButtonActive,
          ]}
          onPress={(event) => {
            event.stopPropagation();
            onToggleOven();
          }}
        >
          <Text
            style={[
              styles.ovenText,
              order.requestedForOven && styles.ovenTextActive,
            ]}
          >
            🔥{" "}
            {order.requestedForOven ? "Pedido para assar" : "Pedir para assar"}
          </Text>
        </Pressable>
      ) : null}
      <Text style={styles.cardHint}>Toque para mover</Text>
    </Pressable>
  );
}

function KanbanScreen({
  token,
  user,
  apiUrl,
  onSignedOut,
}: {
  token: string;
  user: KdsUser;
  apiUrl: string;
  onSignedOut: () => void;
}) {
  const [date, setDate] = useState(localDate());
  const [orders, setOrders] = useState<KdsOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<KdsOrder | null>(null);
  const [now, setNow] = useState(Date.now());
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const knownIds = useRef<Set<string> | null>(null);
  const netInfo = useNetInfo();
  const online = netInfo.isConnected !== false;
  const load = useCallback(
    async (manual = false) => {
      if (manual) setRefreshing(true);
      try {
        const next = await listOrders(apiUrl, token, date);
        if (knownIds.current) {
          const newcomers = next.filter(
            (order) => !knownIds.current!.has(order.id)
          );
          if (newcomers.length)
            void notifyNewOrders(newcomers.map((order) => order.commandNumber));
        }
        knownIds.current = new Set(next.map((order) => order.id));
        setOrders(next);
        setLastSync(new Date());
        await sessionStorage.setCachedOrders(date, next);
      } catch (reason) {
        if (reason instanceof ApiError && reason.status === 401) {
          await sessionStorage.clearToken();
          onSignedOut();
        } else {
          setOrders((current) => (current.length ? current : []));
          const cached = await sessionStorage.getCachedOrders(date);
          if (cached.length) setOrders(cached);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [apiUrl, date, onSignedOut, token]
  );
  useEffect(() => {
    setLoading(true);
    knownIds.current = null;
    sessionStorage
      .getCachedOrders(date)
      .then((cached) => cached.length && setOrders(cached));
    void load();
  }, [date, load]);
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
      if (AppState.currentState === "active" && online) void load();
    }, POLLING_MS);
    return () => clearInterval(timer);
  }, [load, online]);
  const move = async (order: KdsOrder, status: KdsStatus) => {
    setSelected(null);
    if (!online)
      return Alert.alert("Sem conexão", "Reconecte para alterar o pedido.");
    const previous = orders;
    setMutatingId(order.id);
    setOrders((current) =>
      current.map((item) => (item.id === order.id ? { ...item, status } : item))
    );
    try {
      const updated = await updateStatus(apiUrl, token, order.id, status);
      setOrders((current) =>
        current.map((item) => (item.id === order.id ? updated : item))
      );
      void load();
    } catch (reason) {
      setOrders(previous);
      Alert.alert(
        "Pedido não atualizado",
        reason instanceof Error ? reason.message : "Tente novamente."
      );
    } finally {
      setMutatingId(null);
    }
  };
  const toggleOven = async (order: KdsOrder) => {
    if (!online)
      return Alert.alert("Sem conexão", "Reconecte para alterar o pedido.");
    const previous = orders;
    const next = !order.requestedForOven;
    setMutatingId(order.id);
    setOrders((current) =>
      current.map((item) =>
        item.id === order.id ? { ...item, requestedForOven: next } : item
      )
    );
    try {
      await updateOvenRequest(apiUrl, token, order.id, next);
      void load();
    } catch (reason) {
      setOrders(previous);
      Alert.alert(
        "Ação não atualizada",
        reason instanceof Error ? reason.message : "Tente novamente."
      );
    } finally {
      setMutatingId(null);
    }
  };
  const signOut = () =>
    Alert.alert(
      "Sair do KDS?",
      "Este dispositivo precisará entrar novamente.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sair",
          style: "destructive",
          onPress: async () => {
            try {
              await logout(apiUrl, token);
            } finally {
              await sessionStorage.clearToken();
              onSignedOut();
            }
          },
        },
      ]
    );
  const grouped = useMemo(
    () =>
      Object.fromEntries(
        KDS_STATUSES.map((status) => [
          status.id,
          orders.filter((order) => order.status === status.id),
        ])
      ) as Record<KdsStatus, KdsOrder[]>,
    [orders]
  );
  return (
    <SafeAreaView style={styles.appSafe}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <View>
          <Text style={styles.headerEyebrow}>AMODOMIO · KDS</Text>
          <Text style={styles.headerTitle}>Atendimento</Text>
        </View>
        <Pressable onPress={signOut} style={styles.userButton}>
          <Text style={styles.userInitial}>
            {(user.name || user.username).charAt(0).toUpperCase()}
          </Text>
        </Pressable>
      </View>
      <View style={styles.toolbar}>
        <Pressable
          style={styles.dateArrow}
          onPress={() => setDate((value) => shiftDate(value, -1))}
        >
          <Text style={styles.dateArrowText}>‹</Text>
        </Pressable>
        <Pressable onPress={() => setDate(localDate())}>
          <Text style={styles.dateLabel}>{formatDate(date)}</Text>
          <Text style={styles.todayLabel}>
            {date === localDate() ? "Hoje" : "Toque para voltar a hoje"}
          </Text>
        </Pressable>
        <Pressable
          style={styles.dateArrow}
          onPress={() => setDate((value) => shiftDate(value, 1))}
        >
          <Text style={styles.dateArrowText}>›</Text>
        </Pressable>
        <View
          style={[styles.connection, online ? styles.online : styles.offline]}
        >
          <View
            style={[
              styles.dot,
              { backgroundColor: online ? "#16a34a" : "#dc2626" },
            ]}
          />
          <Text style={styles.connectionText}>
            {online ? "Online" : "Offline"}
          </Text>
        </View>
      </View>
      {loading && !orders.length ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#dc2626" />
          <Text style={styles.loadingText}>Carregando pedidos…</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.board}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
            />
          }
        >
          {KDS_STATUSES.map((status) => (
            <View
              key={status.id}
              style={[styles.column, { backgroundColor: status.tint }]}
            >
              <View style={styles.columnHeader}>
                <View
                  style={[styles.statusMark, { backgroundColor: status.color }]}
                />
                <Text style={styles.columnTitle}>{status.label}</Text>
                <View style={styles.count}>
                  <Text style={styles.countText}>
                    {grouped[status.id].length}
                  </Text>
                </View>
              </View>
              <ScrollView
                contentContainerStyle={styles.cardList}
                showsVerticalScrollIndicator={false}
              >
                {grouped[status.id].map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    now={now}
                    busy={mutatingId === order.id}
                    onChooseStatus={() => setSelected(order)}
                    onToggleOven={() => toggleOven(order)}
                  />
                ))}
                {!grouped[status.id].length ? (
                  <Text style={styles.emptyColumn}>Nenhum pedido</Text>
                ) : null}
              </ScrollView>
            </View>
          ))}
        </ScrollView>
      )}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {lastSync
            ? `Atualizado às ${lastSync.toLocaleTimeString("pt-BR")}`
            : "Exibindo cache local"}
        </Text>
        <Text style={styles.footerText}>{orders.length} pedidos</Text>
      </View>
      <Modal
        visible={Boolean(selected)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setSelected(null)}
        >
          <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>
              Mover pedido #{selected?.commandNumber ?? "VL"}
            </Text>
            <Text style={styles.modalSubtitle}>Selecione a nova etapa</Text>
            {KDS_STATUSES.map((status) => (
              <Pressable
                key={status.id}
                style={[
                  styles.statusOption,
                  selected?.status === status.id && styles.statusOptionCurrent,
                ]}
                onPress={() => selected && move(selected, status.id)}
              >
                <View
                  style={[styles.statusMark, { backgroundColor: status.color }]}
                />
                <Text style={styles.statusOptionText}>{status.label}</Text>
                {selected?.status === status.id ? (
                  <Text style={styles.currentText}>Atual</Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

export default function App() {
  const [session, setSession] = useState<{
    token: string;
    user: KdsUser;
    apiUrl: string;
  } | null>(null);
  const [booting, setBooting] = useState(true);
  useEffect(() => {
    void prepareNotifications();
    Promise.all([sessionStorage.getToken(), sessionStorage.getApiUrl()]).then(
      async ([token, apiUrl]) => {
        if (token && apiUrl) {
          try {
            const result = await getMe(apiUrl, token);
            setSession({ token, apiUrl, user: result.user });
          } catch {
            await sessionStorage.clearToken();
          }
        }
        setBooting(false);
      }
    );
  }, []);
  if (booting)
    return (
      <SafeAreaView style={styles.splash}>
        <StatusBar style="light" />
        <Text style={styles.splashBrand}>AMODOMIO</Text>
        <ActivityIndicator color="#fff" />
      </SafeAreaView>
    );
  if (!session) return <LoginScreen onAuthenticated={setSession} />;
  return <KanbanScreen {...session} onSignedOut={() => setSession(null)} />;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: "#b91c1c",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
  },
  splashBrand: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 3,
  },
  loginSafe: { flex: 1, backgroundColor: "#f8fafc" },
  loginHero: {
    backgroundColor: "#991b1b",
    paddingHorizontal: 28,
    paddingTop: 72,
    paddingBottom: 72,
  },
  brandEyebrow: {
    color: "#fecaca",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2.5,
  },
  loginTitle: {
    color: "#fff",
    fontSize: 34,
    lineHeight: 42,
    fontWeight: "900",
    marginTop: 8,
  },
  loginSubtitle: {
    color: "#fee2e2",
    fontSize: 16,
    lineHeight: 23,
    marginTop: 8,
  },
  loginCard: {
    backgroundColor: "#fff",
    marginHorizontal: 20,
    marginTop: -32,
    borderRadius: 22,
    padding: 22,
    shadowColor: "#0f172a",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  fieldLabel: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 7,
    marginTop: 13,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 14,
    color: "#0f172a",
    fontSize: 16,
    backgroundColor: "#f8fafc",
  },
  error: { color: "#b91c1c", marginTop: 14 },
  primaryButton: {
    height: 52,
    borderRadius: 13,
    backgroundColor: "#dc2626",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  pressed: { opacity: 0.72 },
  appSafe: { flex: 1, backgroundColor: "#e2e8f0" },
  header: {
    height: 82,
    paddingHorizontal: 18,
    backgroundColor: "#991b1b",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerEyebrow: {
    color: "#fecaca",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.6,
  },
  headerTitle: { color: "#fff", fontSize: 24, fontWeight: "900", marginTop: 2 },
  userButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  userInitial: { color: "#991b1b", fontSize: 18, fontWeight: "900" },
  toolbar: {
    minHeight: 68,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
  },
  dateArrow: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
  },
  dateArrowText: { color: "#334155", fontSize: 28 },
  dateLabel: {
    minWidth: 125,
    textAlign: "center",
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  todayLabel: { textAlign: "center", color: "#64748b", fontSize: 10 },
  connection: {
    marginLeft: "auto",
    borderRadius: 99,
    padding: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  online: { backgroundColor: "#dcfce7" },
  offline: { backgroundColor: "#fee2e2" },
  dot: { width: 7, height: 7, borderRadius: 4 },
  connectionText: { color: "#334155", fontSize: 11, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: "#64748b" },
  board: { padding: 12, gap: 12, alignItems: "stretch" },
  column: {
    width: 288,
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  columnHeader: {
    height: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
  },
  statusMark: { width: 9, height: 9, borderRadius: 5 },
  columnTitle: { color: "#1e293b", fontWeight: "900", fontSize: 15, flex: 1 },
  count: {
    minWidth: 28,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  countText: { color: "#334155", fontSize: 12, fontWeight: "900" },
  cardList: { gap: 9, paddingBottom: 20, minHeight: 100 },
  emptyColumn: { color: "#94a3b8", textAlign: "center", marginTop: 28 },
  orderCard: {
    backgroundColor: "#fff",
    borderRadius: 13,
    padding: 13,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 2,
  },
  busyCard: { opacity: 0.5 },
  orderTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  command: { color: "#0f172a", fontSize: 21, fontWeight: "900" },
  elapsed: {
    color: "#b91c1c",
    fontSize: 17,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  orderMeta: { color: "#64748b", fontSize: 12, marginTop: 6 },
  sizes: { color: "#334155", fontSize: 13, fontWeight: "800", marginTop: 7 },
  customer: { color: "#475569", fontSize: 12, marginTop: 5 },
  cardHint: {
    color: "#94a3b8",
    fontSize: 10,
    textAlign: "right",
    marginTop: 9,
  },
  ovenButton: {
    borderWidth: 1,
    borderColor: "#fca5a5",
    backgroundColor: "#fff1f2",
    borderRadius: 9,
    padding: 8,
    marginTop: 10,
  },
  ovenButtonActive: { backgroundColor: "#dc2626" },
  ovenText: {
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  ovenTextActive: { color: "#fff" },
  footer: {
    height: 34,
    paddingHorizontal: 14,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#cbd5e1",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerText: { color: "#64748b", fontSize: 10 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.62)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 390,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
  },
  modalTitle: { color: "#0f172a", fontSize: 21, fontWeight: "900" },
  modalSubtitle: {
    color: "#64748b",
    fontSize: 13,
    marginTop: 4,
    marginBottom: 14,
  },
  statusOption: {
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  statusOptionCurrent: { borderColor: "#94a3b8", backgroundColor: "#f8fafc" },
  statusOptionText: {
    color: "#1e293b",
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
  },
  currentText: { color: "#64748b", fontSize: 11, fontWeight: "700" },
});
