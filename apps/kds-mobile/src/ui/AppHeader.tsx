import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "./theme";
export function AppHeader({
  eyebrow = "AMODOMIO",
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
      </View>
      {action}
    </View>
  );
}
const styles = StyleSheet.create({
  header: {
    minHeight: 82,
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: theme.colors.foreground,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  eyebrow: {
    color: "#cbd5e1",
    fontFamily: theme.typography.bold,
    fontSize: 10,
    letterSpacing: 1.6,
  },
  title: {
    color: theme.colors.background,
    fontFamily: theme.typography.bold,
    fontSize: 24,
    marginTop: 3,
  },
});
