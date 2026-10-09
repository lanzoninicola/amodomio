import { BrandLogo } from "./BrandLogo";
import { Text } from "./Text";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
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
        {eyebrow === "AMODOMIO" ? (
          <BrandLogo light width={150} />
        ) : (
          <Text style={styles.eyebrow}>{eyebrow}</Text>
        )}
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
    backgroundColor: theme.colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  eyebrow: {
    color: theme.colors.brandBlueMuted,
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
