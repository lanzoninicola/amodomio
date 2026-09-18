import { StatusBar } from "expo-status-bar";
import * as Device from "expo-device";
import * as ScreenOrientation from "expo-screen-orientation";
import { useFonts } from "expo-font";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useWindowDimensions,
  ActivityIndicator,
  Alert,
  AppState,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNetInfo } from "@react-native-community/netinfo";
import { SafeAreaProvider } from "react-native-safe-area-context";
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
import { AppHeader } from "./src/ui/AppHeader";
import { PhoneBoard } from "./src/kds/PhoneBoard";
import { DateCalendar } from "./src/ui/DateCalendar";
import { Badge } from "./src/ui/Badge";
import { Button } from "./src/ui/Button";
import { Card } from "./src/ui/Card";
import { Input } from "./src/ui/Input";
import { Screen } from "./src/ui/Screen";
import { theme } from "./src/ui/theme";

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
    <Screen style={styles.loginSafe}>
      <StatusBar style="light" />
      <View style={styles.loginHero}>
        <Text style={styles.brandEyebrow}>AMODOMIO</Text>
        <Text style={styles.loginTitle}>Bem-vindo</Text>
        <Text style={styles.loginSubtitle}>
          Entre para acessar as funcionalidades do Amodomio.
        </Text>
      </View>
      <Card style={styles.loginCard}>
        <Input
          label="Servidor Amodomio"
          value={apiUrl}
          onChangeText={setApiUrl}
          autoCapitalize="none"
          keyboardType="url"
          placeholder="https://seu-dominio.com"
        />
        <Input
          label="Usuário ou e-mail"
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="operador"
        />
        <Input
          label="Senha"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Sua senha"
          onSubmitEditing={submit}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button onPress={submit} loading={busy} style={styles.loginButton}>
          Entrar
        </Button>
      </Card>
    </Screen>
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

function HomeScreen({
  token,
  user,
  apiUrl,
  onOpenKds,
  onSignedOut,
}: {
  token: string;
  user: KdsUser;
  apiUrl: string;
  onOpenKds: () => void;
  onSignedOut: () => void;
}) {
  const signOut = () =>
    Alert.alert(
      "Sair do Amodomio?",
      "A sessão deste dispositivo será encerrada.",
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

  return (
    <Screen style={styles.homeSafe}>
      <StatusBar style="light" />
      <AppHeader
        title={`Olá, ${user.name || user.username}`}
        action={
          <Pressable onPress={signOut} style={styles.homeAvatar}>
            <Text style={styles.userInitial}>
              {(user.name || user.username).charAt(0).toUpperCase()}
            </Text>
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.homeContent}>
        <Text style={styles.homeTitle}>Funcionalidades</Text>
        <Text style={styles.homeSubtitle}>
          Escolha onde você quer trabalhar.
        </Text>
        <Pressable
          style={({ pressed }) => [
            styles.featureCard,
            pressed && styles.pressed,
          ]}
          onPress={onOpenKds}
        >
          <View style={styles.featureIcon}>
            <Text style={styles.featureEmoji}>KDS</Text>
          </View>
          <View style={styles.featureCopy}>
            <Text style={styles.featureTitle}>KDS</Text>
            <Text style={styles.featureDescription}>
              Acompanhe e mova os pedidos entre as etapas de produção.
            </Text>
          </View>
          <Text style={styles.featureArrow}>›</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

function KanbanScreen({
  token,
  apiUrl,
  onBack,
  onUnauthorized,
}: {
  token: string;
  apiUrl: string;
  onBack: () => void;
  onUnauthorized: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const isPhone =
    Device.deviceType === Device.DeviceType.PHONE ||
    (Device.deviceType !== Device.DeviceType.TABLET &&
      Math.min(width, height) < 600);
  const [date, setDate] = useState(localDate());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const currentDate = useRef(date);
  currentDate.current = date;
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
        if (currentDate.current !== date) return;
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
        if (currentDate.current !== date) return;
        if (reason instanceof ApiError && reason.status === 401) {
          await sessionStorage.clearToken();
          onUnauthorized();
        } else {
          setOrders((current) => (current.length ? current : []));
          const cached = await sessionStorage.getCachedOrders(date);
          if (currentDate.current === date) setOrders(cached);
        }
      } finally {
        if (currentDate.current === date) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [apiUrl, date, onUnauthorized, token]
  );
  useEffect(() => {
    setLoading(true);
    setOrders([]);
    setLastSync(null);
    knownIds.current = null;
    sessionStorage.getCachedOrders(date).then((cached) => {
      if (currentDate.current === date && knownIds.current === null)
        setOrders(cached);
    });
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
    if (order.status === status || mutatingId) return;
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
    <Screen style={styles.appSafe}>
      <StatusBar style="light" />
      {!isPhone ? (
        <AppHeader
          eyebrow="AMODOMIO"
          title="KDS"
          action={
            <Button variant="secondary" onPress={onBack}>
              ‹ Início
            </Button>
          }
        />
      ) : null}
      {isPhone ? (
        <>
          <View style={styles.phoneToolbar}>
            <Button
              variant="outline"
              style={{ flex: 1 }}
              disabled={Boolean(mutatingId)}
              onPress={() => setCalendarOpen(true)}
            >{`${formatDate(date)}  ⌄`}</Button>
            <Button
              variant="ghost"
              loading={refreshing}
              onPress={() => load(true)}
            >
              ↻
            </Button>
            <Button variant="ghost" onPress={onBack}>
              Início
            </Button>
          </View>
        </>
      ) : (
        <View style={styles.toolbar}>
          <Pressable
            style={styles.dateArrow}
            disabled={Boolean(mutatingId)}
            onPress={() => setDate((value) => shiftDate(value, -1))}
          >
            <Text style={styles.dateArrowText}>‹</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Selecionar dia no calendário"
            disabled={Boolean(mutatingId)}
            onPress={() => setCalendarOpen(true)}
          >
            <Text style={styles.dateLabel}>{formatDate(date)}</Text>
            <Text style={styles.todayLabel}>
              {date === localDate() ? "Hoje · Calendário" : "Abrir calendário"}
            </Text>
          </Pressable>
          <Pressable
            style={styles.dateArrow}
            disabled={Boolean(mutatingId)}
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
      )}
      {loading && !orders.length ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Carregando pedidos…</Text>
        </View>
      ) : isPhone ? (
        <PhoneBoard
          orders={orders}
          now={now}
          busy={Boolean(mutatingId)}
          refreshing={refreshing}
          onRefresh={() => load(true)}
          onMove={move}
          onChooseStatus={setSelected}
        />
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
            <View key={status.id} style={styles.column}>
              <View style={styles.columnHeader}>
                <View
                  style={[styles.statusMark, { backgroundColor: status.color }]}
                />
                <Text style={styles.columnTitle}>{status.label}</Text>
                <Badge>{grouped[status.id].length}</Badge>
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
        <Text style={styles.footerText}>
          {online ? "Online" : "Offline"} · {orders.length} pedidos
        </Text>
      </View>
      {calendarOpen ? (
        <DateCalendar
          value={date}
          onSelect={(next) => {
            setDate(next);
            setCalendarOpen(false);
          }}
          onClose={() => setCalendarOpen(false)}
        />
      ) : null}
      <Modal
        supportedOrientations={[
          "portrait",
          "landscape-left",
          "landscape-right",
        ]}
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
    </Screen>
  );
}

function AppContent() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [session, setSession] = useState<{
    token: string;
    user: KdsUser;
    apiUrl: string;
  } | null>(null);
  const [activeFeature, setActiveFeature] = useState<"kds" | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    const orientation =
      activeFeature === "kds"
        ? ScreenOrientation.OrientationLock.DEFAULT
        : ScreenOrientation.OrientationLock.PORTRAIT_UP;
    ScreenOrientation.lockAsync(orientation).catch(() => {
      // Browsers and devices with rotation lock may decline the request.
    });
  }, [activeFeature]);

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
  if (booting || (!fontsLoaded && !fontError))
    return (
      <Screen style={styles.splash}>
        <StatusBar style="light" />
        <Text style={styles.splashBrand}>AMODOMIO</Text>
        <ActivityIndicator color="#fff" />
      </Screen>
    );
  if (!session)
    return (
      <LoginScreen
        onAuthenticated={(nextSession) => {
          setActiveFeature(null);
          setSession(nextSession);
        }}
      />
    );
  if (activeFeature === "kds") {
    return (
      <KanbanScreen
        token={session.token}
        apiUrl={session.apiUrl}
        onBack={() => setActiveFeature(null)}
        onUnauthorized={() => {
          setActiveFeature(null);
          setSession(null);
        }}
      />
    );
  }
  return (
    <HomeScreen
      {...session}
      onOpenKds={() => setActiveFeature("kds")}
      onSignedOut={() => {
        setActiveFeature(null);
        setSession(null);
      }}
    />
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: theme.colors.foreground,
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
  },
  splashBrand: {
    color: "#fff",
    fontSize: 28,
    fontFamily: theme.typography.bold,
    letterSpacing: 3,
  },
  loginSafe: { flex: 1, backgroundColor: theme.colors.muted },
  loginHero: {
    backgroundColor: theme.colors.foreground,
    paddingHorizontal: 28,
    paddingTop: 72,
    paddingBottom: 72,
  },
  brandEyebrow: {
    color: theme.colors.border,
    fontSize: 12,
    fontFamily: theme.typography.bold,
    letterSpacing: 2.5,
  },
  loginTitle: {
    color: "#fff",
    fontSize: 34,
    lineHeight: 42,
    fontFamily: theme.typography.bold,
    marginTop: 8,
  },
  loginSubtitle: {
    color: theme.colors.border,
    fontFamily: theme.typography.regular,
    fontSize: 16,
    lineHeight: 23,
    marginTop: 8,
  },
  loginCard: {
    marginHorizontal: 20,
    marginTop: -32,
    gap: 14,
  },
  fieldLabel: {
    color: theme.colors.foreground,
    fontSize: 13,
    fontFamily: theme.typography.semibold,
    marginBottom: 7,
    marginTop: 13,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    color: theme.colors.primary,
    fontSize: 16,
    backgroundColor: theme.colors.muted,
  },
  error: {
    color: theme.colors.destructive,
    marginTop: 2,
    fontFamily: theme.typography.regular,
  },
  loginButton: { marginTop: 4 },
  primaryButton: {
    height: 52,
    borderRadius: 13,
    backgroundColor: "#dc2626",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: theme.typography.bold,
  },
  pressed: { opacity: 0.72 },
  homeSafe: { flex: 1, backgroundColor: theme.colors.muted },
  homeHeader: {
    minHeight: 112,
    backgroundColor: theme.colors.foreground,
    paddingHorizontal: 22,
    paddingVertical: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  homeGreeting: {
    color: "#fff",
    fontSize: 23,
    fontFamily: theme.typography.bold,
    marginTop: 5,
  },
  homeAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  homeContent: { padding: 22, gap: 8 },
  homeTitle: {
    color: theme.colors.foreground,
    fontSize: 26,
    fontFamily: theme.typography.bold,
  },
  homeSubtitle: {
    color: theme.colors.mutedForeground,
    fontFamily: theme.typography.regular,
    fontSize: 14,
    marginBottom: 16,
  },
  featureCard: {
    minHeight: 116,
    padding: 16,
    borderRadius: 18,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    elevation: 2,
  },
  featureIcon: {
    width: 58,
    height: 58,
    borderRadius: 17,
    backgroundColor: theme.colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  featureEmoji: {
    fontSize: 20,
    color: theme.colors.foreground,
    fontFamily: theme.typography.semibold,
  },
  featureCopy: { flex: 1 },
  featureTitle: {
    color: theme.colors.foreground,
    fontSize: 18,
    fontFamily: theme.typography.semibold,
  },
  featureDescription: {
    color: theme.colors.mutedForeground,
    fontFamily: theme.typography.regular,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
  },
  featureArrow: {
    color: theme.colors.foreground,
    fontSize: 32,
    fontFamily: theme.typography.regular,
  },
  appSafe: { flex: 1, backgroundColor: theme.colors.border },
  header: {
    height: 82,
    paddingHorizontal: 18,
    backgroundColor: theme.colors.foreground,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerEyebrow: {
    color: theme.colors.border,
    fontSize: 10,
    fontFamily: theme.typography.bold,
    letterSpacing: 1.6,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 24,
    fontFamily: theme.typography.bold,
    marginTop: 2,
  },
  backButton: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  backButtonText: {
    color: theme.colors.foreground,
    fontSize: 13,
    fontFamily: theme.typography.bold,
  },
  userInitial: {
    color: theme.colors.foreground,
    fontSize: 18,
    fontFamily: theme.typography.bold,
  },
  phoneToolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 8,
    backgroundColor: theme.colors.background,
  },
  toolbar: {
    minHeight: 68,
    flexWrap: "wrap",
    paddingVertical: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  dateArrow: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  dateArrowText: { color: theme.colors.foreground, fontSize: 28 },
  dateLabel: {
    minWidth: 125,
    textAlign: "center",
    color: theme.colors.primary,
    fontSize: 16,
    fontFamily: theme.typography.bold,
    textTransform: "capitalize",
  },
  todayLabel: {
    textAlign: "center",
    color: theme.colors.mutedForeground,
    fontSize: 10,
  },
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
  connectionText: {
    color: theme.colors.foreground,
    fontSize: 11,
    fontFamily: theme.typography.semibold,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: theme.colors.mutedForeground },
  board: { padding: 12, gap: 12, alignItems: "stretch" },
  column: {
    backgroundColor: theme.colors.muted,
    width: 288,
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  columnHeader: {
    height: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
  },
  statusMark: { width: 9, height: 9, borderRadius: 5 },
  columnTitle: {
    color: theme.colors.foreground,
    fontFamily: theme.typography.bold,
    fontSize: 15,
    flex: 1,
  },
  count: {
    minWidth: 28,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  countText: {
    color: theme.colors.foreground,
    fontSize: 12,
    fontFamily: theme.typography.bold,
  },
  cardList: { gap: 9, paddingBottom: 20, minHeight: 100 },
  emptyColumn: { color: theme.colors.ring, textAlign: "center", marginTop: 28 },
  orderCard: {
    backgroundColor: "#fff",
    borderRadius: 13,
    padding: 13,
    borderWidth: 1,
    borderColor: theme.colors.border,
    elevation: 2,
  },
  busyCard: { opacity: 0.5 },
  orderTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  command: {
    color: theme.colors.primary,
    fontSize: 21,
    fontFamily: theme.typography.bold,
  },
  elapsed: {
    color: theme.colors.foreground,
    fontSize: 17,
    fontFamily: theme.typography.bold,
    fontVariant: ["tabular-nums"],
  },
  orderMeta: {
    color: theme.colors.mutedForeground,
    fontSize: 12,
    marginTop: 6,
  },
  sizes: {
    color: theme.colors.foreground,
    fontSize: 13,
    fontFamily: theme.typography.bold,
    marginTop: 7,
  },
  customer: { color: theme.colors.mutedForeground, fontSize: 12, marginTop: 5 },
  cardHint: {
    color: theme.colors.ring,
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
    fontFamily: theme.typography.bold,
    textAlign: "center",
  },
  ovenTextActive: { color: "#fff" },
  footer: {
    height: 34,
    paddingHorizontal: 14,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerText: { color: theme.colors.mutedForeground, fontSize: 10 },
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
  modalTitle: {
    color: theme.colors.primary,
    fontSize: 21,
    fontFamily: theme.typography.bold,
  },
  modalSubtitle: {
    color: theme.colors.mutedForeground,
    fontSize: 13,
    marginTop: 4,
    marginBottom: 14,
  },
  statusOption: {
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  statusOptionCurrent: {
    borderColor: theme.colors.ring,
    backgroundColor: theme.colors.muted,
  },
  statusOptionText: {
    color: theme.colors.foreground,
    fontSize: 15,
    fontFamily: theme.typography.semibold,
    flex: 1,
  },
  currentText: {
    color: theme.colors.mutedForeground,
    fontSize: 11,
    fontFamily: theme.typography.semibold,
  },
});
