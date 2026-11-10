import { Modal, Pressable, ScrollView, View } from "react-native";
import { Text } from "../ui/Text";
import type { KdsOrder } from "./types";

export function CutPizzaNotice({
  order,
  onDismiss,
}: {
  order: KdsOrder | null;
  onDismiss: () => void;
}) {
  return (
    <Modal
      visible={Boolean(order)}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      supportedOrientations={["portrait", "landscape-left", "landscape-right"]}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.88)",
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
        }}
      >
        <ScrollView
          accessibilityViewIsModal
          style={{
            width: "100%",
            maxWidth: 560,
            maxHeight: "100%",
            backgroundColor: "#fbbf24",
            borderRadius: 24,
          }}
          contentContainerStyle={{
            padding: 28,
            alignItems: "center",
            gap: 16,
          }}
        >
          <Text style={{ fontSize: 56, color: "#171717" }}>✂</Text>
          <Text
            accessibilityRole="header"
            style={{
              color: "#171717",
              fontSize: 32,
              fontWeight: "700",
              textAlign: "center",
            }}
          >
            CORTAR PIZZA
          </Text>
          <Text style={{ color: "#171717", fontSize: 28, fontWeight: "700" }}>
            Pedido #{order?.commandNumber ?? "VL"}
          </Text>
          <Text
            style={{
              color: "#171717",
              fontSize: 18,
              textAlign: "center",
              lineHeight: 26,
            }}
          >
            Este pedido deve ser cortado antes de entregar ao cliente.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={onDismiss}
            style={{
              minHeight: 56,
              backgroundColor: "#171717",
              borderRadius: 12,
              paddingVertical: 14,
              paddingHorizontal: 28,
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>
              Entendi
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}
