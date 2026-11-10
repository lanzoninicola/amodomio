import { KdsScrollbarStyles } from "./KdsScrollbarStyles";
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { Text } from "../ui/Text";
import { IconButton } from "../ui/IconButton";
import { OrderAlertBackground } from "./OrderAlertBackground";
import { Tooltip } from "../ui/Tooltip";
import { OrderWhatsappButton } from "./OrderWhatsappButton";
import { OvenRequestIndicator } from "./OvenRequestIndicator";
import { averageCompletionMinutes, isOrderOverOneHour } from "./order-time";
import { KDS_STATUSES, type KdsOrder } from "./types";

function StopwatchIcon({ color }: { color: string }) {
  return (
    <View
      accessible={false}
      style={{
        width: 14,
        height: 16,
        alignItems: "center",
        justifyContent: "flex-end",
      }}
    >
      <View
        style={{
          position: "absolute",
          top: 0,
          width: 6,
          height: 2,
          backgroundColor: color,
          borderRadius: 1,
        }}
      />
      <View
        style={{
          position: "absolute",
          top: 2,
          width: 2,
          height: 2,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          width: 12,
          height: 12,
          borderWidth: 1.5,
          borderColor: color,
          borderRadius: 6,
          alignItems: "center",
        }}
      >
        <View
          style={{
            position: "absolute",
            top: 2,
            width: 1.5,
            height: 4,
            backgroundColor: color,
            transform: [{ rotate: "25deg" }],
          }}
        />
      </View>
    </View>
  );
}

function CompletionClock({
  minutes,
  count,
}: {
  minutes: number | null;
  count: number;
}) {
  const rotation = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let active = true;
    const listener = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion
    );
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active) setReduceMotion(value);
      })
      .catch(() => {});
    return () => {
      active = false;
      listener.remove();
    };
  }, []);
  useEffect(() => {
    if (reduceMotion || minutes === null) return;
    const animation = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 60000,
        easing: Easing.linear,
        useNativeDriver: true,
        isInteraction: false,
      })
    );
    animation.start();
    return () => {
      animation.stop();
      rotation.setValue(0);
    };
  }, [rotation, reduceMotion, minutes]);
  const size = 132;
  const displayedMinutes = minutes === null ? null : Math.round(minutes);
  const accent =
    displayedMinutes === null
      ? "#737373"
      : displayedMinutes > 75
      ? "#f87171"
      : displayedMinutes > 60
      ? "#fb923c"
      : "#fbbf24";
  return (
    <View style={{ width: size, alignItems: "center", gap: 10 }}>
      <Text
        style={{
          color: "#d4d4d4",
          fontSize: 12,
          textAlign: "center",
          lineHeight: 16,
        }}
      >
        Média de preparo
      </Text>
      <View
        accessible
        accessibilityLabel={`Média de preparo: ${
          minutes === null ? "sem dados" : `${Math.round(minutes)} minutos`
        }. ${count} pedidos finalizados. Não inclui entrega.`}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: "#171717",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
          padding: 20,
          borderWidth: 1,
          borderColor: "#737373",
        }}
      >
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            inset: 4,
            borderRadius: size / 2,
            borderWidth: 3,
            borderColor: "#404040",
            borderTopColor: accent,
            transform: [
              {
                rotate: rotation.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0deg", "360deg"],
                }),
              },
            ],
          }}
        />
        <Text
          style={{
            color:
              displayedMinutes !== null && displayedMinutes > 60
                ? accent
                : "#fff",
            fontWeight: "700",
            fontSize: 54,
            lineHeight: 60,
            fontVariant: ["tabular-nums"],
          }}
        >
          {displayedMinutes === null ? "—" : displayedMinutes}
        </Text>
        <Text style={{ color: "#b3b3b3", fontSize: 9, textAlign: "center" }}>
          {minutes === null ? "Sem finalizados" : "minutos"}
        </Text>
      </View>
    </View>
  );
}

export function DesktopKanban({
  orders,
  now,
  busy,
  loading,
  onToggleOven,
  onToggleCut,
  onChooseStatus,
  onContact,
}: {
  orders: KdsOrder[];
  now: number;
  busy: boolean;
  loading: boolean;
  onToggleOven: (order: KdsOrder) => void;
  onToggleCut: (order: KdsOrder) => void;
  onChooseStatus: (order: KdsOrder) => void;
  onContact: (order: KdsOrder) => void;
}) {
  const [width, setWidth] = useState(0);
  const compact = width < 760;
  const completion = averageCompletionMinutes(orders);
  const columns = KDS_STATUSES.filter(
    (status) => status.id === "aguardandoForno" || status.id === "assando"
  );
  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{
        flex: 1,
        minHeight: 0,
        backgroundColor: "#000",
        padding: 10,
        gap: 8,
      }}
    >
      <KdsScrollbarStyles />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <Text style={{ color: "#b3b3b3", fontSize: 12 }}>
          {orders.length} pedidos no dia
        </Text>
        <Text style={{ color: "#b3b3b3", fontSize: 11 }}>
          {completion.count} finalizados na média
        </Text>
      </View>
      {loading && (
        <Text accessibilityLiveRegion="polite" style={{ color: "#b3b3b3" }}>
          Carregando pedidos…
        </Text>
      )}
      {compact && (
        <View style={{ alignItems: "center", paddingBottom: 4 }}>
          <CompletionClock {...completion} />
        </View>
      )}
      <View
        style={{
          flex: 1,
          minHeight: 0,
          flexDirection: "row",
          gap: compact ? 10 : 168,
        }}
      >
        {columns.map((status) => {
          const items = orders
            .filter((order) => order.status === status.id)
            .sort(
              (a, b) =>
                new Date(a.novoPedidoAt ?? a.createdAt).getTime() -
                new Date(b.novoPedidoAt ?? b.createdAt).getTime()
            );
          return (
            <View
              key={status.id}
              style={{
                flex: 1,
                minWidth: 0,
                borderWidth: 1,
                borderColor: "#525252",
                borderRadius: 22,
                backgroundColor: "#161616",
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  gap: 8,
                  alignItems: "center",
                  backgroundColor: "#242424",
                }}
              >
                <Text
                  accessibilityRole="header"
                  style={{
                    color: "#fff",
                    fontSize: compact ? 14 : 17,
                    fontWeight: "700",
                    textAlign: "center",
                  }}
                >
                  {status.label}
                </Text>
                <Text
                  style={{ color: "#fff", fontSize: 24, fontWeight: "700" }}
                >
                  {items.length}
                </Text>
              </View>
              <ScrollView
                nativeID={`kds-kanban-scroll-${status.id}`}
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 8, gap: 8 }}
              >
                {!loading && items.length === 0 && (
                  <Text
                    style={{
                      color: "#a3a3a3",
                      textAlign: "center",
                      paddingVertical: 24,
                    }}
                  >
                    Nenhum pedido
                  </Text>
                )}
                {items.map((order) => {
                  const overdue = isOrderOverOneHour(order, now);
                  const elapsedMinutes = Math.max(
                    0,
                    Math.floor(
                      (now -
                        new Date(
                          order.novoPedidoAt ?? order.createdAt
                        ).getTime()) /
                        60000
                    )
                  );
                  return (
                    <View
                      key={order.id}
                      style={{
                        backgroundColor: overdue
                          ? "#351f23"
                          : status.id === "aguardandoForno"
                          ? "#422c1d"
                          : "#282828",
                        borderRadius: 14,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        gap: 2,
                        overflow: "hidden",
                        borderWidth: order.requestedForOven ? 1 : 0,
                        borderColor: "#737373",
                      }}
                    >
                      {overdue && status.id !== "aguardandoForno" && (
                        <OrderAlertBackground overdue />
                      )}
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                          flexWrap: "wrap",
                        }}
                      >
                        <Tooltip
                          label={`Detalhes e status do pedido #${
                            order.commandNumber ?? "VL"
                          }`}
                          grow
                        >
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Detalhes e status do pedido #${
                              order.commandNumber ?? "VL"
                            }`}
                            disabled={busy}
                            onPress={() => onChooseStatus(order)}
                            style={{
                              minHeight: 44,
                              alignItems: "center",
                              flexDirection: "row",
                              gap: 8,
                              flex: 1,
                            }}
                          >
                            <Text
                              style={{
                                color: "#fff",
                                fontWeight: "700",
                                fontSize: 24,
                              }}
                            >
                              #{order.commandNumber ?? "VL"}
                            </Text>
                            <Text
                              style={{
                                color: "#f0f0f0",
                                fontSize: 12,
                                fontWeight: "700",
                              }}
                            >
                              {order.takeAway ? "RETIRADA" : "ENTREGA"}
                            </Text>
                          </Pressable>
                        </Tooltip>
                        <Tooltip label="Tempo corrido desde a entrada do pedido">
                          <View
                            accessible
                            accessibilityLabel={`Tempo corrido: ${
                              Number.isFinite(elapsedMinutes)
                                ? `${elapsedMinutes} minutos`
                                : "indisponível"
                            }`}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <StopwatchIcon
                              color={overdue ? "#f87171" : "#d4d4d4"}
                            />
                            <Text
                              style={{
                                color: overdue ? "#f87171" : "#fff",
                                fontSize: 24,
                                fontWeight: "700",
                                fontVariant: ["tabular-nums"],
                              }}
                            >
                              {Number.isFinite(elapsedMinutes)
                                ? `${elapsedMinutes}m`
                                : "—"}
                            </Text>
                          </View>
                        </Tooltip>
                      </View>
                      {order.customerName && (
                        <Text
                          numberOfLines={1}
                          style={{ color: "#ddd", fontSize: 12 }}
                        >
                          {order.customerName}
                        </Text>
                      )}
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                          paddingTop: 4,
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <Tooltip
                            label={
                              order.customerPhone
                                ? "Preparar mensagem no WhatsApp"
                                : "WhatsApp: telefone não informado"
                            }
                          >
                            <OrderWhatsappButton
                              compact
                              order={order}
                              onContact={onContact}
                              busy={busy}
                            />
                          </Tooltip>
                          <IconButton
                            compact
                            appearance="card"
                            icon="scissors"
                            label={
                              order.requiresCut
                                ? "Cortar pizza ativado. Remover aviso"
                                : "Marcar para cortar pizza"
                            }
                            active={Boolean(order.requiresCut)}
                            disabled={busy}
                            onPress={() => onToggleCut(order)}
                          />
                        </View>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          {order.requestedForOven && <OvenRequestIndicator />}
                          {status.id === "aguardandoForno" && (
                            <IconButton
                              compact
                              appearance={
                                order.requestedForOven ? "toolbar" : "card"
                              }
                              icon={order.requestedForOven ? "undo" : "flame"}
                              label={
                                order.requestedForOven
                                  ? "Cancelar aviso de forno"
                                  : "Avisar para colocar no forno"
                              }
                              active={order.requestedForOven}
                              disabled={busy}
                              onPress={() => onToggleOven(order)}
                            />
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          );
        })}
        {!compact && (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 12,
              left: "50%",
              marginLeft: -66,
            }}
          >
            <CompletionClock {...completion} />
          </View>
        )}
      </View>
    </View>
  );
}
