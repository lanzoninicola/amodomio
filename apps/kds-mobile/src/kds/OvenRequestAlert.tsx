import { useEffect, useRef, useState } from "react";
import { AppState, Modal, Text, View } from "react-native";
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
      transparent
      animationType="fade"
      supportedOrientations={["portrait", "landscape-left", "landscape-right"]}
      onRequestClose={dismiss}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.65)",
          padding: 24,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          accessibilityViewIsModal
          style={{
            width: "100%",
            maxWidth: 440,
            padding: 24,
            gap: 18,
            backgroundColor: "#fff",
            borderRadius: 16,
          }}
        >
          <Text
            accessibilityRole="alert"
            style={{
              fontSize: 24,
              fontWeight: "700",
              color: "#92400e",
              textAlign: "center",
            }}
          >
            Colocar no forno
          </Text>
          <Text
            style={{ fontSize: 38, fontWeight: "700", textAlign: "center" }}
          >
            Pedido #{current?.commandNumber ?? "VL"}
          </Text>
          {current?.customerName ? (
            <Text style={{ textAlign: "center" }}>{current.customerName}</Text>
          ) : null}
          {pending.length > 1 ? (
            <Text>Mais {pending.length - 1} pedido(s) aguardando aviso.</Text>
          ) : null}
          <Button onPress={dismiss}>Entendi</Button>
        </View>
      </View>
    </Modal>
  );
}
