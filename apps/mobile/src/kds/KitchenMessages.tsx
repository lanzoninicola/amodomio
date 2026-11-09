import { useEffect, useRef, useState } from "react";
import { AppState, Modal, ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../ui/Button";
import { Text } from "../ui/Text";
import { theme } from "../ui/theme";
import {
  listKitchenMessages,
  submitKitchenMessage,
  type KitchenMessage,
} from "../api/client";

export function KitchenMessages({
  apiUrl,
  token,
  sender = false,
  blocked = false,
}: {
  apiUrl: string;
  token: string;
  sender?: boolean;
  blocked?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, setPending] = useState<KitchenMessage[]>([]);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const revision = useRef(0);
  const delivery = useRef<{ id: string; text: string } | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (sender) return;
    let alive = true,
      loading = false;
    const load = async () => {
      if (loading || savingRef.current || AppState.currentState !== "active")
        return;
      loading = true;
      const startedAt = revision.current;
      try {
        const data = await listKitchenMessages(apiUrl, token);
        if (alive && !savingRef.current && startedAt === revision.current)
          setPending(data.messages);
      } catch {
        /* Keep unacknowledged messages visible during network failures. */
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
  }, [apiUrl, token, sender]);
  const current = pending[0];
  const submit = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    revision.current += 1;
    setSaving(true);
    setError("");
    try {
      if (sender) {
        if (!delivery.current || delivery.current.text !== text.trim())
          delivery.current = {
            id: globalThis.crypto.randomUUID(),
            text: text.trim(),
          };
        await submitKitchenMessage(apiUrl, token, {
          intent: "send",
          ...delivery.current,
        });
        delivery.current = null;
        setText("");
        setOpen(false);
        setNotice("Mensagem enviada à cozinha.");
      } else if (current) {
        await submitKitchenMessage(apiUrl, token, {
          intent: "acknowledge",
          id: current.id,
        });
        setPending((values) =>
          values.filter((value) => value.id !== current.id)
        );
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Tente novamente.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  return (
    <>
      {sender ? (
        <View style={{ padding: 8, gap: 4 }}>
          <Button
            variant="secondary"
            onPress={() => {
              setOpen(true);
              setNotice("");
              setError("");
            }}
          >
            Avisar cozinha
          </Button>
          {notice ? <Text accessibilityRole="alert">{notice}</Text> : null}
        </View>
      ) : null}
      <Modal
        visible={sender ? open : Boolean(current) && !blocked}
        animationType="fade"
        presentationStyle="fullScreen"
        supportedOrientations={[
          "portrait",
          "landscape-left",
          "landscape-right",
        ]}
        onRequestClose={() => {
          if (sender && !saving) setOpen(false);
        }}
      >
        <SafeAreaView
          style={{ flex: 1, backgroundColor: theme.colors.primary }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              flexGrow: 1,
              padding: 24,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <View
              accessibilityViewIsModal
              style={{ width: "100%", maxWidth: 900, gap: 24 }}
            >
              <Text
                accessibilityRole="header"
                style={{
                  color: theme.colors.primaryForeground,
                  fontSize: 28,
                  textAlign: "center",
                }}
              >
                {sender ? "Avisar cozinha" : "Aviso do atendimento"}
              </Text>
              {sender ? (
                <TextInput
                  accessibilityLabel="Mensagem para a cozinha"
                  placeholder="Escreva o aviso para a cozinha…"
                  multiline
                  maxLength={500}
                  editable={!saving}
                  value={text}
                  onChangeText={setText}
                  style={{
                    backgroundColor: "white",
                    color: "#111",
                    borderRadius: 12,
                    padding: 20,
                    minHeight: 180,
                    fontSize: 22,
                    textAlignVertical: "top",
                  }}
                />
              ) : (
                <Text
                  accessibilityRole="alert"
                  style={{
                    color: theme.colors.primaryForeground,
                    fontSize: 40,
                    textAlign: "center",
                    fontFamily: theme.typography.bold,
                  }}
                >
                  {current?.description}
                </Text>
              )}
              {error ? (
                <Text
                  accessibilityRole="alert"
                  style={{ color: theme.colors.primaryForeground }}
                >
                  {error}
                </Text>
              ) : null}
              <Button
                variant="secondary"
                loading={saving}
                disabled={sender && !text.trim()}
                style={{ minHeight: 64 }}
                onPress={() => void submit()}
              >
                {sender ? "Enviar mensagem" : "Entendi"}
              </Button>
              {sender ? (
                <Button
                  variant="secondary"
                  disabled={saving}
                  onPress={() => setOpen(false)}
                >
                  Cancelar
                </Button>
              ) : null}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}
