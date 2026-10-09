import { requireOptionalNativeModule } from "expo";
import type { ExpoSpeechRecognitionModule } from "expo-speech-recognition";
import { useEffect, useRef, useState } from "react";
import { AppState, Modal, View } from "react-native";
import { Button } from "../ui/Button";
import { Text } from "../ui/Text";
import { theme } from "../ui/theme";
import { KDS_STATUSES, type KdsOrder } from "./types";
import {
  parseVoiceCommand,
  resolveVoiceOrder,
  type VoiceCommand,
} from "./voice-command";

// Old installed binaries can still open the KDS before receiving a native rebuild.
const speech = requireOptionalNativeModule<typeof ExpoSpeechRecognitionModule>(
  "ExpoSpeechRecognition"
);

export function VoiceCommandButton({
  orders,
  disabled,
  onCommand,
}: {
  orders: KdsOrder[];
  disabled: boolean;
  onCommand: (order: KdsOrder, command: VoiceCommand) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<
    "idle" | "listening" | "confirm" | "saving" | "done"
  >("idle");
  const [transcript, setTranscript] = useState("");
  const [message, setMessage] = useState("");
  const [command, setCommand] = useState<VoiceCommand | null>(null);
  const session = useRef(0);
  const listening = useRef(false);
  const receivedFinal = useRef(false);
  const saving = useRef(false);

  const close = () => {
    session.current++;
    listening.current = false;
    speech?.abort();
    setOpen(false);
  };

  useEffect(() => {
    const subscriptions = speech
      ? [
          speech.addListener("result", (event) => {
            if (!listening.current || receivedFinal.current) return;
            const text = event.results[0]?.transcript ?? "";
            setTranscript(text);
            if (!event.isFinal) return;
            receivedFinal.current = true;
            const parsed = parseVoiceCommand(text);
            setCommand(parsed);
            setPhase(parsed ? "confirm" : "idle");
            if (!parsed)
              setMessage(
                "Comando não reconhecido. Diga, por exemplo: “número 123 assando”."
              );
          }),
          speech.addListener("end", () => {
            if (!listening.current) return;
            listening.current = false;
            if (!receivedFinal.current) {
              setPhase("idle");
              setMessage(
                (current) =>
                  current || "Nenhuma fala reconhecida. Tente novamente."
              );
            }
          }),
          speech.addListener("error", (event) => {
            if (!listening.current || receivedFinal.current) return;
            listening.current = false;
            setPhase("idle");
            setMessage(
              event.error === "not-allowed"
                ? "Permita o acesso ao microfone e ao reconhecimento de voz nas configurações do aparelho."
                : event.error === "network"
                ? "O reconhecimento de voz precisa de conexão. Tente novamente."
                : "Não foi possível reconhecer a fala. Tente novamente."
            );
          }),
        ]
      : [];
    const appState = AppState.addEventListener("change", (state) => {
      // iOS permission dialogs temporarily make the app inactive.
      if (state === "background") close();
    });
    return () => {
      session.current++;
      listening.current = false;
      speech?.abort();
      subscriptions.forEach((subscription) => subscription.remove());
      appState.remove();
    };
  }, []);

  const listen = async () => {
    if (disabled || saving.current || listening.current) return;
    const currentSession = ++session.current;
    setOpen(true);
    setTranscript("");
    setCommand(null);
    setMessage("");
    setPhase("listening");
    receivedFinal.current = false;
    listening.current = true;
    try {
      if (!speech)
        throw new Error(
          "Instale a nova versão do app para usar os comandos de voz."
        );
      if (!speech.isRecognitionAvailable())
        throw new Error(
          "O reconhecimento de voz não está disponível neste aparelho."
        );
      const permission = await speech.requestPermissionsAsync();
      if (
        currentSession !== session.current ||
        AppState.currentState === "background"
      )
        return;
      if (!permission.granted)
        throw new Error(
          "Permita o acesso ao microfone e ao reconhecimento de voz nas configurações do aparelho."
        );
      speech.start({
        lang: "pt-BR",
        interimResults: true,
        continuous: false,
        maxAlternatives: 1,
      });
    } catch (error) {
      if (currentSession !== session.current) return;
      listening.current = false;
      setPhase("idle");
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível iniciar o microfone."
      );
    }
  };

  const target = command ? resolveVoiceOrder(orders, command) : null;
  const label = KDS_STATUSES.find(
    (status) => status.id === command?.status
  )?.label;
  const confirm = async () => {
    if (!command || !target || disabled || saving.current) return;
    saving.current = true;
    listening.current = false;
    speech?.abort();
    const currentSession = session.current;
    setPhase("saving");
    try {
      const success = await onCommand(target, command);
      if (currentSession !== session.current) return;
      setPhase(success ? "done" : "confirm");
      setMessage(
        success
          ? `Pedido ${command.commandNumber} atualizado para ${label}.`
          : "Não foi possível salvar. Tente novamente."
      );
    } catch {
      if (currentSession === session.current) {
        setPhase("confirm");
        setMessage("Não foi possível salvar. Tente novamente.");
      }
    } finally {
      saving.current = false;
    }
  };

  return (
    <>
      <Button
        variant="outline"
        disabled={disabled}
        onPress={() => void listen()}
        style={{ paddingHorizontal: 10 }}
      >
        Voz
      </Button>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={close}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            padding: 24,
            backgroundColor: "rgba(0,0,0,0.55)",
          }}
        >
          <View
            style={{
              backgroundColor: theme.colors.background,
              padding: 20,
              borderRadius: theme.radius.md,
              gap: 16,
              width: "100%",
              maxWidth: 440,
              alignSelf: "center",
            }}
          >
            <Text
              style={{ fontFamily: theme.typography.semibold, fontSize: 20 }}
            >
              Comando de voz
            </Text>
            <Text>
              {phase === "listening"
                ? "Ouvindo…"
                : "Diga: “número 123 assando”."}
            </Text>
            {transcript ? <Text>{transcript}</Text> : null}
            {phase === "confirm" && command ? (
              <>
                <Text>
                  {target
                    ? `Pedido ${command.commandNumber} → ${label}`
                    : `Não há um pedido único com o número ${command.commandNumber} na data aberta.`}
                </Text>
                {target && command.status === "assando" ? (
                  <Text>
                    A solicitação do forno será marcada como atendida.
                  </Text>
                ) : null}
              </>
            ) : null}
            {message ? (
              <Text accessibilityLiveRegion="polite">{message}</Text>
            ) : null}
            {phase === "confirm" && target ? (
              <Button disabled={disabled} onPress={() => void confirm()}>
                Confirmar alteração
              </Button>
            ) : null}
            {phase === "saving" ? <Button loading>Salvando</Button> : null}
            {phase === "idle" || phase === "confirm" || phase === "done" ? (
              <Button
                variant="outline"
                disabled={disabled}
                onPress={() => void listen()}
              >
                Falar novamente
              </Button>
            ) : null}
            <Button
              variant="ghost"
              disabled={phase === "saving"}
              onPress={close}
            >
              {phase === "done" ? "Fechar" : "Cancelar"}
            </Button>
          </View>
        </View>
      </Modal>
    </>
  );
}
