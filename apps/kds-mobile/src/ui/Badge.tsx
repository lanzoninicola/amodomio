import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "./theme";
export function Badge({
  children,
  tone = "secondary",
}: {
  children: ReactNode;
  tone?: "secondary" | "success" | "destructive";
}) {
  return (
    <View style={[styles.base, styles[tone]]}>
      <Text style={[styles.text, tone === "destructive" && styles.lightText]}>
        {children}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  base: {
    borderRadius: theme.radius.full,
    paddingHorizontal: 9,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  secondary: { backgroundColor: theme.colors.secondary },
  success: { backgroundColor: theme.colors.successMuted },
  destructive: { backgroundColor: theme.colors.destructive },
  text: {
    color: theme.colors.secondaryForeground,
    fontFamily: theme.typography.semibold,
    fontSize: 11,
  },
  lightText: { color: theme.colors.destructiveForeground },
});
