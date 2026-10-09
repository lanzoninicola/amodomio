import { OvenRequestsBar } from "./src/kds/OvenRequestsBar";
import { VoiceCommandButton } from "./src/kds/VoiceCommandButton";
import { OrderTiming } from "./src/kds/OrderTiming";
import { BrandLogo } from "./src/ui/BrandLogo";
import { Text, KdsTypographyContext } from "./src/ui/Text";
import { useDesktopWindow } from "./src/platform/useDesktopWindow";
import { DesktopBoard } from "./src/kds/DesktopBoard";
import { OvenRequestAlert } from "./src/kds/OvenRequestAlert";
import { Alert } from "./src/platform/alert";
import { desktop } from "./src/platform/desktop";
import { IconButton } from "./src/ui/IconButton";
import { DesktopToolbar } from "./src/ui/DesktopToolbar";
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
  Platform,
  AppState,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useNetInfo } from "@react-native-community/netinfo";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  ApiError,
  getMe,
  getServerPresets,
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
import { PhoneBoard, StatusFilters } from "./src/kds/PhoneBoard";
import {
  DEFAULT_SERVER_PRESETS,
  PUBLIC_SERVER_URL,
  type ServerPreset,
} from "./src/config/server-presets";
import { DateCalendar } from "./src/ui/DateCalendar";
import { ordersForDate } from "./src/kds/orders";
import { Badge } from "./src/ui/Badge";
import { Button } from "./src/ui/Button";
import { Card } from "./src/ui/Card";
import { Input } from "./src/ui/Input";
import { Screen } from "./src/ui/Screen";
import { theme } from "./src/ui/theme";

const DEFAULT_API_URL = process.env.EXPO_PUBLIC_API_URL || PUBLIC_SERVER_URL;
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
  const [serverPresets, setServerPresets] = useState<ServerPreset[]>(
    DEFAULT_SERVER_PRESETS
  );
  const serverEdited = useRef(false);
  const chooseServer = (url: string) => {
    serverEdited.current = true;
    setApiUrl(url);
    setError("");
  };
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    sessionStorage
      .getApiUrl()
      .then((stored) => {
        if (active && stored && !serverEdited.current) setApiUrl(stored);
      })
      .catch(() => {});
    getServerPresets(controller.signal)
      .then((servers) => {
        if (active) setServerPresets(servers);
      })
      .catch(() => {
        // Keep bundled shortcuts when the bootstrap server is unavailable.
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
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
        deviceLabel: `Amodomio · ${
          desktop
            ? "Amodomio Desktop"
            : Device.deviceName || Device.modelName || "Expo"
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
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <View style={styles.loginHero}>
          <BrandLogo light width={200} />
          <Text style={styles.loginTitle}>Bem-vindo</Text>
          <Text style={styles.loginSubtitle}>
            Entre para acessar as funcionalidades do Amodomio.
          </Text>
        </View>
        <Card style={styles.loginCard}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {serverPresets.map((server) => (
              <Button
                key={server.url}
                disabled={busy}
                variant={
                  apiUrl.trim().replace(/\/+$/, "") === server.url
                    ? "primary"
                    : "outline"
                }
                style={{ minHeight: 44 }}
                onPress={() => chooseServer(server.url)}
              >
                {server.name}
              </Button>
            ))}
          </View>
          <Input
            label="Servidor Amodomio"
            value={apiUrl}
            onChangeText={chooseServer}
            editable={!busy}
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
      </ScrollView>
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
            🔥 {order.requestedForOven ? "Cancelar aviso" : "Avisar forno"}
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
  const { widget } = useDesktopWindow();
  const isPhone =
    Device.deviceType === Device.DeviceType.PHONE ||
    (Device.deviceType !== Device.DeviceType.TABLET &&
      Math.min(width, height) < 600);
  const [boardMode, setBoardMode] = useState<"kanban" | "reduced">(() =>
    isPhone ? "reduced" : "kanban"
  );
  const reduced = boardMode === "reduced";
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const compactHeader = !desktop && reduced && width > height && width >= 800;
  const [date, setDate] = useState(localDate());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const currentDate = useRef(date);
  currentDate.current = date;
  const [loadedOrders, setOrders] = useState<KdsOrder[]>([]);
  const orders = useMemo(
    () => ordersForDate(loadedOrders, date),
    [loadedOrders, date]
  );
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
        const next = ordersForDate(await listOrders(apiUrl, token, date), date);
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
      if ((desktop || AppState.currentState === "active") && online)
        void load();
    }, POLLING_MS);
    return () => clearInterval(timer);
  }, [load, online]);
  const move = async (
    order: KdsOrder,
    status: KdsStatus,
    fulfillOvenRequest = false
  ) => {
    setSelected(null);
    if (mutatingId) return false;
    if (
      order.status === status &&
      !(fulfillOvenRequest && order.requestedForOven)
    )
      return true;
    if (!online) {
      Alert.alert("Sem conexão", "Reconecte para alterar o pedido.");
      return false;
    }
    const previous = orders;
    setMutatingId(order.id);
    setOrders((current) =>
      current.map((item) =>
        item.id === order.id
          ? {
              ...item,
              status,
              ...(fulfillOvenRequest ? { requestedForOven: false } : {}),
            }
          : item
      )
    );
    try {
      const updated = await updateStatus(
        apiUrl,
        token,
        order.id,
        status,
        fulfillOvenRequest
      );
      setOrders((current) =>
        current.map((item) => (item.id === order.id ? updated : item))
      );
      void load();
      return true;
    } catch (reason) {
      setOrders(previous);
      Alert.alert(
        "Pedido não atualizado",
        reason instanceof Error ? reason.message : "Tente novamente."
      );
      return false;
    } finally {
      setMutatingId(null);
    }
  };
  const toggleOven = async (order: KdsOrder) => {
    if (mutatingId) return;
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
      <View
        style={[
          styles.phoneToolbar,
          { gap: desktop ? 4 : 3, paddingHorizontal: desktop ? 4 : 6 },
        ]}
      >
        {!desktop && width >= 600 ? (
          <IconButton
            icon="previous"
            label="Dia anterior"
            disabled={Boolean(mutatingId)}
            onPress={() => setDate((value) => shiftDate(value, -1))}
          />
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Selecionar data: ${formatDate(date)}`}
          disabled={Boolean(mutatingId)}
          onPress={() => setCalendarOpen(true)}
          style={{
            flex: compactHeader ? undefined : 1,
            width: compactHeader ? 132 : undefined,
            minWidth: 0,
            minHeight: 48,
            justifyContent: "center",
            alignItems: "center",
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.secondary,
            paddingHorizontal: 4,
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              fontSize: 14,
              fontFamily: theme.typography.semibold,
              color: theme.colors.primary,
            }}
          >
            {widget || (!desktop && width < 600)
              ? date.split("-").reverse().slice(0, 2).join("/")
              : formatDate(date)}{" "}
            ⌄
          </Text>
        </Pressable>
        {!desktop && width >= 600 ? (
          <IconButton
            icon="next"
            label="Próximo dia"
            disabled={Boolean(mutatingId)}
            onPress={() => setDate((value) => shiftDate(value, 1))}
          />
        ) : null}
        {!desktop ? (
          <>
            <IconButton
              icon="kanban"
              label="Visão Kanban"
              caption="Kanban"
              active={!reduced}
              onPress={() => setBoardMode("kanban")}
            />
            <IconButton
              icon="reduced"
              label="Visão reduzida"
              caption="Reduzida"
              active={reduced}
              onPress={() => setBoardMode("reduced")}
            />
          </>
        ) : null}
        <IconButton
          icon="refresh"
          label="Atualizar pedidos"
          disabled={refreshing}
          onPress={() => load(true)}
        />
        <VoiceCommandButton
          key={`${date}:${apiUrl}`}
          orders={orders}
          disabled={!online || loading || Boolean(mutatingId)}
          onCommand={(order, command) =>
            move(order, command.status, command.status === "assando")
          }
        />
        <IconButton
          icon="home"
          label="Voltar ao início"
          caption="Início"
          onPress={onBack}
        />
        {compactHeader ? (
          <>
            <View
              style={{
                width: 1,
                height: 32,
                backgroundColor: theme.colors.border,
                marginHorizontal: 10,
              }}
            />
            <StatusFilters
              orders={orders}
              filter={statusFilter}
              onFilterChange={setStatusFilter}
              compact
            />
          </>
        ) : null}
      </View>
      {!desktop ? (
        <OvenRequestsBar
          orders={orders}
          busy={Boolean(mutatingId)}
          onBake={(order) => move(order, "assando")}
        />
      ) : null}
      {loading && !orders.length ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={styles.loadingText}>Carregando pedidos…</Text>
        </View>
      ) : desktop ? (
        <DesktopBoard
          orders={orders}
          busy={Boolean(mutatingId)}
          onToggleOven={toggleOven}
          onChooseStatus={setSelected}
        />
      ) : reduced ? (
        <PhoneBoard
          filter={statusFilter}
          onFilterChange={setStatusFilter}
          hideFilters={compactHeader}
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
      <View style={[styles.footer, widget && { display: "none" }]}>
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
          <View
            style={[styles.modalCard, { maxHeight: "90%" }]}
            onStartShouldSetResponder={() => true}
          >
            <ScrollView>
              <Text style={styles.modalTitle}>
                Mover pedido #{selected?.commandNumber ?? "VL"}
              </Text>
              {selected ? (
                <OrderTiming
                  order={selected}
                  now={now}
                  useEntryTime={reduced}
                />
              ) : null}
              <Text style={styles.modalSubtitle}>Selecione a nova etapa</Text>
              {KDS_STATUSES.map((status) => (
                <Pressable
                  key={status.id}
                  style={[
                    styles.statusOption,
                    selected?.status === status.id &&
                      styles.statusOptionCurrent,
                  ]}
                  onPress={() => selected && move(selected, status.id)}
                >
                  <View
                    style={[
                      styles.statusMark,
                      { backgroundColor: status.color },
                    ]}
                  />
                  <Text style={styles.statusOptionText}>{status.label}</Text>
                  {selected?.status === status.id ? (
                    <Text style={styles.currentText}>Atual</Text>
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function AppContent() {
  const [fontsLoaded, fontError] = useFonts({
    IBMPlexMono_Regular: require("./assets/fonts/IBMPlexMono-Regular.ttf"),
    IBMPlexMono_SemiBold: require("./assets/fonts/IBMPlexMono-SemiBold.ttf"),
    IBMPlexMono_Bold: require("./assets/fonts/IBMPlexMono-Bold.ttf"),
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
    if (Platform.OS === "web") return;
    ScreenOrientation.unlockAsync().catch(() => {
      // Browsers and devices with rotation lock may decline the request.
    });
  }, []);

  useEffect(() => {
    void prepareNotifications();
    Promise.all([sessionStorage.getToken(), sessionStorage.getApiUrl()])
      .then(async ([token, apiUrl]) => {
        if (token && apiUrl) {
          try {
            const result = await getMe(apiUrl, token);
            setSession({ token, apiUrl, user: result.user });
          } catch {
            await sessionStorage.clearToken();
          }
        }
        setBooting(false);
      })
      .catch(() => setBooting(false));
  }, []);
  const renderScreen = () => {
    if (booting || (!fontsLoaded && !fontError))
      return (
        <Screen style={styles.splash}>
          <StatusBar style="light" />
          <BrandLogo light width={240} />
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
        <KdsTypographyContext.Provider value={true}>
          <KanbanScreen
            token={session.token}
            apiUrl={session.apiUrl}
            onBack={() => setActiveFeature(null)}
            onUnauthorized={() => {
              setActiveFeature(null);
              setSession(null);
            }}
          />
        </KdsTypographyContext.Provider>
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
  };
  return (
    <>
      {renderScreen()}
      {session ? (
        <KdsTypographyContext.Provider value={true}>
          <OvenRequestAlert
            key={`${session.user.id}:${session.apiUrl}`}
            token={session.token}
            apiUrl={session.apiUrl}
          />
        </KdsTypographyContext.Provider>
      ) : null}
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <DesktopToolbar />
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: theme.colors.primary,
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
    backgroundColor: theme.colors.primary,
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
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.primary,
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
    backgroundColor: theme.colors.primary,
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
  appSafe: { flex: 1, backgroundColor: "#000000" },
  header: {
    height: 82,
    paddingHorizontal: 18,
    backgroundColor: theme.colors.primary,
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
    backgroundColor: "#000000",
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
  loadingText: { color: "#a3a3a3" },
  board: { padding: 12, gap: 12, alignItems: "stretch" },
  column: {
    backgroundColor: "#101010",
    width: 288,
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: "#333333",
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
    color: "#ffffff",
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
  emptyColumn: { color: "#a3a3a3", textAlign: "center", marginTop: 28 },
  orderCard: {
    backgroundColor: "#282828",
    borderRadius: theme.radius.lg,
    padding: 13,
    borderWidth: 1,
    borderColor: "#444444",
    elevation: 2,
  },
  busyCard: { opacity: 0.5 },
  orderTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  command: {
    color: "#ffffff",
    fontSize: 21,
    fontFamily: theme.typography.bold,
  },
  elapsed: {
    color: "#ffffff",
    fontSize: 17,
    fontFamily: theme.typography.bold,
    fontVariant: ["tabular-nums"],
  },
  orderMeta: {
    color: "#b3b3b3",
    fontSize: 12,
    marginTop: 6,
  },
  sizes: {
    color: "#ffffff",
    fontSize: 13,
    fontFamily: theme.typography.bold,
    marginTop: 7,
  },
  customer: { color: "#b3b3b3", fontSize: 12, marginTop: 5 },
  cardHint: {
    color: "#b3b3b3",
    fontSize: 10,
    textAlign: "right",
    marginTop: 9,
  },
  ovenButton: {
    borderWidth: 1,
    borderColor: theme.colors.brandOrange,
    backgroundColor: theme.colors.brandOrangeMuted,
    borderRadius: 9,
    padding: 8,
    marginTop: 10,
  },
  ovenButtonActive: { backgroundColor: theme.colors.primary },
  ovenText: {
    color: theme.colors.brandOrangeInk,
    fontSize: 12,
    fontFamily: theme.typography.bold,
    textAlign: "center",
  },
  ovenTextActive: { color: "#fff" },
  footer: {
    height: 34,
    paddingHorizontal: 14,
    backgroundColor: "#000000",
    borderTopWidth: 1,
    borderTopColor: "#333333",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerText: { color: "#a3a3a3", fontSize: 10 },
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
