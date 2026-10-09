import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../ui/theme";
import { Text } from "../ui/Text";
import { useEffect, useRef, useState } from "react";
import {
  AppState,
  Modal,
  ScrollView,
  View,
  useWindowDimensions,
} from "react-native";
import { listOrders } from "../api/client";
import { Button } from "../ui/Button";
import type { KdsOrder } from "./types";
import { pendingOvenAlerts } from "./oven-alerts";
export function OvenRequestAlert({
  token,
  apiUrl,
}: {
  token: string;
  apiUrl: string;
}) {
  const { width, height } = useWindowDimensions();
  const numberSize = Math.min(
    160,
    Math.max(80, Math.min(width, height) * 0.25)
  );
  const acknowledged = useRef(new Set<string>());
  const [pending, setPending] = useState<KdsOrder[]>([]);
  useEffect(() => {
    let alive = true;
    let loading = false;
    const load = async () => {
      if (loading || AppState.currentState !== "active") return;
      loading = true;
      try {
        const today = new Date();
        const date = `${today.getFullYear()}-${String(
          today.getMonth() + 1
        ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        const orders = await listOrders(apiUrl, token, date);
        if (alive) setPending(pendingOvenAlerts(orders, acknowledged.current));
      } catch {
        /* Only a successful server response can clear or rearm requests. */
      } finally {
        loading = false;
      }
    };
    void load();
    const timer = setInterval(load, 4000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void load();
    });
    return () => {
      alive = false;
      clearInterval(timer);
      subscription.remove();
    };
  }, [token, apiUrl]);
  const current = pending[0];
  const dismiss = () => {
    if (!current) return;
    acknowledged.current.add(current.id);
    setPending((values) => values.filter((order) => order.id !== current.id));
  };
  return (
    <Modal
      visible={Boolean(current)}
      presentationStyle="fullScreen"
      animationType="fade"
      supportedOrientations={["portrait", "landscape-left", "landscape-right"]}
      onRequestClose={dismiss}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.primary }}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            padding: 24,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            accessibilityViewIsModal
            style={{
              width: "100%",
              maxWidth: 900,
              alignItems: "center",
              gap: 16,
            }}
          >
            <View
              style={{
                backgroundColor: theme.colors.brandOrangeMuted,
                borderRadius: theme.radius.full,
                paddingHorizontal: 20,
                paddingVertical: 10,
              }}
            >
              <Text
                accessibilityRole="alert"
                style={{
                  fontSize: 30,
                  fontFamily: theme.typography.bold,
                  color: theme.colors.brandOrangeInk,
                  textAlign: "center",
                }}
              >
                Colocar no forno
              </Text>
            </View>
            <Text
              style={{
                fontSize: 18,
                fontFamily: theme.typography.semibold,
                color: theme.colors.primaryForeground,
              }}
            >
              PEDIDO
            </Text>
            <Text
              accessibilityLabel={`Pedido número ${
                current?.commandNumber ?? "VL"
              }`}
              style={{
                fontSize: numberSize,
                fontFamily: theme.typography.bold,
                color: theme.colors.primaryForeground,
                textAlign: "center",
                fontVariant: ["tabular-nums"],
                width: "100%",
              }}
            >
              #{current?.commandNumber ?? "VL"}
            </Text>
            {current?.customerName ? (
              <Text
                style={{
                  fontSize: 22,
                  color: theme.colors.primaryForeground,
                  textAlign: "center",
                }}
              >
                {current.customerName}
              </Text>
            ) : null}
            {pending.length > 1 ? (
              <Text
                style={{
                  fontSize: 16,
                  color: theme.colors.primaryForeground,
                  textAlign: "center",
                }}
              >
                Mais {pending.length - 1} pedido(s) aguardando aviso.
              </Text>
            ) : null}
            <Button
              variant="secondary"
              style={{
                minHeight: 60,
                width: "100%",
                maxWidth: 360,
                marginTop: 12,
              }}
              onPress={dismiss}
            >
              <Text
                style={{
                  fontSize: 20,
                  fontFamily: theme.typography.bold,
                  color: theme.colors.primary,
                }}
              >
                Entendi
              </Text>
            </Button>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
