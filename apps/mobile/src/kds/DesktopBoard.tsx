import { OrderWhatsappButton } from "./OrderWhatsappButton";
import { OrderDeliveryIcon } from "./OrderDeliveryIcon";
import { Text } from "../ui/Text";
import { OvenRequestIndicator } from "./OvenRequestIndicator";
import { averageCompletionMinutes, elapsedSince } from "./order-time";
import { IconButton } from "../ui/IconButton";
import { useDesktopWindow } from "../platform/useDesktopWindow";
import { subscribeStatusPreferences } from "../platform/statusPreferences";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { theme } from "../ui/theme";
import { KDS_STATUSES, type KdsOrder, type KdsStatus } from "./types";
import AsyncStorage from "@react-native-async-storage/async-storage";
const KEY = "amodomio.desktop.kds.statuses";
const defaults: KdsStatus[] = ["aguardandoForno", "assando"];
export function DesktopBoard({
  orders,
  now,
  busy,
  loading = false,
  onToggleOven,
  onChooseStatus,
  onContact,
}: {
  orders: KdsOrder[];
  now: number;
  busy: boolean;
  loading?: boolean;
  onToggleOven: (order: KdsOrder) => void;
  onChooseStatus: (order: KdsOrder) => void;
  onContact: (order: KdsOrder) => void;
}) {
  const [visible, setVisible] = useState<KdsStatus[]>(defaults);
  const [closed, setClosed] = useState<KdsStatus[]>(
    KDS_STATUSES.map((status) => status.id)
  );
  const { widget } = useDesktopWindow();
  const [gridWidth, setGridWidth] = useState(0);
  const cardWidth = Math.max(0, Math.floor((gridWidth - 22) / 2));
  const completion = averageCompletionMinutes(orders);

  useEffect(() => {
    let active = true;
    const read = () =>
      AsyncStorage.getItem(KEY)
        .then((raw) => {
          if (!active || !raw) return;
          const saved = JSON.parse(raw);
          if (Array.isArray(saved)) {
            const valid = KDS_STATUSES.filter((status) =>
              saved.includes(status.id)
            ).map((status) => status.id);
            if (valid.length) setVisible(valid);
          }
        })
        .catch(() => {});
    void read();
    const unsubscribe = subscribeStatusPreferences(() => {
      void read();
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: "#000000" }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          gap: 6,
          padding: 8,
          zIndex: 10,
        }}
      >
        <View
          style={{ flex: 1, flexDirection: "row", flexWrap: "nowrap", gap: 16 }}
        >
          <View style={{ gap: 2, flex: 1, minWidth: 0 }}>
            <Text style={{ color: "#b3b3b3", fontSize: 11 }}>
              Total de pedidos
            </Text>
            <Text
              style={{
                color: "#ffffff",
                fontSize: 28,
                fontWeight: "700",
                fontVariant: ["tabular-nums"],
              }}
            >
              {orders.length}
            </Text>
          </View>
          <View
            style={{ gap: 2, flex: 1, minWidth: 0 }}
            accessibilityLabel={`Tempo médio de finalização: ${
              completion.minutes === null
                ? "sem dados"
                : `${Math.round(completion.minutes)} minutos`
            }. Baseado em ${
              completion.count
            } pedidos finalizados com tempo válido.`}
          >
            <Text style={{ color: "#b3b3b3", fontSize: 11 }}>
              {widget ? "Tempo médio" : "Tempo médio de finalização"}
            </Text>
            <Text
              style={{
                color: "#ffffff",
                fontSize: 28,
                fontWeight: "700",
                fontVariant: ["tabular-nums"],
              }}
            >
              {completion.minutes === null
                ? "—"
                : `${Math.round(completion.minutes)} min`}
            </Text>
          </View>
        </View>
      </View>
      {loading ? (
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: "#b3b3b3", paddingHorizontal: 8 }}
        >
          Carregando pedidos…
        </Text>
      ) : null}
      <ScrollView
        contentContainerStyle={{
          padding: widget ? 8 : 12,
          gap: widget ? 4 : 12,
        }}
      >
        {KDS_STATUSES.filter((status) => visible.includes(status.id)).map(
          (status) => {
            const items = orders.filter((order) => order.status === status.id);
            const expanded = !closed.includes(status.id);
            return (
              <View
                key={status.id}
                style={{
                  borderWidth: 1,
                  borderColor: "#444444",
                  borderRadius: theme.radius.lg,
                  overflow: "hidden",
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  onPress={() =>
                    setClosed((values) =>
                      expanded
                        ? [...values, status.id]
                        : values.filter((value) => value !== status.id)
                    )
                  }
                  style={{
                    padding: widget ? 10 : 12,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    backgroundColor: "#282828",
                  }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 8,
                      backgroundColor: status.color,
                    }}
                  />
                  <Text
                    style={{
                      flex: 1,
                      fontWeight: "700",
                      fontSize: 18,
                      color: "#ffffff",
                    }}
                  >
                    {status.label}
                  </Text>
                  <Text
                    style={{
                      backgroundColor: "#000000",
                      color: "#ffffff",
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      minWidth: 52,
                      textAlign: "center",
                      fontVariant: ["tabular-nums"],
                      borderRadius: 8,
                      fontWeight: "700",
                      fontSize: 32,
                      lineHeight: 40,
                    }}
                  >
                    {items.length}
                  </Text>
                  <Text>{expanded ? "⌃" : "⌄"}</Text>
                </Pressable>
                {expanded ? (
                  <View
                    onLayout={(event) =>
                      setGridWidth(event.nativeEvent.layout.width)
                    }
                    style={{
                      padding: 8,
                      gap: 6,
                      flexDirection: "row",
                      flexWrap: "wrap",
                      alignItems: "stretch",
                    }}
                  >
                    {!loading && !items.length ? (
                      <Text
                        style={{
                          padding: 10,
                          color: "#b3b3b3",
                        }}
                      >
                        Nenhum pedido
                      </Text>
                    ) : null}
                    {items.map((order) => (
                      <View
                        key={order.id}
                        style={{
                          width: cardWidth,
                          minWidth: 0,
                          padding: 6,
                          backgroundColor: "#282828",
                          gap: 8,
                          borderWidth: 1,
                          borderColor:
                            order.requestedForOven &&
                            status.id === "aguardandoForno"
                              ? status.color
                              : theme.colors.border,
                          borderRadius: theme.radius.md,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Alterar status do pedido #${
                              order.commandNumber ?? "VL"
                            }`}
                            accessibilityHint="Abre os detalhes e a escolha de status"
                            accessibilityState={{ disabled: busy }}
                            disabled={busy}
                            onPress={() => onChooseStatus(order)}
                            style={({ pressed }) => ({
                              minHeight: 44,
                              minWidth: 0,
                              maxWidth: "100%",
                              flexShrink: 1,
                              justifyContent: "center",
                              opacity: busy || pressed ? 0.65 : 1,
                            })}
                          >
                            <Text
                              numberOfLines={1}
                              adjustsFontSizeToFit
                              style={{
                                fontSize: 24,
                                color: "#ffffff",
                                fontWeight: "700",
                              }}
                            >
                              #{order.commandNumber ?? "VL"}
                            </Text>
                          </Pressable>
                          {order.requestedForOven ? (
                            <OvenRequestIndicator />
                          ) : null}
                          <View
                            style={{
                              gap: 2,
                              alignItems: "flex-end",
                              marginLeft: "auto",
                              flexShrink: 0,
                            }}
                          >
                            <Text style={{ fontSize: 10, color: "#b3b3b3" }}>
                              {order.status === "finalizado"
                                ? "Tempo total"
                                : "Tempo decorrido"}
                            </Text>
                            <Text
                              numberOfLines={1}
                              adjustsFontSizeToFit
                              style={{
                                fontSize: 16,
                                color: "#ffffff",
                                fontWeight: "600",
                                fontVariant: ["tabular-nums"],
                              }}
                            >
                              {elapsedSince(
                                order.novoPedidoAt ?? order.createdAt,
                                order.status === "finalizado"
                                  ? order.finalizadoAt
                                    ? new Date(order.finalizadoAt).getTime()
                                    : NaN
                                  : now
                              )}
                            </Text>
                          </View>
                        </View>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <OrderDeliveryIcon takeAway={order.takeAway} />
                          {order.customerName ? (
                            <Text
                              numberOfLines={1}
                              style={{
                                flex: 1,
                                fontSize: 12,
                                color: "#b3b3b3",
                              }}
                            >
                              {order.customerName}
                            </Text>
                          ) : null}
                        </View>

                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "flex-start",
                            flexWrap: "wrap",
                            gap: 6,
                            marginTop: "auto",
                            paddingTop: 4,
                          }}
                        >
                          {status.id === "aguardandoForno" ? (
                            <IconButton
                              appearance="card"
                              icon={order.requestedForOven ? "undo" : "flame"}
                              label={
                                order.requestedForOven
                                  ? `Cancelar aviso de forno do pedido #${
                                      order.commandNumber ?? "VL"
                                    }`
                                  : `Avisar para colocar o pedido #${
                                      order.commandNumber ?? "VL"
                                    } no forno`
                              }
                              active={Boolean(order.requestedForOven)}
                              disabled={busy}
                              onPress={() => onToggleOven(order)}
                            />
                          ) : null}
                          <View
                            style={{
                              marginLeft: "auto",
                              flex: 1,
                              minWidth: 0,
                              alignItems: "flex-end",
                              gap: 2,
                            }}
                          >
                            <OrderWhatsappButton
                              order={order}
                              onContact={onContact}
                              busy={busy}
                            />
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          }
        )}
      </ScrollView>
    </View>
  );
}
