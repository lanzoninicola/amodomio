import type { ReactNode } from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { theme } from "./theme";

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}
export function CardTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}
export function CardDescription({ children }: { children: ReactNode }) {
  return <Text style={styles.description}>{children}</Text>;
}
const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    ...theme.shadow.card,
  },
  title: {
    color: theme.colors.cardForeground,
    fontFamily: theme.typography.semibold,
    fontSize: 18,
  },
  description: {
    color: theme.colors.mutedForeground,
    fontFamily: theme.typography.regular,
    fontSize: 14,
    lineHeight: 20,
  },
});
