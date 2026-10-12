import AsyncStorage from "@react-native-async-storage/async-storage";
import { orderWhatsappTemplate } from "./src/kds/whatsapp-templates";
import { OrderContact } from "./src/kds/OrderContact";
import { OvenRequestsBar } from "./src/kds/OvenRequestsBar";
import { VoiceCommandButton } from "./src/kds/VoiceCommandButton";
import { OrderTiming } from "./src/kds/OrderTiming";
import { ToolbarLayout } from "./src/kds/ToolbarLayout";
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
  getWhatsappConfig,
  sendOrderWhatsapp,
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
import {
  notifyNewOrders,
  notifyAwaitingOven,
  prepareNotifications,
} from "./src/kds/notifications";
import { newlyAwaitingOven } from "./src/kds/awaiting-oven";
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
import { averageCompletionMinutes } from "./src/kds/order-time";
import { Badge } from "./src/ui/Badge";
import { Button } from "./src/ui/Button";
import { Card } from "./src/ui/Card";
import { Input } from "./src/ui/Input";
import { Screen } from "./src/ui/Screen";
import { theme } from "./src/ui/theme";

const DEFAULT_API_URL = desktop
  ? PUBLIC_SERVER_URL
  : process.env.EXPO_PUBLIC_API_URL || PUBLIC_SERVER_URL;
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
    setApiUrl(desktop ? PUBLIC_SERVER_URL : url);
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
        if (active && stored && !serverEdited.current && !desktop)
          setApiUrl(stored);
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
            {(desktop
              ? DEFAULT_SERVER_PRESETS.filter(
                  (server) => server.url === PUBLIC_SERVER_URL
                )
              : serverPresets
            ).map((server) => (
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
            editable={!busy && !desktop}
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
  onContact,
}: {
  order: KdsOrder;
  now: number;
  busy: boolean;
  onChooseStatus: () => void;
  onToggleOven: () => void;
  onContact: (order: KdsOrder) => void;
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
      <OrderContact order={order} onContact={onContact} busy={busy} />
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
  useEffect(
    () => () => {
      void desktop?.setWidget(false).catch(() => {});
    },
    []
  );
  const [boardMode, setBoardMode] = useState<"kanban" | "reduced">(() =>
    desktop ? "kanban" : "reduced"
  );
  const reduced = boardMode === "reduced";
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const compactHeader = !desktop && reduced && width > height && width >= 800;
  const [date, setDate] = useState(localDate());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [contactOrder, setContactOrder] = useState<KdsOrder | null>(null);
  const [contactMessage, setContactMessage] = useState("");
  const [useContactTemplate, setUseContactTemplate] = useState(true);
  const [contactSuccess, setContactSuccess] = useState("");
  const [sentMessages, setSentMessages] = useState<
    Record<string, { status: string; sentAt: string }>
  >({});
  const sentMessagesKey = `amodomio.kds.whatsapp.sent:${apiUrl}`;
  useEffect(() => {
    let active = true;
    setSentMessages({});
    void AsyncStorage.getItem(sentMessagesKey)
      .then((raw) => {
        if (!active || !raw) return;
        const entries = JSON.parse(raw);
        if (entries && typeof entries === "object" && !Array.isArray(entries)) {
          const valid = Object.fromEntries(
            Object.entries(entries).filter(([, value]) => {
              const entry = value as {
                status?: unknown;
                sentAt?: unknown;
              } | null;
              return (
                entry &&
                typeof entry.status === "string" &&
                typeof entry.sentAt === "string" &&
                Number.isFinite(new Date(entry.sentAt).getTime())
              );
            })
          );
          setSentMessages((current) => ({ ...valid, ...current }));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [sentMessagesKey]);
  const [contactEnabled, setContactEnabled] = useState(false);
  const [contactBusy, setContactBusy] = useState(false);
  const contactInFlight = useRef(false);
  const [contactError, setContactError] = useState("");
  const openContact = async (order: KdsOrder) => {
    if (contactInFlight.current || !order.customerPhone?.trim()) return;
    setContactOrder(order);
    setContactMessage(orderWhatsappTemplate(order));
    setUseContactTemplate(true);
    setContactSuccess("");
    setContactError("");
    setContactEnabled(false);
    setContactBusy(true);
    try {
      const config = await getWhatsappConfig(apiUrl, token);
      setContactEnabled(config.enabled);
      if (!config.enabled)
        setContactError(
          "Ative cozinha-whatsapp-enabled em /admin/administracao/settings para enviar mensagens."
        );
    } catch (error) {
      setContactError(
        error instanceof Error
          ? error.message
          : "Não foi possível consultar a configuração."
      );
    } finally {
      setContactBusy(false);
    }
  };
  const contactText = contactMessage;
  const sendContact = async () => {
    if (
      !contactOrder ||
      contactInFlight.current ||
      contactSuccess ||
      !contactOrder.customerPhone?.trim() ||
      contactBusy ||
      !contactEnabled ||
      !contactText.trim()
    )
      return;
    contactInFlight.current = true;
    setContactBusy(true);
    setContactError("");
    try {
      const result = await sendOrderWhatsapp(
        apiUrl,
        token,
        contactOrder.id,
        contactText
      );
      if (result.ok !== true)
        throw new Error(
          "A API não confirmou o envio. Confira o resultado antes de tentar novamente."
        );
      const next = {
        ...sentMessages,
        [contactOrder.id]: {
          status:
            KDS_STATUSES.find((status) => status.id === contactOrder.status)
              ?.label ?? contactOrder.status,
          sentAt: new Date().toISOString(),
        },
      };
      setSentMessages(next);
      setContactSuccess(
        "Mensagem enviada com sucesso. Envio confirmado pela API."
      );
      try {
        await AsyncStorage.setItem(sentMessagesKey, JSON.stringify(next));
      } catch {
        setContactSuccess(
          "Mensagem enviada com sucesso, mas não foi possível salvar a indicação neste dispositivo."
        );
      }
    } catch (error) {
      setContactError(
        error instanceof Error
          ? error.message
          : "Não foi possível enviar. Confira o resultado antes de tentar novamente."
      );
    } finally {
      contactInFlight.current = false;
      setContactBusy(false);
    }
  };
  const currentDate = useRef(date);
  currentDate.current = date;
  const [loadedOrders, setOrders] = useState<KdsOrder[]>([]);
  const orders = useMemo(
    () => ordersForDate(loadedOrders, date),
    [loadedOrders, date]
  );
  const completion = useMemo(() => averageCompletionMinutes(orders), [orders]);
  const completionSummary = (
    <View
      style={[
        styles.completionSummary,
        compactHeader && styles.completionSummaryInline,
      ]}
      accessibilityLabel={`Tempo médio de finalização: ${
        completion.minutes === null
          ? "sem dados"
          : `${Math.round(completion.minutes)} minutos`
      }. ${
        completion.count
      } pedidos finalizados com tempo válido na data selecionada.`}
    >
      <Text style={styles.completionLabel}>Tempo médio</Text>
      <Text style={styles.completionValue}>
        {completion.minutes === null
          ? "—"
          : `${Math.round(completion.minutes)} min`}
      </Text>
      <Text style={styles.completionLabel}>{completion.count} finalizados</Text>
    </View>
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<KdsOrder | null>(null);
  const [now, setNow] = useState(Date.now());
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const knownIds = useRef<Set<string> | null>(null);
  const knownStatuses = useRef<Map<string, string> | null>(null);
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
        const awaiting = newlyAwaitingOven(next, knownStatuses.current);
        if (desktop && awaiting.length)
          void notifyAwaitingOven(awaiting.map((order) => order.commandNumber));
        knownStatuses.current = new Map(
          next.map((order) => [order.id, order.status])
        );
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
    knownStatuses.current = null;
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
      if (currentDate.current === date) {
        if (
          desktop &&
          updated.status === "aguardandoForno" &&
          order.status !== "aguardandoForno" &&
          knownStatuses.current?.get(updated.id) !== "aguardandoForno"
        )
          void notifyAwaitingOven([updated.commandNumber]);
        knownStatuses.current?.set(updated.id, updated.status);
      }
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
      <ToolbarLayout compact={compactHeader}>
        <View
          style={[
            styles.toolbarControls,
            compactHeader && styles.toolbarControlsCompact,
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
              width: compactHeader ? 116 : undefined,
              minWidth: 0,
              minHeight: 48,
              justifyContent: "center",
              alignItems: "center",
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.secondary,
              paddingHorizontal: 10,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                fontSize: 14,
                fontFamily: theme.typography.semibold,
                color: desktop ? theme.colors.foreground : theme.colors.primary,
              }}
            >
              {date
                .split("-")
                .reverse()
                .map((part, index) => (index === 2 ? part.slice(-2) : part))
                .join("/")}{" "}
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
                active={!reduced}
                onPress={() => setBoardMode("kanban")}
              />
              <IconButton
                icon="reduced"
                label="Visão reduzida"
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
          {desktop ? (
            <>
              <IconButton
                icon="widget"
                label={widget ? "Sair do modo widget" : "Modo widget"}
                active={widget}
                onPress={() => {
                  void desktop
                    .setWidget(!widget)
                    .catch(() =>
                      Alert.alert("Não foi possível ajustar a janela.")
                    );
                }}
              />
              <IconButton
                icon="settings"
                label="Configurações do KDS"
                onPress={() => {
                  void desktop
                    .openFeatureSettings("kds")
                    .catch(() =>
                      Alert.alert("Não foi possível abrir as configurações.")
                    );
                }}
              />
            </>
          ) : (
            <IconButton icon="home" label="Voltar ao início" onPress={onBack} />
          )}
        </View>
        {compactHeader ? (
          <>
            {completionSummary}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.toolbarFilters}
              contentContainerStyle={styles.toolbarFiltersContent}
            >
              <StatusFilters
                orders={orders}
                filter={statusFilter}
                onFilterChange={setStatusFilter}
                compact
              />
            </ScrollView>
          </>
        ) : null}
      </ToolbarLayout>
      {!desktop && !compactHeader ? completionSummary : null}
      {!desktop ? (
        <OvenRequestsBar
          orders={orders}
          busy={Boolean(mutatingId)}
          onBake={(order) => move(order, "assando")}
          onFinish={(order) => move(order, "finalizado")}
        />
      ) : null}
      {desktop ? (
        <DesktopBoard
          orders={orders}
          now={now}
          loading={loading}
          busy={loading || Boolean(mutatingId)}
          onToggleOven={toggleOven}
          onChooseStatus={setSelected}
          onContact={openContact}
          sentMessages={sentMessages}
        />
      ) : loading && !orders.length ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={styles.loadingText}>Carregando pedidos…</Text>
        </View>
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
          onContact={openContact}
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
                    onContact={openContact}
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
        visible={Boolean(contactOrder)}
        transparent
        animationType="fade"
        onRequestClose={() => !contactBusy && setContactOrder(null)}
        supportedOrientations={[
          "portrait",
          "landscape-left",
          "landscape-right",
        ]}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: "90%" }]}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 14, padding: 20 }}
            >
              <Text style={styles.modalTitle}>
                WhatsApp · Pedido #{contactOrder?.commandNumber ?? "VL"}
              </Text>
              <Text style={styles.detailValue}>
                {contactOrder?.customerName || "Cliente"} ·{" "}
                {contactOrder?.customerPhone}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <Text style={styles.detailValue}>
                  Mensagem ·{" "}
                  {KDS_STATUSES.find(
                    (status) => status.id === contactOrder?.status
                  )?.label ?? contactOrder?.status}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Editar mensagem"
                  accessibilityState={{
                    disabled:
                      !contactEnabled || contactBusy || Boolean(contactSuccess),
                  }}
                  disabled={
                    !contactEnabled || contactBusy || Boolean(contactSuccess)
                  }
                  onPress={() => setUseContactTemplate(false)}
                  style={{
                    minWidth: 44,
                    minHeight: 44,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity:
                      !contactEnabled || contactBusy || contactSuccess
                        ? 0.3
                        : 1,
                  }}
                >
                  <Text style={[styles.detailValue, { fontSize: 24 }]}>✎</Text>
                </Pressable>
              </View>
              <Input
                accessibilityLabel="Mensagem de WhatsApp"
                multiline
                maxLength={4096}
                value={contactMessage}
                onChangeText={setContactMessage}
                editable={
                  !useContactTemplate &&
                  contactEnabled &&
                  !contactBusy &&
                  !contactSuccess
                }
                placeholder="Digite a mensagem para o cliente"
                style={{ minHeight: 140, textAlignVertical: "top" }}
              />
              {contactSuccess ? (
                <Text
                  accessibilityLiveRegion="polite"
                  style={{ color: "#25d366" }}
                >
                  {contactSuccess}
                </Text>
              ) : null}
              {contactError ? (
                <Text style={styles.error}>{contactError}</Text>
              ) : null}
              <Button
                onPress={sendContact}
                loading={contactBusy}
                disabled={
                  !contactEnabled ||
                  !contactText.trim() ||
                  Boolean(contactSuccess)
                }
              >
                {useContactTemplate ? "Enviar template" : "Enviar mensagem"}
              </Button>
              <Button
                variant="outline"
                disabled={contactBusy}
                onPress={() => setContactOrder(null)}
              >
                Fechar
              </Button>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
            <View style={styles.detailHeader}>
              <View style={{ flex: 1, gap: 8 }}>
                <Text style={styles.modalTitle}>
                  Pedido #{selected?.commandNumber ?? "VL"}
                </Text>
                <View style={styles.detailStatus}>
                  <View
                    style={[
                      styles.statusMark,
                      {
                        backgroundColor:
                          KDS_STATUSES.find(
                            (status) => status.id === selected?.status
                          )?.color ?? theme.colors.mutedForeground,
                      },
                    ]}
                  />
                  <Text style={styles.detailStatusText}>
                    {KDS_STATUSES.find(
                      (status) => status.id === selected?.status
                    )?.label ?? selected?.status}
                  </Text>
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fechar detalhes do pedido"
                onPress={() => setSelected(null)}
                style={({ pressed }) => [
                  styles.detailClose,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.detailCloseText}>×</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.detailContent}>
              {selected ? (
                <View>
                  <View style={styles.detailGroup}>
                    {[
                      [
                        "Horário de entrada",
                        new Date(
                          selected.novoPedidoAt ?? selected.createdAt
                        ).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        }),
                      ],
                      [
                        "Modalidade",
                        selected.takeAway ? "Retirada" : "Entrega",
                      ],
                      ["Cliente", selected.customerName || "Não informado"],
                      ["Telefone", selected.customerPhone || "Não informado"],
                      ["Canal", selected.channel || "Não informado"],
                      [
                        "Forno solicitado",
                        selected.requestedForOven ? "Sim" : "Não",
                      ],
                      [
                        "Tamanhos",
                        selected.sizes
                          ? Object.entries(selected.sizes)
                              .filter(([, count]) => count > 0)
                              .map(([size, count]) => `${count} ${size}`)
                              .join(" · ") || "Não informado"
                          : "Não informado",
                      ],
                    ].map(([label, value]) => (
                      <View key={label} style={styles.detailCell}>
                        <Text style={styles.detailLabel}>{label}</Text>
                        <Text style={styles.detailValue}>{value}</Text>
                      </View>
                    ))}
                  </View>
                  {selected.orderItems?.length ? (
                    <View style={styles.detailItems}>
                      <Text style={styles.detailSectionTitle}>
                        Pizzas e itens importados
                      </Text>
                      {selected.orderItems.map((item, index) => (
                        <View key={index} style={styles.detailItem}>
                          <Text style={styles.detailValue}>
                            {item.quantity}× {item.name}
                            {item.size ? ` · ${item.size}` : ""}
                          </Text>
                          {item.flavors.length ? (
                            <Text style={styles.detailLabel}>
                              Sabores: {item.flavors.join(" · ")}
                            </Text>
                          ) : null}
                          {item.notes.length ? (
                            <Text style={styles.detailLabel}>
                              {item.notes.join(" · ")}
                            </Text>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  ) : null}
                  <OrderTiming
                    order={selected}
                    now={now}
                    useEntryTime={reduced}
                    showStartTime={false}
                  />
                </View>
              ) : null}
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
  useEffect(() => desktop?.onOpenKds(() => setActiveFeature("kds")), []);
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
        if (desktop && apiUrl?.replace(/\/+$/, "") !== PUBLIC_SERVER_URL) {
          await sessionStorage.clearToken();
          await sessionStorage.setApiUrl(PUBLIC_SERVER_URL);
          setBooting(false);
          return;
        }
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
      <DesktopToolbar
        onHome={
          activeFeature === "kds" ? () => setActiveFeature(null) : undefined
        }
      />
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
    color: desktop ? theme.colors.foreground : theme.colors.primary,
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
    backgroundColor: desktop ? theme.colors.card : "#fff",
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
    backgroundColor: desktop ? theme.colors.card : "#fff",
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
  toolbarControls: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  toolbarControlsCompact: { flexGrow: 0, flexShrink: 0, flexBasis: "auto" },
  completionSummary: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#000000",
  },
  completionSummaryInline: {
    width: 150,
    flexShrink: 0,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "#444444",
  },
  completionLabel: { color: "#a3a3a3", fontSize: 10 },
  completionValue: {
    color: "#ffffff",
    fontSize: 20,
    fontFamily: theme.typography.bold,
    fontVariant: ["tabular-nums"],
  },
  toolbarFilters: { flex: 1, minWidth: 0 },
  toolbarFiltersContent: { flexGrow: 1, justifyContent: "flex-end" },
  toolbar: {
    minHeight: 68,
    flexWrap: "wrap",
    paddingVertical: 8,
    backgroundColor: desktop ? theme.colors.card : "#fff",
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
    color: desktop ? theme.colors.foreground : theme.colors.primary,
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
    backgroundColor: desktop ? theme.colors.card : "#fff",
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
    maxWidth: 480,
    backgroundColor: desktop ? theme.colors.card : "#fff",
    borderRadius: 20,
    overflow: "hidden",
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  detailStatus: { flexDirection: "row", alignItems: "center", gap: 8 },
  detailStatusText: {
    fontSize: 13,
    color: theme.colors.mutedForeground,
    flexShrink: 1,
  },
  detailClose: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: theme.colors.muted,
  },
  detailCloseText: { fontSize: 26, color: theme.colors.foreground },
  detailContent: { padding: 20, paddingTop: 16 },
  detailSectionTitle: {
    fontSize: 14,
    fontFamily: theme.typography.semibold,
    color: theme.colors.foreground,
    marginBottom: 10,
  },
  detailGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 12,
    rowGap: 16,
  },
  detailItems: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 12,
    gap: 16,
    marginTop: 16,
  },
  detailItem: { width: "100%", gap: 6 },
  detailCell: {
    width: "33.333%",
    paddingRight: 8,
    gap: 6,
  },
  detailLabel: {
    fontSize: 12,
    color: theme.colors.mutedForeground,
    flexShrink: 1,
  },
  detailValue: {
    fontSize: 14,
    fontFamily: theme.typography.semibold,
    color: theme.colors.foreground,
    textAlign: "left",
  },

  modalTitle: {
    color: desktop ? theme.colors.foreground : theme.colors.primary,
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
