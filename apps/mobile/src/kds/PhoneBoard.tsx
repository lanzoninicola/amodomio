import { Alert } from "../platform/alert";
import { elapsedSince } from "./order-time";
import { Text } from "../ui/Text";
import {
  FlatList,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { Card } from "../ui/Card";
import { theme } from "../ui/theme";
import {
  KDS_STATUSES,
  getKdsStatusStyle,
  type KdsOrder,
  type KdsStatus,
} from "./types";

function OrderTimeAlert({
  enteredAt,
  now,
}: {
  enteredAt: string;
  now: number;
}) {
  const minutes = (now - new Date(enteredAt).getTime()) / 60_000;
  if (!Number.isFinite(minutes) || minutes < 40) return null;
  const urgent = minutes >= 60;
  const message = urgent
    ? "Pedido com 60 minutos ou mais"
    : "Pedido com 40 minutos ou mais";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Ver alerta de tempo do pedido"
      accessibilityHint={message}
      onPress={() => Alert.alert("Alerta do pedido", message)}
      style={[
        styles.timeAlert,
        {
          backgroundColor: urgent
            ? theme.colors.dangerMuted
            : theme.colors.brandYellowMuted,
        },
      ]}
    >
      <Text
        style={[
          styles.timeAlertIcon,
          {
            color: urgent
              ? theme.colors.brandRedInk
              : theme.colors.brandOrangeInk,
          },
        ]}
      >
        !
      </Text>
    </Pressable>
  );
}

const filters = KDS_STATUSES.filter((status) => status.id !== "emProducao").map(
  (status) => ({
    ...status,
    shortLabel: {
      novoPedido: "Novo",
      aguardandoForno: "Aguardando forno",
      assando: "Assando",
      finalizado: "Pronto",
      emProducao: "Preparo",
    }[status.id],
    background: status.tint,
  })
);

export function StatusFilters({
  orders,
  filter,
  onFilterChange,
  compact = false,
}: {
  orders: KdsOrder[];
  filter: string | null;
  onFilterChange: (value: string | null) => void;
  compact?: boolean;
}) {
  return (
    <View style={[styles.filters, compact && styles.compactFilters]}>
      {filters.map((status) => (
        <Pressable
          key={status.id}
          accessibilityRole="button"
          accessibilityLabel={status.label}
          accessibilityState={{ selected: filter === status.id }}
          onPress={() =>
            onFilterChange(filter === status.id ? null : status.id)
          }
          style={[
            styles.filter,
            compact && styles.compactFilter,
            {
              borderColor:
                filter === status.id ? status.color : theme.colors.border,
              backgroundColor:
                filter === status.id ? status.background : theme.colors.card,
            },
          ]}
        >
          <Text
            numberOfLines={2}
            style={[
              styles.filterText,
              compact && styles.compactFilterText,
              {
                color:
                  filter === status.id
                    ? status.color
                    : theme.colors.mutedForeground,
              },
            ]}
          >
            {status.shortLabel} (
            {orders.filter((order) => order.status === status.id).length})
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function PhoneBoard({
  orders,
  now,
  busy,
  refreshing,
  onRefresh,
  onMove,
  onChooseStatus,
  filter,
  onFilterChange,
  hideFilters = false,
}: {
  orders: KdsOrder[];
  now: number;
  busy: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onMove: (order: KdsOrder, status: KdsStatus) => void;
  onChooseStatus: (order: KdsOrder) => void;
  filter: string | null;
  onFilterChange: (value: string | null) => void;
  hideFilters?: boolean;
}) {
  const { width, height } = useWindowDimensions();
  const columns = width > height && width >= 700 ? 4 : 2;
  const visible = orders.filter((order) =>
    filter ? order.status === filter : order.status !== "finalizado"
  );
  return (
    <View style={styles.board}>
      {!hideFilters ? (
        <StatusFilters
          orders={orders}
          filter={filter}
          onFilterChange={onFilterChange}
        />
      ) : null}
      <FlatList
        key={columns}
        numColumns={columns}
        data={visible}
        extraData={now}
        keyExtractor={(order) => order.id}
        refreshing={refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={styles.list}
        columnWrapperStyle={styles.row}
        ListEmptyComponent={
          <Text style={styles.empty}>Nenhum pedido neste filtro.</Text>
        }
        renderItem={({ item: order }) => {
          const statusStyle = getKdsStatusStyle(order.status);
          const finished = order.status === "finalizado";
          const endTime = finished
            ? order.finalizadoAt
              ? new Date(order.finalizadoAt).getTime()
              : NaN
            : now;
          const statusIndex = filters.findIndex(
            (entry) => entry.id === order.status
          );
          const previous = filters[statusIndex - 1];
          const next = filters[statusIndex + 1];
          return (
            <Card
              style={{
                ...styles.card,
                width: columns === 2 ? "48.8%" : "24%",
                borderColor:
                  order.requestedForOven && order.status === "aguardandoForno"
                    ? theme.colors.brandOrange
                    : "#444444",
              }}
            >
              <View style={styles.header}>
                <Text
                  style={styles.number}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  #{order.commandNumber ?? "VL"}
                </Text>
                <Text style={styles.statusLabel}>{statusStyle.label}</Text>
              </View>
              <View style={styles.orderTime}>
                <Text style={styles.timeLabel}>Horário pedido</Text>
                <Text style={styles.time}>
                  {new Date(
                    order.novoPedidoAt ?? order.createdAt
                  ).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })}
                </Text>
                {!finished && (
                  <OrderTimeAlert
                    enteredAt={order.novoPedidoAt ?? order.createdAt}
                    now={now}
                  />
                )}
              </View>

              <View style={styles.controls}>
                <View style={styles.statusControl}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      previous
                        ? `Voltar para ${previous.label}`
                        : "Sem status anterior"
                    }
                    disabled={busy || !previous}
                    onPress={() => previous && onMove(order, previous.id)}
                    style={[
                      styles.arrow,
                      (busy || !previous) && styles.disabled,
                    ]}
                  >
                    <Text style={styles.arrowText}>‹</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Escolher status"
                    disabled={busy}
                    onPress={() => onChooseStatus(order)}
                    style={styles.currentStatus}
                  >
                    <Text style={styles.actionText}>{statusStyle.label}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      next ? `Avançar para ${next.label}` : "Sem próximo status"
                    }
                    disabled={busy || !next}
                    onPress={() => next && onMove(order, next.id)}
                    style={[styles.arrow, (busy || !next) && styles.disabled]}
                  >
                    <Text style={styles.arrowText}>›</Text>
                  </Pressable>
                </View>
              </View>
              <View style={styles.finishRow}>
                <View style={styles.elapsedBlock}>
                  <Text style={styles.timeLabel}>Tempo corrido</Text>
                  <Text style={styles.elapsedTime} numberOfLines={1}>
                    {elapsedSince(
                      order.novoPedidoAt ?? order.createdAt,
                      endTime
                    )
                      .replace("h ", "h")
                      .replace("mm", "m")}
                  </Text>
                </View>
                {finished ? (
                  <Text style={styles.finishedTime}>
                    {order.finalizadoAt
                      ? `Finalizado às ${new Date(
                          order.finalizadoAt
                        ).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })}`
                      : "Horário de finalização indisponível"}
                  </Text>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Finalizar pedido ${
                      order.commandNumber ?? "VL"
                    }`}
                    disabled={busy}
                    onPress={() => onMove(order, "finalizado")}
                    style={({ pressed }) => [
                      styles.finishButton,
                      (pressed || busy) && styles.disabled,
                    ]}
                  >
                    <Text style={styles.finishText}>✓</Text>
                  </Pressable>
                )}
              </View>
            </Card>
          );
        }}
      />
    </View>
  );
}

const mono = "IBMPlexMono_Regular";
const styles = StyleSheet.create({
  board: { flex: 1, backgroundColor: "#000000" },
  filters: {
    flexDirection: "row",
    gap: 8,
    padding: 8,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
  },
  filter: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 3,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: theme.radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  compactFilters: {
    padding: 0,
    borderBottomWidth: 0,
    flexShrink: 1,
    width: 400,
    minWidth: 300,
    maxWidth: 400,
    marginLeft: "auto",
    gap: 4,
  },
  compactFilter: { flex: 1, minWidth: 68, paddingHorizontal: 6 },
  compactFilterText: { fontSize: 10, fontFamily: "IBMPlexMono_Regular" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  statusLabel: {
    color: "#fdbc12",
    fontSize: 14,
    fontFamily: "IBMPlexMono_SemiBold",
    flexShrink: 1,
    textAlign: "right",
  },
  orderTime: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  timeLabel: { color: "#a3a3a3", fontSize: 10, fontFamily: mono },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: "#333",
  },
  statusControl: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    borderWidth: 1,
    borderColor: "#fff",
    backgroundColor: "#fff",
    borderRadius: 4,
  },
  arrow: {
    minWidth: 32,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowText: { color: "#080808", fontSize: 26, fontFamily: mono },
  currentStatus: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  finishRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 12,
  },
  elapsedBlock: { flex: 1, alignItems: "flex-start", gap: 4 },
  elapsedTime: {
    fontSize: 18,
    fontFamily: "IBMPlexMono_Bold",
    color: "#fff",
    fontVariant: ["tabular-nums"],
  },
  finishedTime: {
    fontSize: 11,
    color: "#aec355",
    fontFamily: mono,
    flex: 1,
  },
  finishButton: {
    width: 44,
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#e1ebd8",
    backgroundColor: "#e1ebd8",
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  filterText: {
    fontFamily: theme.typography.bold,
    fontSize: 12,
    textAlign: "center",
  },
  list: { padding: 8, paddingBottom: 20 },
  row: { justifyContent: "space-between", marginBottom: 8 },
  card: {
    padding: 10,
    borderWidth: 1,
    borderColor: "#444444",
    borderRadius: theme.radius.lg,
    backgroundColor: "#282828",
  },
  summary: { alignItems: "center", paddingVertical: 6, minHeight: 64 },
  number: {
    fontFamily: "IBMPlexMono_Bold",
    fontSize: 30,
    color: "#fff",
  },
  time: {
    fontSize: 12,
    fontFamily: mono,
    color: "#fff",
    fontVariant: ["tabular-nums"],
  },
  timeAlert: {
    marginLeft: "auto",
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
  },
  timeAlertIcon: {
    fontSize: 18,
    fontFamily: "IBMPlexMono_Bold",
    lineHeight: 22,
  },
  finishText: {
    fontSize: 22,
    fontFamily: "IBMPlexMono_SemiBold",
    color: "#080808",
    textAlign: "center",
  },
  actionText: {
    fontSize: 16,
    fontFamily: "IBMPlexMono_SemiBold",
    color: "#080808",
    textAlign: "center",
  },
  disabled: { opacity: 0.5 },
  empty: {
    textAlign: "center",
    padding: 24,
    color: "#a3a3a3",
  },
});
