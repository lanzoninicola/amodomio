import { useEffect, useRef, useState } from "react";
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
  /** Intenção do usuário (botão) */
  active: boolean;
  /** Estado real do motor */
  listening: boolean;
  /** Último parcial (interim) */
  interimText: string;
  /** Último final */
  lastHeard: string;
  /** Status textual do mic (para UI) */
  micStatus: "parado" | "aguardando" | "ouvindo" | "negado" | "erro";
  /** Liga/desliga */
  start: () => void;
  stop: () => void;
};

export function useVoice(
  onCommand: (normalized: string, raw: string) => void,
  opts: VoiceOpts = {}
): VoiceApi {
  const lang = opts.lang ?? "pt-BR";
  const [active, setActive] = useState<boolean>(opts.autoStart ?? false);
  const [listening, setListening] = useState(false);
  const [interimText, setInterim] = useState("");
  const [lastHeard, setLastHeard] = useState("");
  const [micStatus, setMicStatus] = useState<VoiceApi["micStatus"]>("parado");

  const canUse = useRef(false);
  const recognitionRef = useRef<any>(null);
  const isStartingRef = useRef(false);
  const shouldRestartRef = useRef(false);
  const restartTimeoutRef = useRef<number | null>(null);
  const clearLastTimeoutRef = useRef<number | null>(null);
  const visibilityPausedRef = useRef(false);
  const micGrantedRef = useRef<boolean | null>(null);
  const errorCountRef = useRef(0);
  const lastStartTimeRef = useRef(0);

  // Limpa timeouts
  const clearTimeouts = () => {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    if (clearLastTimeoutRef.current) {
      clearTimeout(clearLastTimeoutRef.current);
      clearLastTimeoutRef.current = null;
    }
  };

  // Verifica permissões do microfone
  useEffect(() => {
    (async () => {
      try {
        if (
          "permissions" in navigator &&
          (navigator as any).permissions?.query
        ) {
          const permission = await (navigator as any).permissions.query({
            name: "microphone" as any,
          });
          micGrantedRef.current = permission.state === "granted";
          setMicStatus(
            micGrantedRef.current
              ? "parado"
              : permission.state === "denied"
              ? "negado"
              : "parado"
          );
          permission.onchange = () => {
            micGrantedRef.current = permission.state === "granted";
            setMicStatus(
              micGrantedRef.current
                ? "parado"
                : permission.state === "denied"
                ? "negado"
                : "parado"
            );
            if (!micGrantedRef.current && active) {
              setActive(false);
            }
          };
        } else {
          micGrantedRef.current = null;
        }
      } catch {
        micGrantedRef.current = null;
      }
    })();
  }, []);

  // Controla visibilidade da página
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        console.log("Page hidden, pausing recognition");
        visibilityPausedRef.current = true;
        stopRecognition();
      } else {
        console.log("Page visible, resuming if active");
        visibilityPausedRef.current = false;
        if (active) {
          setTimeout(() => {
            if (active && !visibilityPausedRef.current) {
              startRecognition();
            }
          }, 500);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearTimeouts();
    };
  }, []);

  // Inicializa reconhecimento de voz
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    canUse.current = Boolean(SpeechRecognition);

    if (!SpeechRecognition) {
      console.log("SpeechRecognition not available");
      return;
    }

    // Sempre cria novo reconhecimento
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
    }

    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      console.log("Recognition started");
      isStartingRef.current = false;
      setListening(true);
      setMicStatus("ouvindo");
      errorCountRef.current = 0;
    };

    recognition.onend = () => {
      console.log("Recognition ended");
      setListening(false);
      setInterim("");
      isStartingRef.current = false;

      // Se deve reiniciar e ainda está ativo
      if (shouldRestartRef.current && active && !visibilityPausedRef.current) {
        console.log("Scheduling restart");
        restartTimeoutRef.current = setTimeout(() => {
          if (active && !visibilityPausedRef.current) {
            startRecognition();
          }
        }, 1500) as unknown as number;
      } else {
        setMicStatus("parado");
      }
    };

    recognition.onerror = (event: any) => {
      const error = event.error;
      console.log("Recognition error:", error);

      setListening(false);
      setInterim("");
      isStartingRef.current = false;
      errorCountRef.current++;

      if (error === "not-allowed" || error === "service-not-allowed") {
        setMicStatus("negado");
        setActive(false);
        shouldRestartRef.current = false;
        return;
      }

      if (error === "aborted") {
        console.log("Recognition aborted (normal)");
        return;
      }

      if (errorCountRef.current >= 3) {
        console.log("Too many errors, stopping");
        setMicStatus("erro");
        setActive(false);
        shouldRestartRef.current = false;
        return;
      }

      setMicStatus("erro");

      if (active && !visibilityPausedRef.current) {
        const delay = error === "network" ? 5000 : 2000;
        restartTimeoutRef.current = setTimeout(() => {
          if (active && !visibilityPausedRef.current) {
            startRecognition();
          }
        }, delay) as unknown as number;
      }
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
        setMicStatus("ouvindo");
      } else {
        setInterim("");
      }

      if (finalText) {
        const raw = finalText.trim();
        console.log("Final text:", raw);
        setLastHeard(raw);
        errorCountRef.current = 0; // Reset error count on success

        if (clearLastTimeoutRef.current) {
          clearTimeout(clearLastTimeoutRef.current);
        }
        clearLastTimeoutRef.current = setTimeout(
          () => setLastHeard(""),
          4000
        ) as unknown as number;

        const normalized = normalizeText(raw);
        onCommand(normalized, raw);
      }
    };

    recognitionRef.current = recognition;
  }, [lang, onCommand]);

  const startRecognition = () => {
    if (!canUse.current || !recognitionRef.current) {
      console.log("Recognition not available");
      return;
    }

    if (micGrantedRef.current === false) {
      console.log("Microphone permission denied");
      setMicStatus("negado");
      return;
    }

    if (isStartingRef.current || listening) {
      console.log("Already starting or listening");
      return;
    }

    if (visibilityPausedRef.current) {
      console.log("Page not visible, skipping start");
      return;
    }

    // Previne starts muito frequentes
    const now = Date.now();
    if (now - lastStartTimeRef.current < 1000) {
      console.log("Too soon since last start");
      return;
    }

    console.log("Starting recognition");
    isStartingRef.current = true;
    lastStartTimeRef.current = now;
    setMicStatus("aguardando");
    clearTimeouts();

    try {
      recognitionRef.current.start();
    } catch (error: any) {
      console.log("Error starting recognition:", error);
      isStartingRef.current = false;

      if (error.name === "InvalidStateError") {
        // Já está rodando, ajusta o estado
        console.log("Recognition already running");
        setListening(true);
        setMicStatus("ouvindo");
        return;
      }

      errorCountRef.current++;
      if (errorCountRef.current >= 3) {
        setMicStatus("erro");
        setActive(false);
      }
    }
  };

  const stopRecognition = () => {
    console.log("Stopping recognition");
    shouldRestartRef.current = false;
    clearTimeouts();

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (error) {
        console.log("Error stopping recognition:", error);
      }
    }

    setListening(false);
    setInterim("");
    isStartingRef.current = false;
  };

  // Controla start/stop baseado no estado active
  useEffect(() => {
    if (active) {
      console.log("Activating voice recognition");
      shouldRestartRef.current = true;
      errorCountRef.current = 0;

      if (
        !listening &&
        !isStartingRef.current &&
        !visibilityPausedRef.current
      ) {
        startRecognition();
      }
    } else {
      console.log("Deactivating voice recognition");
      shouldRestartRef.current = false;
      stopRecognition();
      setMicStatus("parado");
    }
  }, [active]);

  const start = () => {
    console.log("Manual start requested");
    setActive(true);
  };

  const stop = () => {
    console.log("Manual stop requested");
    setActive(false);
  };

  return {
    active,
    listening: canUse.current && listening,
    interimText,
    lastHeard,
    micStatus,
    start,
    stop,
  };
}
