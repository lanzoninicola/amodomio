import { Pressable, ScrollView, View } from "react-native";
import { Text } from "../ui/Text";
import { theme } from "../ui/theme";
import type { KdsOrder } from "./types";

export function OvenRequestsBar({
  orders,
  busy,
  onBake,
  onFinish,
}: {
  orders: KdsOrder[];
  busy: boolean;
  onBake: (order: KdsOrder) => void;
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
}: {
  title: string;
  backgroundColor: string;
  orders: KdsOrder[];
  busy?: boolean;
  onPressOrder: (order: KdsOrder) => void;
  actionLabel: string;
  actionStatus: string;
}) {
  return (
    <View
      style={{ flex: 1, minWidth: 0, backgroundColor, padding: 12, gap: 10 }}
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
            color: "#080808",
            fontSize: 18,
            fontFamily: "IBMPlexMono_Bold",
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            color: theme.colors.foreground,
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
                color: "#fff",
                fontSize: 26,
                fontFamily: "IBMPlexMono_Bold",
              }}
            >
              #{order.commandNumber ?? "VL"}
            </Text>
          );
          const cardStyle = {
            backgroundColor: "#282828",
            borderRadius: theme.radius.md,
            minHeight: 58,
            minWidth: 92,
            paddingHorizontal: 16,
            paddingVertical: 8,
            alignItems: "center" as const,
            justifyContent: "center" as const,
          };

          return (
            <Pressable
              key={order.id}
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
          );
        })}
      </ScrollView>
    </View>
  );
}
