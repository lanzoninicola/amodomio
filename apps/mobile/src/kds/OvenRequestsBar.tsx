import { Pressable, ScrollView, View } from "react-native";
import { Text } from "../ui/Text";
import { theme } from "../ui/theme";
import type { KdsOrder } from "./types";

export function OvenRequestsBar({
  orders,
  busy,
  onBake,
  onCancelRequest,
  onFinish,
}: {
  orders: KdsOrder[];
  busy: boolean;
  onBake: (order: KdsOrder) => void;
  onCancelRequest: (order: KdsOrder) => void;
  onFinish: (order: KdsOrder) => void;
}) {
  const requested = orders.filter(
    (order) => order.status === "aguardandoForno" && order.requestedForOven
  );
  const baking = orders.filter((order) => order.status === "assando");

  return (
    <View style={{ flexDirection: "row", gap: 12 }}>
      <OvenColumn
        title="Forno solicitado"
        backgroundColor={theme.colors.brandOrange}
        orders={requested}
        busy={busy}
        onPressOrder={onBake}
        actionLabel="Colocar pedido"
        actionStatus="em Assando"
        onSecondaryPress={onCancelRequest}
        secondaryActionLabel="Desfazer solicitação de forno"
      />
      <OvenColumn
        title="Assando"
        backgroundColor={theme.colors.brandYellow}
        orders={baking}
        busy={busy}
        onPressOrder={onFinish}
        actionLabel="Finalizar pedido"
        actionStatus=""
      />
    </View>
  );
}

function OvenColumn({
  title,
  backgroundColor,
  orders,
  busy = false,
  onPressOrder,
  actionLabel,
  actionStatus,
  onSecondaryPress,
  secondaryActionLabel,
}: {
  title: string;
  backgroundColor: string;
  orders: KdsOrder[];
  busy?: boolean;
  onPressOrder: (order: KdsOrder) => void;
  actionLabel: string;
  actionStatus: string;
  onSecondaryPress?: (order: KdsOrder) => void;
  secondaryActionLabel?: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        backgroundColor: "#141414",
        padding: 12,
        gap: 10,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <Text
          style={{
            color: "#ffffff",
            fontSize: 18,
            fontFamily: "IBMPlexMono_Bold",
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            color: "#ffffff",
            paddingHorizontal: 9,
            paddingVertical: 3,
            fontSize: 16,
            fontFamily: "IBMPlexMono_Bold",
          }}
        >
          {orders.length}
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ minHeight: 58 }}
        contentContainerStyle={{ gap: 10 }}
      >
        {orders.map((order) => {
          const number = (
            <Text
              style={{
                color: "#080808",
                fontSize: 26,
                fontFamily: "IBMPlexMono_Bold",
              }}
            >
              #{order.commandNumber ?? "VL"}
            </Text>
          );
          const cardStyle = {
            backgroundColor,
            borderRadius: theme.radius.md,
            minHeight: 58,
            minWidth: 92,
            paddingHorizontal: 16,
            paddingVertical: 8,
            alignItems: "center" as const,
            justifyContent: "center" as const,
          };

          return (
            <View key={order.id} style={{ flexDirection: "row", gap: 6 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${actionLabel} ${
                  order.commandNumber ?? "VL"
                } ${actionStatus}`.trim()}
                disabled={busy}
                onPress={() => onPressOrder(order)}
                style={({ pressed }) => ({
                  ...cardStyle,
                  opacity: busy || pressed ? 0.5 : 1,
                })}
              >
                {number}
              </Pressable>
              {onSecondaryPress && secondaryActionLabel ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${secondaryActionLabel} do pedido ${
                    order.commandNumber ?? "VL"
                  }`}
                  disabled={busy}
                  onPress={() => onSecondaryPress(order)}
                  style={({ pressed }) => ({
                    minWidth: 52,
                    minHeight: 58,
                    paddingHorizontal: 10,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: theme.radius.md,
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.45)",
                    opacity: busy || pressed ? 0.5 : 1,
                  })}
                >
                  <Text
                    style={{
                      color: "#ffffff",
                      fontSize: 14,
                      fontFamily: "IBMPlexMono_Bold",
                    }}
                  >
                    Desfazer
                  </Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
