import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "../ui/Text";
import { theme } from "../ui/theme";
import { KDS_STATUSES, type KdsOrder, type KdsStatus } from "./types";

export function OrderStatusOptions({
  order,
  busy,
  onMove,
}: {
  order: KdsOrder;
  busy: boolean;
  onMove: (order: KdsOrder, status: KdsStatus) => void;
}) {
  return (
    <View>
      {KDS_STATUSES.map((status) => {
        const current = order.status === status.id;
        return (
          <Pressable
            key={status.id}
            accessibilityRole="button"
            accessibilityLabel={`Mover pedido ${
              order.commandNumber ?? "VL"
            } para ${status.label}`}
            accessibilityState={{
              selected: current,
              disabled: busy || current,
            }}
            disabled={busy || current}
            style={({ pressed }) => [
              styles.statusOption,
              current && styles.statusOptionCurrent,
              (busy || pressed) && { opacity: 0.5 },
            ]}
            onPress={() => onMove(order, status.id)}
          >
            <View
              style={[styles.statusMark, { backgroundColor: status.color }]}
            />
            <Text style={styles.statusOptionText}>{status.label}</Text>
            {current ? <Text style={styles.currentText}>Atual</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  statusMark: { width: 9, height: 9, borderRadius: 5 },
  statusOption: {
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  statusOptionCurrent: {
    borderColor: theme.colors.ring,
    backgroundColor: theme.colors.muted,
  },
  statusOptionText: {
    color: theme.colors.foreground,
    fontSize: 15,
    fontFamily: theme.typography.semibold,
    flex: 1,
  },
  currentText: {
    color: theme.colors.mutedForeground,
    fontSize: 11,
    fontFamily: theme.typography.semibold,
  },
});
