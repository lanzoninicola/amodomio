import { Pressable, View } from "react-native";
import { Text } from "../ui/Text";
import type { KdsOrder } from "./types";

export function OrderContact({
  order,
  onContact,
  busy = false,
}: {
  order: KdsOrder;
  onContact: (order: KdsOrder) => void;
  busy?: boolean;
}) {
  const hasPhone = Boolean(order.customerPhone?.trim());
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
      }}
    >
      <View
        accessibilityLabel={order.takeAway ? "Balcão / retirada" : "Entrega"}
        style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
      >
        <Text style={{ fontSize: 20 }}>{order.takeAway ? "🛍" : "🛵"}</Text>
        <Text style={{ color: "#fff", fontSize: 11 }}>
          {order.takeAway ? "Balcão" : "Entrega"}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          hasPhone
            ? `Contato: ${order.customerPhone}. Abrir WhatsApp`
            : "Telefone não informado"
        }
        accessibilityState={{ disabled: busy || !hasPhone }}
        disabled={busy || !hasPhone}
        onPress={(event) => {
          event.stopPropagation();
          onContact(order);
        }}
        style={{
          minHeight: 44,
          flexShrink: 1,
          flexDirection: "row",
          alignItems: "center",
          gap: 5,
          opacity: hasPhone ? 1 : 0.3,
        }}
      >
        <View
          style={{
            width: 16,
            height: 25,
            borderWidth: 2,
            borderColor: "#25d366",
            borderRadius: 3,
            alignItems: "center",
            justifyContent: "flex-end",
            paddingBottom: 2,
          }}
        >
          <View style={{ width: 4, height: 2, backgroundColor: "#25d366" }} />
        </View>
        <Text
          numberOfLines={1}
          style={{ color: "#25d366", fontSize: 10, flexShrink: 1 }}
        >
          {order.customerPhone || "Sem telefone"}
        </Text>
      </Pressable>
    </View>
  );
}
