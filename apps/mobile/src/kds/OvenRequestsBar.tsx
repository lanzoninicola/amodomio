import { Pressable, ScrollView, View } from "react-native";
import { Text } from "../ui/Text";
import { theme } from "../ui/theme";
import type { KdsOrder } from "./types";

export function OvenRequestsBar({
  orders,
  busy,
  onBake,
}: {
  orders: KdsOrder[];
  busy: boolean;
  onBake: (order: KdsOrder) => void;
}) {
  const requested = orders.filter(
    (order) => order.status === "aguardandoForno" && order.requestedForOven
  );
  if (!requested.length) return null;
  return (
    <View
      style={{
        backgroundColor: theme.colors.brandOrange,
        borderLeftWidth: 5,
        borderLeftColor: theme.colors.brandOrange,
        padding: 12,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text
          style={{
            color: "#080808",
            fontSize: 18,
            fontFamily: "IBMPlexMono_Bold",
          }}
        >
          Forno solicitado
        </Text>
        <Text
          style={{
            backgroundColor: theme.colors.brandOrange,
            color: theme.colors.foreground,
            paddingHorizontal: 9,
            paddingVertical: 3,
            borderRadius: theme.radius.full,
            fontSize: 16,
            fontFamily: "IBMPlexMono_Bold",
          }}
        >
          {requested.length}
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10 }}
      >
        {requested.map((order) => (
          <Pressable
            key={order.id}
            accessibilityRole="button"
            accessibilityLabel={`Colocar pedido ${
              order.commandNumber ?? "VL"
            } em Assando`}
            disabled={busy}
            onPress={() => onBake(order)}
            style={({ pressed }) => ({
              backgroundColor: "#282828",
              borderRadius: theme.radius.md,
              minHeight: 58,
              minWidth: 92,
              paddingHorizontal: 16,
              paddingVertical: 8,
              alignItems: "center",
              justifyContent: "center",
              opacity: busy || pressed ? 0.5 : 1,
            })}
          >
            <Text
              style={{
                color: "#fff",
                fontSize: 26,
                fontFamily: "IBMPlexMono_Bold",
              }}
            >
              #{order.commandNumber ?? "VL"}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
