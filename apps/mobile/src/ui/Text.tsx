import { createContext, useContext } from "react";
import { Text as NativeText, StyleSheet, type TextProps } from "react-native";
import { theme } from "./theme";

export const KdsTypographyContext = createContext(false);

export function useTextFont(family?: string, weight = 400) {
  const mono = useContext(KdsTypographyContext);
  if (mono) {
    if (family?.startsWith("IBMPlexMono_")) return family;
    if (family === theme.typography.bold || weight >= 700)
      return "IBMPlexMono_Bold";
    if (
      family === theme.typography.semibold ||
      family === theme.typography.medium ||
      weight >= 500
    )
      return "IBMPlexMono_SemiBold";
    return "IBMPlexMono_Regular";
  }
  return (
    family ??
    (weight >= 700
      ? theme.typography.bold
      : weight >= 600
      ? theme.typography.semibold
      : weight >= 500
      ? theme.typography.medium
      : theme.typography.regular)
  );
}

export function Text({ style, ...props }: TextProps) {
  const resolved = StyleSheet.flatten(style);
  const weight = Number(resolved?.fontWeight ?? 400);
  const fontFamily = useTextFont(resolved?.fontFamily, weight);
  return (
    <NativeText
      {...props}
      style={[style, { fontFamily, fontWeight: "normal" }]}
    />
  );
}
