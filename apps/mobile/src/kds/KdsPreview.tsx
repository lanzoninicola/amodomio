import { CutPizzaNotice } from "./CutPizzaNotice";
import { needsCutNotice } from "./cut-notice";
import { useEffect, useState } from "react";
import { useFonts } from "expo-font";
import { Pressable, View } from "react-native";
import { Text, KdsTypographyContext } from "../ui/Text";
import { BrandLogo } from "../ui/BrandLogo";
import { DesktopKanban } from "./DesktopKanban";
import type { KdsOrder } from "./types";

function mockOrders(now: number): KdsOrder[] {
  const ago = (minutes: number) =>
    new Date(now - minutes * 60000).toISOString();
  return [
    [101, "aguardandoForno", "Mariana · retirada", 54],
    [102, "aguardandoForno", "Lucas", 32],
    [103, "aguardandoForno", "Camila", 18],
    [104, "aguardandoForno", "Pedro", 7],
    [98, "assando", "Ana", 72],
    [99, "assando", "Bruno · retirada", 48],
    [100, "assando", "Julia", 36],
    [95, "finalizado", "Finalizado A", 110],
    [96, "finalizado", "Finalizado B", 100],
    [97, "finalizado", "Finalizado C", 90],
  ].map(([number, status, name, minutes], index) => ({
    id: `preview-${number}`,
    commandNumber: Number(number),
    status: String(status),
    customerName: String(name),
    createdAt: ago(Number(minutes)),
    novoPedidoAt: ago(Number(minutes)),
    finalizadoAt:
      status === "finalizado"
        ? ago(Number(minutes) - [42, 47, 52][index - 7])
        : null,
    updatedAt: ago(0),
    dateInt: 20261109,
    channel: "mock",
    takeAway: index % 3 === 0,
    requestedForOven: index === 1,
    requiresCut: index === 1,
    customerPhone: null,
    sizes: { F: 1, M: 0, P: 0, I: 0, FT: 0 },
  }));
}

/** Isolated visual preview: no authentication, API calls or persisted orders. */
export function KdsPreview() {
  const [cutNotice, setCutNotice] = useState<KdsOrder | null>(null);
  const [now, setNow] = useState(Date.now);
  const [orders, setOrders] = useState(() => mockOrders(Date.now()));
  const [fontsLoaded] = useFonts({
    IBMPlexMono_Regular: require("../../assets/fonts/IBMPlexMono-Regular.ttf"),
    IBMPlexMono_SemiBold: require("../../assets/fonts/IBMPlexMono-SemiBold.ttf"),
    IBMPlexMono_Bold: require("../../assets/fonts/IBMPlexMono-Bold.ttf"),
  });
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (!fontsLoaded) return null;
  return (
    <KdsTypographyContext.Provider value>
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <View
          style={{
            padding: 16,
            borderBottomWidth: 1,
            borderColor: "#333",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <BrandLogo light width={180} />
          <Text style={{ color: "#fbbf24", fontSize: 12 }}>
            PRÉVIA · PEDIDOS FICTÍCIOS
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setOrders(mockOrders(Date.now()))}
            style={{
              padding: 12,
              borderWidth: 1,
              borderColor: "#777",
              borderRadius: 10,
            }}
          >
            <Text style={{ color: "#fff" }}>Reiniciar prévia</Text>
          </Pressable>
        </View>
        <DesktopKanban
          orders={orders}
          now={now}
          busy={false}
          loading={false}
          onToggleOven={(order) =>
            setOrders((items) =>
              items.map((item) =>
                item.id === order.id
                  ? { ...item, requestedForOven: !item.requestedForOven }
                  : item
              )
            )
          }
          onToggleCut={(order) =>
            setOrders((items) =>
              items.map((item) =>
                item.id === order.id
                  ? { ...item, requiresCut: !item.requiresCut }
                  : item
              )
            )
          }
          onChooseStatus={(order) => {
            const updated: KdsOrder = {
              ...order,
              status:
                order.status === "aguardandoForno" ? "assando" : "finalizado",
              requestedForOven: false,
              finalizadoAt:
                order.status === "assando" ? new Date().toISOString() : null,
            };
            setOrders((items) =>
              items.map((item) => (item.id === order.id ? updated : item))
            );
            if (needsCutNotice(updated)) setCutNotice(updated);
          }}
          onContact={() => {}}
        />
        <CutPizzaNotice
          order={cutNotice}
          onDismiss={() => setCutNotice(null)}
        />
        <Text
          style={{
            color: "#b3b3b3",
            padding: 10,
            fontSize: 11,
            textAlign: "center",
          }}
        >
          Toque no número para simular a próxima etapa. Nenhum dado é enviado ou
          salvo.
        </Text>
      </View>
    </KdsTypographyContext.Provider>
  );
}
