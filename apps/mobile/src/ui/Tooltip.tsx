import type { ReactNode } from "react";
import { View } from "react-native";

export function Tooltip({
  children,
  grow = false,
}: {
  label: string;
  children: ReactNode;
  grow?: boolean;
}) {
  return (
    <View style={{ minWidth: 0, flex: grow ? 1 : undefined }}>{children}</View>
  );
}
