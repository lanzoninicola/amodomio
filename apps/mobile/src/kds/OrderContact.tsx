import { OrderWhatsappButton } from "./OrderWhatsappButton";
import { OrderDeliveryIcon } from "./OrderDeliveryIcon";
import { View } from "react-native";
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
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
      }}
    >
      <OrderDeliveryIcon takeAway={order.takeAway} />
      <View
        accessible={false}
        pointerEvents="none"
        style={{
          width: 1,
          height: 26,
          backgroundColor: "rgba(255, 255, 255, 0.3)",
        }}
      />
      <OrderWhatsappButton order={order} onContact={onContact} busy={busy} />
    </View>
  );
}
