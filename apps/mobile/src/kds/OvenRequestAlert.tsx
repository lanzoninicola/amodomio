import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../ui/theme";
import { Text } from "../ui/Text";
import { useEffect, useRef, useState } from "react";
import {
  AppState,
  Alert,
  Animated,
  Easing,
  Modal,
  ScrollView,
  View,
  useWindowDimensions,
} from "react-native";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";
import { listOrders, updateStatus } from "../api/client";
import { Button } from "../ui/Button";
import type { KdsOrder } from "./types";
import { pendingOvenAlerts } from "./oven-alerts";
import { useKdsSoundPreferences } from "../platform/useKdsSoundPreferences";
export function OvenRequestAlert({
  token,
  apiUrl,
}: {
  token: string;
  apiUrl: string;
}) {
  const { width, height } = useWindowDimensions();
  const numberSize = Math.min(
    160,
    Math.max(80, Math.min(width, height) * 0.25)
  );
  const player = useAudioPlayer(require("../../assets/oven-alert.wav"));
  const sound = useKdsSoundPreferences();
  const { isLoaded } = useAudioPlayerStatus(player);
  const pulse = useRef(new Animated.Value(0)).current;
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const acknowledged = useRef(new Set<string>());
  const [pending, setPending] = useState<KdsOrder[]>([]);
  useEffect(() => {
    let alive = true;
    let loading = false;
    const load = async () => {
      if (loading || savingRef.current || AppState.currentState !== "active")
        return;
      loading = true;
      try {
        const today = new Date();
        const date = `${today.getFullYear()}-${String(
          today.getMonth() + 1
        ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        const orders = await listOrders(apiUrl, token, date);
        if (alive && !savingRef.current)
          setPending(pendingOvenAlerts(orders, acknowledged.current));
      } catch {
        /* Only a successful server response can clear or rearm requests. */
      } finally {
        loading = false;
      }
    };
    void load();
    const timer = setInterval(load, 4000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void load();
    });
    return () => {
      alive = false;
      clearInterval(timer);
      subscription.remove();
    };
  }, [token, apiUrl]);
  const current = pending[0];
  useEffect(() => {
    if (!current?.id) return;
    let alive = true;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    );
    const startSound = async () => {
      if (!isLoaded || !sound.enabled || sound.volume === 0) return;
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: false,
          interruptionMode: "duckOthers",
        });
        if (!alive || AppState.currentState !== "active") return;
        player.loop = true;
        player.volume = sound.volume;
        await player.seekTo(0);
        if (alive && AppState.currentState === "active") player.play();
      } catch (reason) {
        console.warn("Não foi possível reproduzir o aviso do forno", reason);
      }
    };
    animation.start();
    void startSound();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void startSound();
      else player.pause();
    });
    return () => {
      alive = false;
      subscription.remove();
      animation.stop();
      pulse.setValue(0);
      player.pause();
    };
  }, [current?.id, isLoaded, player, pulse, sound.enabled, sound.volume]);
  const dismiss = () => {
    if (!current || savingRef.current) return;
    acknowledged.current.add(current.id);
    setPending((values) => values.filter((order) => order.id !== current.id));
  };
  const bake = async () => {
    if (!current || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await updateStatus(apiUrl, token, current.id, "assando", true);
      acknowledged.current.add(current.id);
      setPending((values) => values.filter((order) => order.id !== current.id));
    } catch (reason) {
      Alert.alert(
        "Pedido não atualizado",
        reason instanceof Error ? reason.message : "Tente novamente."
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  return (
    <Modal
      visible={Boolean(current)}
      presentationStyle="fullScreen"
      animationType="fade"
      supportedOrientations={["portrait", "landscape-left", "landscape-right"]}
      onRequestClose={dismiss}
    >
      <Animated.View
        style={{
          flex: 1,
          backgroundColor: pulse.interpolate({
            inputRange: [0, 1],
            outputRange: [theme.colors.primary, "#713719"],
          }),
        }}
      >
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              padding: 24,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              accessibilityViewIsModal
              style={{
                width: "100%",
                maxWidth: 900,
                alignItems: "center",
                gap: 16,
              }}
            >
              <View
                style={{
                  backgroundColor: theme.colors.brandOrangeMuted,
                  borderRadius: theme.radius.full,
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                }}
              >
                <Text
                  accessibilityRole="alert"
                  style={{
                    fontSize: 30,
                    fontFamily: theme.typography.bold,
                    color: theme.colors.brandOrangeInk,
                    textAlign: "center",
                  }}
                >
                  Colocar no forno
                </Text>
              </View>
              <Text
                style={{
                  fontSize: 18,
                  fontFamily: theme.typography.semibold,
                  color: theme.colors.primaryForeground,
                }}
              >
                PEDIDO
              </Text>
              <Text
                accessibilityLabel={`Pedido número ${
                  current?.commandNumber ?? "VL"
                }`}
                style={{
                  fontSize: numberSize,
                  fontFamily: theme.typography.bold,
                  color: theme.colors.primaryForeground,
                  textAlign: "center",
                  fontVariant: ["tabular-nums"],
                  width: "100%",
                }}
              >
                #{current?.commandNumber ?? "VL"}
              </Text>
              {current?.customerName ? (
                <Text
                  style={{
                    fontSize: 22,
                    color: theme.colors.primaryForeground,
                    textAlign: "center",
                  }}
                >
                  {current.customerName}
                </Text>
              ) : null}
              {pending.length > 1 ? (
                <Text
                  style={{
                    fontSize: 16,
                    color: theme.colors.primaryForeground,
                    textAlign: "center",
                  }}
                >
                  Mais {pending.length - 1} pedido(s) aguardando aviso.
                </Text>
              ) : null}
              <View
                style={{
                  flexDirection: "row",
                  gap: 12,
                  width: "100%",
                  maxWidth: 600,
                  marginTop: 12,
                }}
              >
                <Button
                  disabled={saving}
                  variant="secondary"
                  style={{
                    minHeight: 60,
                    flex: 1,
                  }}
                  onPress={dismiss}
                >
                  <Text
                    style={{
                      fontSize: 20,
                      fontFamily: theme.typography.bold,
                      color: theme.colors.primary,
                    }}
                  >
                    Entendi
                  </Text>
                </Button>
                <Button
                  variant="secondary"
                  loading={saving}
                  style={{
                    flex: 1,
                    minHeight: 60,
                    backgroundColor: theme.colors.brandOrangeMuted,
                  }}
                  onPress={() => void bake()}
                >
                  <Text
                    style={{
                      fontSize: 20,
                      fontFamily: theme.typography.bold,
                      color: theme.colors.brandOrangeInk,
                    }}
                  >
                    Assando
                  </Text>
                </Button>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}
