import { useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { theme } from "../ui/theme";
import {
  KDS_STATUSES,
  getKdsStatusStyle,
  type KdsOrder,
  type KdsStatus,
} from "./types";

function elapsedSince(value: string, now: number) {
  const minutes = Math.max(
    0,
    Math.floor((now - new Date(value).getTime()) / 60_000)
  );
  if (!Number.isFinite(minutes)) return "--:--";
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(
    minutes % 60
  ).padStart(2, "0")}`;
}

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
  return (
    <View
      pointerEvents="none"
      accessible
      accessibilityLabel={
        urgent
          ? "Pedido com 60 minutos ou mais"
          : "Pedido com 40 minutos ou mais"
      }
      style={[
        styles.timeAlert,
        { backgroundColor: urgent ? "#fee2e2" : "#fef3c7" },
      ]}
    >
      <Text
        style={[
          styles.timeAlertIcon,
          { color: urgent ? "#b91c1c" : "#92400e" },
        ]}
      >
        {urgent ? "!" : "⚠"}
      </Text>
    </View>
  );
}

const filters = KDS_STATUSES.filter((status) => status.id !== "emProducao").map(
  (status) => ({
    ...status,
    shortLabel: {
      novoPedido: "NP",
      aguardandoForno: "AF",
      assando: "AS",
      finalizado: "F",
      emProducao: "EP",
    }[status.id],
    background: status.tint,
  })
);

export function PhoneBoard({
  orders,
  now,
  busy,
  refreshing,
  onRefresh,
  onMove,
  onChooseStatus,
}: {
  orders: KdsOrder[];
  now: number;
  busy: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onMove: (order: KdsOrder, status: KdsStatus) => void;
  onChooseStatus: (order: KdsOrder) => void;
}) {
  const { width, height } = useWindowDimensions();
  const columns = width > height ? 4 : 2;
  const [filter, setFilter] = useState<string | null>(null);
  const visible = orders.filter((order) =>
    filter ? order.status === filter : order.status !== "finalizado"
  );
  const requested = orders.filter(
    (order) => order.status === "aguardandoForno" && order.requestedForOven
  );
  return (
    <View style={styles.board}>
      <View style={styles.filters}>
        {filters.map((status) => (
          <Pressable
            key={status.id}
            accessibilityRole="button"
            accessibilityLabel={status.label}
            accessibilityState={{ selected: filter === status.id }}
            onPress={() =>
              setFilter((current) => (current === status.id ? null : status.id))
            }
            style={[
              styles.filter,
              {
                borderColor:
                  filter === status.id ? status.color : theme.colors.border,
                backgroundColor:
                  filter === status.id ? status.background : theme.colors.card,
              },
            ]}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[
                styles.filterText,
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
        ListHeaderComponent={
          filter !== "finalizado" && requested.length ? (
            <View style={styles.requests}>
              <Text style={styles.requestTitle}>Pedidos para assar</Text>
              <View style={styles.requestButtons}>
                {requested.map((order) => (
                  <Pressable
                    key={order.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Assar pedido ${
                      order.commandNumber ?? "VL"
                    }`}
                    disabled={busy}
                    onPress={() => onMove(order, "assando")}
                    style={[styles.requestButton, busy && styles.disabled]}
                  >
                    <Text style={styles.selectedText}>
                      #{order.commandNumber ?? "VL"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null
        }
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
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Pedido ${
                  order.commandNumber ?? "VL"
                }, ver etapas`}
                disabled={busy}
                onPress={() => onChooseStatus(order)}
                style={styles.summary}
              >
                <Text
                  style={styles.number}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  #{order.commandNumber ?? "VL"}
                </Text>
                <Text style={styles.statusLabel}>{statusStyle.label}</Text>
                <Text style={styles.time}>
                  {new Date(
                    order.novoPedidoAt ?? order.createdAt
                  ).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })}
                  {" | "}
                  <Text style={styles.elapsedTime}>
                    {elapsedSince(
                      order.novoPedidoAt ?? order.createdAt,
                      endTime
                    )}
                  </Text>
                </Text>
              </Pressable>
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
                <>
                  <View style={styles.actions}>
                    {filters
                      .filter(
                        (status) =>
                          status.id === "aguardandoForno" ||
                          status.id === "assando"
                      )
                      .map((status) => (
                        <Button
                          key={status.id}
                          variant={
                            order.status === status.id ? "primary" : "outline"
                          }
                          disabled={busy}
                          onPress={() => {
                            if (order.status !== status.id)
                              onMove(order, status.id);
                          }}
                          style={{
                            ...styles.action,
                            borderColor:
                              order.status === status.id
                                ? status.color
                                : theme.colors.border,
                            backgroundColor:
                              order.status === status.id
                                ? status.color
                                : theme.colors.card,
                          }}
                        >
                          <Text
                            style={[
                              styles.actionText,
                              {
                                color:
                                  order.status === status.id
                                    ? "#fff"
                                    : theme.colors.mutedForeground,
                              },
                            ]}
                          >
                            {status.shortLabel}
                          </Text>
                        </Button>
                      ))}
                  </View>
                </>
              )}
              {!finished && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Finalizar pedido ${
                    order.commandNumber ?? "VL"
                  }`}
                  accessibilityHint="Move o pedido para Finalizados"
                  disabled={busy}
                  onPress={() => onMove(order, "finalizado")}
                  style={({ pressed }) => [
                    styles.finishButton,
                    (pressed || busy) && styles.disabled,
                  ]}
                >
                  <Text style={styles.finishIcon}>×</Text>
                </Pressable>
              )}
              {!finished && (
                <OrderTimeAlert
                  enteredAt={order.novoPedidoAt ?? order.createdAt}
                  now={now}
                />
              )}
            </Card>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  board: { flex: 1, backgroundColor: theme.colors.background },
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
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statusLabel: {
    color: theme.colors.mutedForeground,
    fontSize: 11,
    fontFamily: theme.typography.semibold,
    marginBottom: 5,
  },
  elapsedTime: {
    fontSize: 19,
    fontFamily: theme.typography.bold,
    color: theme.colors.foreground,
  },
  finishedTime: {
    textAlign: "center",
    fontSize: 12,
    color: "#15803d",
    paddingVertical: 8,
    fontFamily: theme.typography.semibold,
  },
  finishButton: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  finishIcon: { fontSize: 25, color: theme.colors.mutedForeground },
  filterText: { fontFamily: theme.typography.bold, fontSize: 12 },
  list: { padding: 8, paddingBottom: 20 },
  row: { justifyContent: "space-between", marginBottom: 8 },
  card: {
    padding: 7,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    backgroundColor: theme.colors.background,
  },
  summary: { alignItems: "center", paddingVertical: 6, minHeight: 64 },
  number: {
    paddingHorizontal: 24,
    fontFamily: theme.typography.bold,
    fontSize: 30,
    color: theme.colors.foreground,
  },
  time: { fontSize: 12, color: "#94a3b8", fontVariant: ["tabular-nums"] },
  timeAlert: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  timeAlertIcon: { fontSize: 18, fontWeight: "700", lineHeight: 22 },
  actions: {
    flexDirection: "row",
    gap: 6,
    borderTopWidth: 1,
    borderColor: theme.colors.border,
    paddingTop: 7,
    marginTop: 4,
  },
  action: {
    flex: 1,
    minHeight: 44,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    fontSize: 17,
    fontFamily: theme.typography.bold,
    color: theme.colors.foreground,
  },
  selectedText: { color: "#fff", fontFamily: theme.typography.bold },
  disabled: { opacity: 0.5 },
  empty: {
    textAlign: "center",
    padding: 24,
    color: theme.colors.mutedForeground,
  },
  requests: { gap: 8, marginBottom: 12 },
  requestTitle: { color: theme.colors.mutedForeground, fontSize: 12 },
  requestButtons: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  requestButton: {
    minWidth: 44,
    minHeight: 44,
    padding: 8,
    borderRadius: 22,
    backgroundColor: "#dc2626",
    alignItems: "center",
    justifyContent: "center",
  },
});
