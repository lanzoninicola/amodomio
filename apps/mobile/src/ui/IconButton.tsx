import { Pressable, View } from "react-native";
import { Text } from "./Text";
import { theme } from "./theme";

const symbols: Record<string, string> = {
  kanban: "▥",
  reduced: "▦",
  home: "⌂",
  refresh: "↻",
  previous: "‹",
  next: "›",
};

export function IconButton({
  label,
  disabled,
  caption,
  icon,
  active,
  onPress,
}: {
  label: string;
  disabled?: boolean;
  caption?: string;
  icon: string;
  active?: boolean;
  onPress: () => void;
}) {
  const color = active ? theme.colors.primaryForeground : theme.colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{
        disabled: Boolean(disabled),
        ...(active !== undefined ? { selected: active } : {}),
      }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minWidth: 44,
        minHeight: 48,
        paddingHorizontal: 6,
        paddingVertical: 4,
        borderRadius: theme.radius.md,
        backgroundColor: active ? theme.colors.primary : theme.colors.secondary,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled || pressed ? 0.5 : 1,
      })}
    >
      <View pointerEvents="none" style={{ alignItems: "center", gap: 1 }}>
        <Text style={{ color, fontSize: 22, lineHeight: 24 }}>
          {symbols[icon] ?? "•"}
        </Text>
        {caption ? (
          <Text
            style={{
              color,
              fontFamily: theme.typography.semibold,
              fontSize: 10,
              lineHeight: 13,
            }}
          >
            {caption}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
