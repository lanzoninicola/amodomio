import { BrandLogo } from "./BrandLogo";
import { Text } from "./Text";
import { useState } from "react";
import { View } from "react-native";
import { desktop } from "../platform/desktop";
import type { DesktopWindowState } from "../platform/desktop";
import { IconButton } from "./IconButton";
import { useDesktopWindow } from "../platform/useDesktopWindow";
import { theme } from "./theme";
export function DesktopToolbar() {
  const state = useDesktopWindow();
  const [error, setError] = useState("");
  if (!desktop) return null;
  const update = (operation: Promise<DesktopWindowState>) => {
    setError("");
    operation.catch(() => setError("Não foi possível ajustar a janela."));
  };
  return (
    <View
      style={{
        padding: 8,
        zIndex: 100,
        gap: 8,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        backgroundColor: theme.colors.background,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
        }}
      >
        <View style={{ flexGrow: 1 }}>
          <BrandLogo width={156} />
        </View>
        <IconButton
          icon="compact"
          label={state.compact ? "Expandir janela" : "Modo compacto"}
          active={state.compact}
          onPress={() => update(desktop!.setCompact(!state.compact))}
        />
        <IconButton
          icon="pin"
          label={
            state.alwaysOnTop ? "Desativar sempre no topo" : "Sempre no topo"
          }
          active={state.alwaysOnTop}
          onPress={() => update(desktop!.setAlwaysOnTop(!state.alwaysOnTop))}
        />
      </View>
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
    </View>
  );
}
