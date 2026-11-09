import { Pressable, View } from "react-native";
import type { KdsOrder } from "./types";

export function OrderWhatsappButton({
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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        hasPhone
          ? `Contato: ${order.customerPhone}. Preparar mensagem de WhatsApp`
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
        minWidth: 44,
        justifyContent: "center",
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
    </Pressable>
  );
}
