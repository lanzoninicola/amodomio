import type { ReactNode } from "react";
import { View } from "react-native";

export function ToolbarLayout({
  children,
  compact,
}: {
  children: ReactNode;
  compact: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: compact ? 12 : 8,
        padding: 8,
        backgroundColor: "#000000",
      }}
    >
      {children}
    </View>
  );
}
