import { useEffect, useRef, useState, useCallback } from "react";
import type { Lexicon, StatusId, LanguageCode } from "./types";

export const VOICE_FEEDBACK = false;

export function speak(text: string) {
  try {
    if (!VOICE_FEEDBACK) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "pt-BR";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {}
}

export function normalizeText(s: string) {
  try {
    return s
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return s.toLowerCase().trim();
  }
}

export function detectStatusWithLexicon(
  text: string,
  merged: Lexicon
): StatusId | null {
  if (
    /\b(assar|assando|botar pra assar|bota pra assar|entra no forno|taca no forno|inforna|metti a cuocere|butta in forno)\b/.test(
      text
    )
  ) {
    return "assando";
  }
  for (const [status, words] of Object.entries(merged.intents) as [
    StatusId,
    string[]
  ][]) {
    for (const w of words) {
      if (w && text.includes(w)) {
        if (w.includes("forno") && status === "aguardandoForno")
          return "aguardandoForno";
        return status;
      }
    }
  }
  if (/\b(finaliza(d[oa])?|finito|chiudi|concluso|terminato)\b/.test(text))
    return "finalizado";
  if (/\b(producao|produção|produzione)\b/.test(text)) return "emProducao";
  if (/\b(assar|cuocere|inforna(re)?)\b/.test(text)) return "assando";
  if (/\bforno\b/.test(text)) return "aguardandoForno";
  if (/\b(novo|nuovo)\b/.test(text)) return "novoPedido";
  return null;
}

export function parseNumberMulti(
  text: string,
  fns: Array<(t: string) => number | null>
): number | null {
  for (const fn of fns) {
    const n = fn(text);
    if (n != null) return n;
  }
  return null;
}

type VoiceOpts = { lang?: LanguageCode; autoStart?: boolean };

export type VoiceApi = {
  active: boolean;
  listening: boolean;
  interimText: string;
  lastHeard: string;
  micStatus:
    | "parado"
    | "aguardando"
    | "ouvindo"
    | "negado"
    | "erro"
    | "reconectando"
    | "solicitando";
  start: () => void;
  stop: () => void;
};

export function useVoice(
  onCommand: (normalized: string, raw: string) => void,
  opts: VoiceOpts = {}
): VoiceApi {
  const lang = opts.lang ?? "pt-BR";
  const [active, setActive] = useState<boolean>(false);
  const [listening, setListening] = useState(false);
  const [interimText, setInterim] = useState("");
  const [lastHeard, setLastHeard] = useState("");
  const [micStatus, setMicStatus] = useState<VoiceApi["micStatus"]>("parado");

  const recognitionRef = useRef<any>(null);
  const clearLastTimeoutRef = useRef<number | null>(null);
  const isIntentionalStop = useRef(false);
  const networkErrorCount = useRef(0);
  const lastNetworkError = useRef<number>(0);
  const restartTimeout = useRef<number | null>(null);

  // Limpa todos os timeouts
  const clearAllTimeouts = useCallback(() => {
    if (clearLastTimeoutRef.current) {
      clearTimeout(clearLastTimeoutRef.current);
      clearLastTimeoutRef.current = null;
    }
    if (restartTimeout.current) {
      clearTimeout(restartTimeout.current);
      restartTimeout.current = null;
    }
  }, []);

  // Para e limpa o reconhecimento atual
  const cleanupRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onstart = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.stop();
      } catch {}

      // Pequeno delay antes de limpar a referência
      setTimeout(() => {
        recognitionRef.current = null;
      }, 100);
    }
  }, []);

  // Cria nova instância de reconhecimento
  const createRecognition = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.error("SpeechRecognition not available");
      setMicStatus("erro");
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log("Recognition started successfully");
      setListening(true);
      setMicStatus("ouvindo");
      networkErrorCount.current = 0; // Reset error count on successful start
    };

    recognition.onend = () => {
      console.log("Recognition ended");
      setListening(false);
      setInterim("");

      // Só reinicia se não foi parada intencionalmente e ainda está ativo
      if (!isIntentionalStop.current && active) {
        setMicStatus("reconectando");
        console.log("Will restart in 2 seconds...");

        clearAllTimeouts();
        restartTimeout.current = setTimeout(() => {
          if (active && !isIntentionalStop.current) {
            console.log("Restarting recognition...");
            startRecognitionInternal();
          }
        }, 2000) as unknown as number;
      } else {
        setMicStatus("parado");
      }
    };

    recognition.onerror = (event: any) => {
      const error = event.error;
      console.log(`Recognition error: ${error}`, event);

      // Trata erro de rede especificamente
      if (error === "network") {
        const now = Date.now();

        // Se o último erro de rede foi há menos de 5 segundos, incrementa contador
        if (now - lastNetworkError.current < 5000) {
          networkErrorCount.current++;
        } else {
          networkErrorCount.current = 1;
        }
        lastNetworkError.current = now;

        console.log(`Network error count: ${networkErrorCount.current}`);

        // Se muitos erros de rede em sequência, para tentar
        if (networkErrorCount.current >= 3) {
          console.error("Too many network errors, stopping");
          setMicStatus("erro");
          setActive(false);
          isIntentionalStop.current = true;
          cleanupRecognition();

          // Reset após 10 segundos para permitir nova tentativa
          setTimeout(() => {
            networkErrorCount.current = 0;
            isIntentionalStop.current = false;
          }, 10000);
          return;
        }

        // Aguarda mais tempo antes de tentar novamente após erro de rede
        setMicStatus("reconectando");
        return; // Deixa o onend lidar com o restart
      }

      // Erro de permissão
      if (error === "not-allowed" || error === "service-not-allowed") {
        console.error("Permission denied");
        setMicStatus("negado");
        setActive(false);
        isIntentionalStop.current = true;
        cleanupRecognition();
        return;
      }

      // Erro "aborted" - geralmente ok, vai reiniciar via onend
      if (error === "aborted") {
        console.log("Recognition aborted (will restart if active)");
        return;
      }

      // Erro "no-speech" - normal, continua
      if (error === "no-speech") {
        console.log("No speech detected (normal)");
        return;
      }

      // Outros erros
      console.error(`Unhandled error: ${error}`);
      setMicStatus("erro");
    };

    recognition.onresult = (event: any) => {
      let finalText = "";
      let interim = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (interim) {
        setInterim(interim.trim());
        setMicStatus("ouvindo"); // Garante que mostra "ouvindo" quando há atividade
      }

      if (finalText) {
        const raw = finalText.trim();
        console.log("Final text:", raw);
        setLastHeard(raw);
        setInterim("");

        // Reset network error count on successful recognition
        networkErrorCount.current = 0;

        clearAllTimeouts();
        clearLastTimeoutRef.current = setTimeout(
          () => setLastHeard(""),
          4000
        ) as unknown as number;

        const normalized = normalizeText(raw);
        onCommand(normalized, raw);
      }
    };

    return recognition;
  }, [lang, onCommand, active, clearAllTimeouts, cleanupRecognition]);

  // Função interna para iniciar reconhecimento
  const startRecognitionInternal = useCallback(() => {
    // Limpa qualquer reconhecimento anterior
    cleanupRecognition();

    // Aguarda um pouco para garantir limpeza
    setTimeout(() => {
      const recognition = createRecognition();
      if (!recognition) {
        setMicStatus("erro");
        return;
      }

      recognitionRef.current = recognition;

      try {
        console.log("Starting recognition...");
        setMicStatus("aguardando");
        recognition.start();
      } catch (error: any) {
        console.error("Error starting recognition:", error);

        if (error.name === "InvalidStateError") {
          // Já está rodando - não é erro
          console.log("Recognition already running");
          setListening(true);
          setMicStatus("ouvindo");
        } else {
          setMicStatus("erro");

          // Tenta novamente após delay
          if (active && !isIntentionalStop.current) {
            restartTimeout.current = setTimeout(() => {
              if (active) {
                startRecognitionInternal();
              }
            }, 3000) as unknown as number;
          }
        }
      }
    }, 200);
  }, [createRecognition, cleanupRecognition, active]);

  // Inicia reconhecimento (público)
  const startRecognition = useCallback(() => {
    console.log("Starting voice recognition...");
    isIntentionalStop.current = false;
    networkErrorCount.current = 0;
    clearAllTimeouts();
    startRecognitionInternal();
  }, [startRecognitionInternal, clearAllTimeouts]);

  // Para reconhecimento (público)
  const stopRecognition = useCallback(() => {
    console.log("Stopping voice recognition...");
    isIntentionalStop.current = true;
    clearAllTimeouts();
    cleanupRecognition();
    setListening(false);
    setInterim("");
    setMicStatus("parado");
  }, [cleanupRecognition, clearAllTimeouts]);

  // Controla início/parada baseado no estado active
  useEffect(() => {
    if (active) {
      startRecognition();
    } else {
      stopRecognition();
    }

    // Cleanup ao desmontar
    return () => {
      isIntentionalStop.current = true;
      clearAllTimeouts();
      cleanupRecognition();
    };
  }, [active]); // Removidas dependências de funções para evitar loops

  // Funções públicas da API
  const start = useCallback(() => {
    console.log("Manual start requested");
    setActive(true);
  }, []);

  const stop = useCallback(() => {
    console.log("Manual stop requested");
    setActive(false);
  }, []);

  return {
    active,
    listening,
    interimText,
    lastHeard,
    micStatus,
    start,
    stop,
  };
}
