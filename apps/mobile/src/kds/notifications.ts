import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function prepareNotifications() {
  if (Platform.OS === "web") return;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("novos-pedidos", {
      name: "Novos pedidos",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      vibrationPattern: [0, 250, 150, 250],
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (!current.granted) await Notifications.requestPermissionsAsync();
}

export async function notifyNewOrders(commandNumbers: Array<number | null>) {
  if (Platform.OS === "web" || commandNumbers.length === 0) return;
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  const label = commandNumbers
    .filter(Boolean)
    .map((number) => `#${number}`)
    .join(", ");
  await Notifications.scheduleNotificationAsync({
    content: {
      title:
        commandNumbers.length === 1
          ? "Novo pedido no KDS"
          : `${commandNumbers.length} novos pedidos`,
      body: label || "Abra o KDS para visualizar.",
      sound: "default",
    },
    trigger: null,
  });
}
