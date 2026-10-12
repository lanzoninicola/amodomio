import { elapsedSince } from "./order-time";
import { OrderContact } from "./OrderContact";
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

function OvenStatusIcon({
  waiting,
  color,
}: {
  waiting: boolean;
  color: string;
}) {
  return (
    <View
      accessible={false}
      pointerEvents="none"
      style={{
        width: 28,
        height: 28,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {waiting ? (
        <View
          style={{
            width: 24,
            height: 24,
            borderWidth: 2,
            borderColor: color,
            borderRadius: 12,
          }}
        >
          <View
            style={{
              position: "absolute",
              left: 9,
              top: 3,
              width: 2,
              height: 8,
              backgroundColor: color,
            }}
          />
          <View
            style={{
              position: "absolute",
              left: 9,
              top: 9,
              width: 7,
              height: 2,
              backgroundColor: color,
            }}
          />
        </View>
      ) : (
        <View
          style={{
            width: 24,
            height: 26,
            alignItems: "center",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 12,
              borderTopLeftRadius: 1,
              backgroundColor: color,
              transform: [{ rotate: "45deg" }],
            }}
          />
          <View
            style={{
              position: "absolute",
              bottom: 2,
              width: 8,
              height: 8,
              borderRadius: 5,
              borderTopLeftRadius: 0,
              backgroundColor: color === "#ffffff" ? "#282828" : "#ffffff",
              transform: [{ rotate: "45deg" }],
            }}
          />
        </View>
      )}
    </View>
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
  onContact,
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
  onContact: (order: KdsOrder) => void;
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
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Ver detalhes do pedido ${
                    order.commandNumber ?? "VL"
                  }`}
                  disabled={busy}
                  onPress={() => onChooseStatus(order)}
                  style={({ pressed }) => ({
                    minHeight: 44,
                    justifyContent: "center",
                    flexShrink: 1,
                    opacity: busy || pressed ? 0.5 : 1,
                  })}
                >
                  <Text
                    style={styles.number}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    #{order.commandNumber ?? "VL"}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Alterar status do pedido ${
                    order.commandNumber ?? "VL"
                  }: ${statusStyle.label}`}
                  disabled={busy}
                  onPress={() => onChooseStatus(order)}
                  style={{
                    minHeight: 44,
                    justifyContent: "center",
                    flexShrink: 1,
                  }}
                >
                  <Text style={styles.statusLabel}>{statusStyle.label}</Text>
                </Pressable>
              </View>
              <OrderContact order={order} onContact={onContact} busy={busy} />
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
              </View>

              {!finished && (
                <View style={styles.controls}>
                  {(["aguardandoForno", "assando"] as const).map((status) => {
                    const target = getKdsStatusStyle(status);
                    const current = order.status === status;
                    const buttonColor =
                      status === "aguardandoForno"
                        ? current
                          ? theme.colors.brandOrange
                          : "transparent"
                        : current
                        ? theme.colors.brandYellow
                        : "transparent";
                    return (
                      <Pressable
                        key={status}
                        accessibilityRole="button"
                        accessibilityLabel={`Mover pedido ${
                          order.commandNumber ?? "VL"
                        } para ${target.label}`}
                        accessibilityState={{
                          selected: current,
                          disabled: busy || current,
                        }}
                        disabled={busy || current}
                        onPress={() => onMove(order, status)}
                        style={({ pressed }) => [
                          styles.statusButton,
                          {
                            backgroundColor: buttonColor,
                            borderColor: current
                              ? buttonColor
                              : "rgba(255, 255, 255, 0.25)",
                          },
                          (pressed || busy) && styles.disabled,
                        ]}
                      >
                        <OvenStatusIcon
                          waiting={status === "aguardandoForno"}
                          color={current ? "#282828" : "#ffffff"}
                        />
                        <Text
                          style={[
                            styles.actionText,
                            !current && { color: "#ffffff" },
                          ]}
                        >
                          {target.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
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
                {finished && (
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
    borderRadius: theme.radius.md,
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
  compactFilter: { flex: 1, minWidth: 68, minHeight: 48, paddingHorizontal: 6 },
  compactFilterText: { fontSize: 12, fontFamily: "IBMPlexMono_SemiBold" },
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
    gap: 8,
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: "#333",
  },
  statusButton: {
    flex: 1,
    minWidth: 0,
    height: 96,
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#fff",
    backgroundColor: "#fff",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  finishRow: {
    gap: 8,
    marginTop: 12,
  },
  elapsedBlock: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  elapsedTime: {
    fontSize: 28,
    textAlign: "right",
    fontFamily: "IBMPlexMono_Bold",
    color: "#fff",
    fontVariant: ["tabular-nums"],
  },
  finishedTime: {
    fontSize: 11,
    color: "#aec355",
    fontFamily: mono,
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
    fontSize: 40,
    color: "#fff",
  },
  time: {
    fontSize: 12,
    fontFamily: mono,
    color: "#fff",
    fontVariant: ["tabular-nums"],
  },
  actionText: {
    fontSize: 11,
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
