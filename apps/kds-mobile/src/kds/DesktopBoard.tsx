import { desktop } from "../platform/desktop";
import { useDesktopWindow } from "../platform/useDesktopWindow";
import { subscribeStatusPreferences } from "../platform/statusPreferences";
import { IconButton } from "../ui/IconButton";
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
  const [closed, setClosed] = useState<KdsStatus[]>(
    KDS_STATUSES.map((status) => status.id)
  );
  const { widget } = useDesktopWindow();
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const read = () =>
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
        .catch(() => {});
    void read();
    const unsubscribe = subscribeStatusPreferences(() => {
      void read();
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  useEffect(
    () => () => {
      void desktop?.setWidget(false).catch(() => {});
    },
    []
  );
  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "flex-end",
          gap: 6,
          padding: 4,
          zIndex: 10,
        }}
      >
        <IconButton
          icon="widget"
          label={widget ? "Sair do modo widget" : "Modo widget"}
          active={widget}
          onPress={() => {
            void desktop
              ?.setWidget(!widget)
              .catch(() => setError("Não foi possível ajustar a janela."));
          }}
        />
        <IconButton
          icon="settings"
          label="Configurar status visíveis"
          onPress={() => {
            void desktop
              ?.openKdsSettings()
              .catch(() =>
                setError("Não foi possível abrir as configurações.")
              );
          }}
        />
      </View>
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
      <ScrollView
        contentContainerStyle={{
          padding: widget ? 4 : 12,
          gap: widget ? 4 : 12,
        }}
      >
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
                    padding: widget ? 8 : 14,
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
                          padding: widget ? 6 : 12,
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
                          <Text
                            style={{
                              fontSize: widget ? 18 : 22,
                              fontWeight: "700",
                            }}
                          >
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
    </View>
  );
}
