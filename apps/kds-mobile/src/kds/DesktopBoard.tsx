import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Button } from "../ui/Button";
import { theme } from "../ui/theme";
import { KDS_STATUSES, type KdsOrder, type KdsStatus } from "./types";
import AsyncStorage from "@react-native-async-storage/async-storage";
const KEY = "amodomio.desktop.kds.statuses";
const defaults: KdsStatus[] = ["aguardandoForno", "assando"];
export function DesktopBoard({
  orders,
  busy,
  onToggleOven,
  onChooseStatus,
}: {
  orders: KdsOrder[];
  busy: boolean;
  onToggleOven: (order: KdsOrder) => void;
  onChooseStatus: (order: KdsOrder) => void;
}) {
  const [visible, setVisible] = useState<KdsStatus[]>(defaults);
  const [closed, setClosed] = useState<KdsStatus[]>([]);
  const [settings, setSettings] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!active || !raw) return;
        const saved = JSON.parse(raw);
        if (Array.isArray(saved)) {
          const valid = KDS_STATUSES.filter((status) =>
            saved.includes(status.id)
          ).map((status) => status.id);
          if (valid.length) setVisible(valid);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  function toggle(status: KdsStatus) {
    const next = visible.includes(status)
      ? visible.filter((value) => value !== status)
      : [...visible, status];
    if (!next.length) return;
    setVisible(next);
    void AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  }
  return (
    <ScrollView contentContainerStyle={{ padding: 12, gap: 12 }}>
      <Button variant="outline" onPress={() => setSettings((value) => !value)}>
        Status visíveis
      </Button>
      {settings ? (
        <View style={{ gap: 8 }}>
          <Text>Escolha pelo menos um status:</Text>
          {KDS_STATUSES.map((status) => (
            <Pressable
              key={status.id}
              accessibilityRole="checkbox"
              accessibilityState={{
                checked: visible.includes(status.id),
                disabled: !ready,
              }}
              disabled={!ready}
              onPress={() => toggle(status.id)}
              style={{
                padding: 10,
                borderWidth: 1,
                borderColor: theme.colors.border,
                borderRadius: 8,
              }}
            >
              <Text>
                {visible.includes(status.id) ? "☑" : "☐"} {status.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {KDS_STATUSES.filter((status) => visible.includes(status.id)).map(
        (status) => {
          const items = orders.filter((order) => order.status === status.id);
          const expanded = !closed.includes(status.id);
          return (
            <View
              key={status.id}
              style={{
                borderWidth: 1,
                borderColor: theme.colors.border,
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                onPress={() =>
                  setClosed((values) =>
                    expanded
                      ? [...values, status.id]
                      : values.filter((value) => value !== status.id)
                  )
                }
                style={{
                  padding: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  backgroundColor: theme.colors.muted,
                }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: status.color,
                  }}
                />
                <Text style={{ flex: 1, fontWeight: "700" }}>
                  {status.label} ({items.length})
                </Text>
                <Text>{expanded ? "⌃" : "⌄"}</Text>
              </Pressable>
              {expanded ? (
                <View style={{ padding: 10, gap: 10 }}>
                  {!items.length ? (
                    <Text
                      style={{
                        padding: 10,
                        color: theme.colors.mutedForeground,
                      }}
                    >
                      Nenhum pedido
                    </Text>
                  ) : null}
                  {items.map((order) => (
                    <View
                      key={order.id}
                      style={{
                        padding: 12,
                        gap: 8,
                        borderWidth: 1,
                        borderColor:
                          order.requestedForOven &&
                          status.id === "aguardandoForno"
                            ? status.color
                            : theme.colors.border,
                        borderRadius: 8,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                      >
                        <Text style={{ fontSize: 22, fontWeight: "700" }}>
                          #{order.commandNumber ?? "VL"}
                        </Text>
                        <Text>{order.takeAway ? "Retirada" : "Entrega"}</Text>
                      </View>
                      {order.customerName ? (
                        <Text>{order.customerName}</Text>
                      ) : null}
                      {order.sizes ? (
                        <Text>
                          {Object.entries(order.sizes)
                            .filter(([, count]) => count > 0)
                            .map(([size, count]) => `${count}${size}`)
                            .join(" · ")}
                        </Text>
                      ) : null}
                      {status.id === "aguardandoForno" ? (
                        <>
                          {order.requestedForOven ? (
                            <Text style={{ color: status.color }}>
                              Solicitado: colocar no forno
                            </Text>
                          ) : null}
                          <Button
                            disabled={busy}
                            variant={
                              order.requestedForOven ? "outline" : "primary"
                            }
                            onPress={() => onToggleOven(order)}
                          >
                            {order.requestedForOven
                              ? "Cancelar solicitação"
                              : "Avisar para colocar no forno"}
                          </Button>
                        </>
                      ) : null}
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onPress={() => onChooseStatus(order)}
                      >
                        Alterar status
                      </Button>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        }
      )}
    </ScrollView>
  );
}
