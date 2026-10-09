import { Text } from "../ui/Text";
import { desktop } from "../platform/desktop";
import { useDesktopWindow } from "../platform/useDesktopWindow";
import { subscribeStatusPreferences } from "../platform/statusPreferences";
import { IconButton } from "../ui/IconButton";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
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
  const [boardWidth, setBoardWidth] = useState(0);
  const twoColumns = boardWidth >= 320;
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
    <View
      onLayout={(event) => setBoardWidth(event.nativeEvent.layout.width)}
      style={{ flex: 1, backgroundColor: "#000000" }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          gap: 6,
          padding: 8,
          zIndex: 10,
        }}
      >
        <Text
          style={{
            color: "#b3b3b3",
            fontSize: 12,
            alignSelf: "center",
            fontWeight: "600",
          }}
        >
          Pedidos ·{" "}
          {orders.filter((order) => visible.includes(order.status)).length}
        </Text>
        <View style={{ flexDirection: "row", gap: 6 }}>
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
      </View>
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
      <ScrollView
        contentContainerStyle={{
          padding: widget ? 8 : 12,
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
                  borderColor: "#444444",
                  borderRadius: theme.radius.lg,
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
                    padding: widget ? 10 : 12,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    backgroundColor: "#282828",
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
                  <Text
                    style={{
                      flex: 1,
                      fontWeight: "700",
                      fontSize: 18,
                      color: "#ffffff",
                    }}
                  >
                    {status.label}
                  </Text>
                  <Text
                    style={{
                      backgroundColor: status.tint,
                      color: status.color,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      minWidth: 34,
                      textAlign: "center",
                      fontVariant: ["tabular-nums"],
                      borderRadius: theme.radius.full,
                      fontWeight: "700",
                      fontSize: 18,
                      lineHeight: 24,
                    }}
                  >
                    {items.length}
                  </Text>
                  <Text>{expanded ? "⌃" : "⌄"}</Text>
                </Pressable>
                {expanded ? (
                  <View
                    style={{
                      padding: 8,
                      gap: 8,
                      flexDirection: "row",
                      flexWrap: "wrap",
                      alignItems: "stretch",
                    }}
                  >
                    {!items.length ? (
                      <Text
                        style={{
                          padding: 10,
                          color: "#b3b3b3",
                        }}
                      >
                        Nenhum pedido
                      </Text>
                    ) : null}
                    {items.map((order) => (
                      <View
                        key={order.id}
                        style={{
                          width: twoColumns ? "48.5%" : "100%",
                          minHeight: 156,
                          padding: 10,
                          backgroundColor: "#282828",
                          gap: 8,
                          borderWidth: 1,
                          borderColor:
                            order.requestedForOven &&
                            status.id === "aguardandoForno"
                              ? status.color
                              : theme.colors.border,
                          borderRadius: theme.radius.md,
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
                              fontSize: 22,
                              color: "#ffffff",
                              fontWeight: "700",
                            }}
                          >
                            #{order.commandNumber ?? "VL"}
                          </Text>
                          <Text
                            style={{
                              fontSize: 11,
                              color: "#b3b3b3",
                              backgroundColor: "#333333",
                              padding: 4,
                              borderRadius: 4,
                              alignSelf: "center",
                            }}
                          >
                            {order.takeAway ? "Retirada" : "Entrega"}
                          </Text>
                        </View>
                        {order.customerName ? (
                          <Text
                            numberOfLines={1}
                            style={{
                              fontSize: 12,
                              color: "#b3b3b3",
                            }}
                          >
                            {order.customerName}
                          </Text>
                        ) : null}
                        {order.sizes ? (
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: "600",
                              color: "#ffffff",
                            }}
                          >
                            {Object.entries(order.sizes)
                              .filter(([, count]) => count > 0)
                              .map(([size, count]) => `${count}${size}`)
                              .join(" · ")}
                          </Text>
                        ) : null}
                        {order.requestedForOven &&
                        status.id === "aguardandoForno" ? (
                          <Text
                            style={{
                              color: status.color,
                              fontSize: 11,
                              fontWeight: "600",
                            }}
                          >
                            Forno solicitado
                          </Text>
                        ) : null}
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "flex-end",
                            flexWrap: "wrap",
                            gap: 6,
                            marginTop: "auto",
                            paddingTop: 4,
                          }}
                        >
                          {status.id === "aguardandoForno" ? (
                            <IconButton
                              icon={order.requestedForOven ? "cancel" : "oven"}
                              label={
                                order.requestedForOven
                                  ? `Cancelar solicitação do pedido #${
                                      order.commandNumber ?? "VL"
                                    }`
                                  : `Avisar para colocar o pedido #${
                                      order.commandNumber ?? "VL"
                                    } no forno`
                              }
                              caption={
                                boardWidth < 440
                                  ? undefined
                                  : order.requestedForOven
                                  ? "Cancelar"
                                  : "Avisar forno"
                              }
                              active={Boolean(order.requestedForOven)}
                              disabled={busy}
                              onPress={() => onToggleOven(order)}
                            />
                          ) : null}
                          <IconButton
                            icon="status"
                            label={`Alterar status do pedido #${
                              order.commandNumber ?? "VL"
                            }`}
                            disabled={busy}
                            onPress={() => onChooseStatus(order)}
                          />
                        </View>
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
