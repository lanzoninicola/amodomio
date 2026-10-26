import { Pressable, View } from "react-native";
import { Text } from "./Text";
import { theme } from "./theme";

const symbols: Record<string, string> = {
  details: "☰",
  kanban: "▥",
  reduced: "▦",
  home: "⌂",
  stock: "▤",
  filter: "☷",
  cancel: "×",
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
  appearance?: "toolbar" | "card";
  onPress: () => void;
}) {
  const color =
    icon === "filter-off"
      ? "#ffffff"
      : active
      ? theme.colors.primaryForeground
      : theme.colors.primary;
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
        backgroundColor:
          icon === "filter-off"
            ? "#2563eb"
            : active
            ? theme.colors.primary
            : theme.colors.secondary,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled || pressed ? 0.5 : 1,
      })}
    >
      <View pointerEvents="none" style={{ alignItems: "center", gap: 1 }}>
        {icon === "calendar" ? (
          <View
            style={{
              width: 22,
              height: 21,
              borderWidth: 2,
              borderColor: color,
              borderRadius: 3,
              marginTop: 3,
            }}
          >
            <View
              style={{
                position: "absolute",
                top: 4,
                left: 0,
                right: 0,
                height: 2,
                backgroundColor: color,
              }}
            />
            {[4, 12].map((left) => (
              <View
                key={left}
                style={{
                  position: "absolute",
                  top: -5,
                  left,
                  width: 2,
                  height: 6,
                  backgroundColor: color,
                }}
              />
            ))}
            <View
              style={{
                position: "absolute",
                top: 10,
                left: 4,
                width: 4,
                height: 4,
                backgroundColor: color,
              }}
            />
          </View>
        ) : icon === "filter" || icon === "filter-off" ? (
          <View
            style={{
              width: 24,
              height: 24,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                width: 0,
                height: 0,
                borderLeftWidth: 9,
                borderRightWidth: 9,
                borderTopWidth: 11,
                borderLeftColor: "transparent",
                borderRightColor: "transparent",
                borderTopColor: color,
              }}
            />
            <View
              style={{
                width: 4,
                height: 8,
                backgroundColor: color,
                marginTop: -1,
              }}
            />
            {icon === "filter-off" ? (
              <View
                style={{
                  position: "absolute",
                  width: 28,
                  height: 3,
                  backgroundColor: color,
                  transform: [{ rotate: "45deg" }],
                }}
              />
            ) : null}
          </View>
        ) : (
          <Text style={{ color, fontSize: 22, lineHeight: 24 }}>
            {symbols[icon] ?? "•"}
          </Text>
        )}
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
