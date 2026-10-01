import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { desktop } from "../platform/desktop";
import type { DesktopWindowState } from "../platform/desktop";
import { Button } from "./Button";
import { theme } from "./theme";
export function DesktopToolbar() {
  const [state, setState] = useState<DesktopWindowState>({
    compact: false,
    alwaysOnTop: false,
  });
  const [error, setError] = useState("");
  useEffect(() => {
    desktop
      ?.getWindowState()
      .then(setState)
      .catch(() => setError("Não foi possível consultar a janela."));
  }, []);
  if (!desktop) return null;
  const update = (operation: Promise<DesktopWindowState>) => {
    setError("");
    operation
      .then(setState)
      .catch(() => setError("Não foi possível ajustar a janela."));
  };
  return (
    <View
      style={{
        padding: 8,
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
        <Text
          style={{
            flexGrow: 1,
            fontWeight: "700",
            color: theme.colors.foreground,
          }}
        >
          AMODOMIO
        </Text>
        <Button
          variant={state.compact ? "secondary" : "outline"}
          onPress={() => update(desktop!.setCompact(!state.compact))}
        >
          {state.compact ? "Expandir" : "Compacto"}
        </Button>
        <Button
          variant={state.alwaysOnTop ? "secondary" : "outline"}
          onPress={() => update(desktop!.setAlwaysOnTop(!state.alwaysOnTop))}
        >
          {state.alwaysOnTop ? "No topo: ligado" : "Sempre no topo"}
        </Button>
      </View>
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
    </View>
  );
}
