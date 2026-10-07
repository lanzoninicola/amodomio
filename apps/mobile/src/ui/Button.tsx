import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type ViewStyle,
} from "react-native";
import { theme } from "./theme";

type Variant = "primary" | "secondary" | "outline" | "destructive" | "ghost";
const palettes: Record<
  Variant,
  { backgroundColor: string; color: string; borderColor?: string }
> = {
  primary: {
    backgroundColor: theme.colors.primary,
    color: theme.colors.primaryForeground,
  },
  secondary: {
    backgroundColor: theme.colors.secondary,
    color: theme.colors.secondaryForeground,
  },
  outline: {
    backgroundColor: "transparent",
    color: theme.colors.foreground,
    borderColor: theme.colors.input,
  },
  destructive: {
    backgroundColor: theme.colors.destructive,
    color: theme.colors.destructiveForeground,
  },
  ghost: { backgroundColor: "transparent", color: theme.colors.foreground },
};

export function Button({
  children,
  onPress,
  disabled,
  loading,
  variant = "primary",
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: Variant;
  style?: ViewStyle;
}) {
  const palette = palettes[variant];
  return (
    <Pressable
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: palette.backgroundColor,
          borderColor: palette.borderColor,
          borderWidth: palette.borderColor ? 1 : 0,
        },
        style,
        (pressed || disabled) && styles.dimmed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.color} />
      ) : typeof children === "string" ? (
        <Text style={[styles.label, { color: palette.color }]}>{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 40,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  label: { fontFamily: theme.typography.medium, fontSize: 14 },
  dimmed: { opacity: 0.55 },
});
