import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "../ui/Text";
import { colors, s, Sheet } from "./order-ui";

type Op = "+" | "−" | "×" | "÷";
const ROWS: string[][] = [
  ["C", "⌫", "%", "÷"],
  ["7", "8", "9", "×"],
  ["4", "5", "6", "−"],
  ["1", "2", "3", "+"],
  ["0", ",", "="],
];

function apply(a: number, b: number, op: Op) {
  if (op === "+") return a + b;
  if (op === "−") return a - b;
  if (op === "×") return a * b;
  return b === 0 ? NaN : a / b;
}
const show = (n: number) => Number.isFinite(n) ? String(Number(n.toPrecision(12))).replace(".", ",") : "Erro";

/** Calculadora simples, em janela, para as contas rápidas da produção. */
export function CalculatorSheet({ onClose }: { onClose: () => void }) {
  const [display, setDisplay] = useState("0");
  const [stored, setStored] = useState<number | null>(null);
  const [op, setOp] = useState<Op | null>(null);
  const [fresh, setFresh] = useState(true);
  const [copied, setCopied] = useState<"ok" | "error" | null>(null);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 1800);
    return () => clearTimeout(timer);
  }, [copied]);
  const value = () => Number(display.replace(",", "."));

  async function copy() {
    if (display === "Erro") return;
    try {
      // Carregado sob demanda: em um APK antigo sem o módulo nativo, só o botão falha.
      const Clipboard = require("expo-clipboard") as typeof import("expo-clipboard");
      await Clipboard.setStringAsync(display);
      setCopied("ok");
    } catch { setCopied("error"); }
  }

  function press(key: string) {
    if (/^\d$/.test(key)) { setDisplay(fresh || display === "0" ? key : display + key); setFresh(false); return; }
    if (key === ",") { if (fresh) { setDisplay("0,"); setFresh(false); } else if (!display.includes(",")) setDisplay(display + ","); return; }
    if (key === "C") { setDisplay("0"); setStored(null); setOp(null); setFresh(true); return; }
    if (key === "⌫") { if (!fresh) setDisplay(display.length > 1 ? display.slice(0, -1) : "0"); return; }
    if (key === "%") {
      // 1500 × 45 % = 675; 1500 + 10 % = 1650 (percentual sobre o valor anterior).
      const base = stored !== null && (op === "+" || op === "−") ? (stored * value()) / 100 : value() / 100;
      setDisplay(show(base)); setFresh(false); return;
    }
    const result = stored !== null && op && !fresh ? apply(stored, value(), op) : value();
    if (key === "=") { setDisplay(show(result)); setStored(null); setOp(null); setFresh(true); return; }
    setDisplay(show(result)); setStored(result); setOp(key as Op); setFresh(true);
  }
  return <Sheet title="Calculadora" maxWidth={420} onClose={onClose}>
    <View style={{ padding: 16, gap: 12 }}>
      <View style={{ backgroundColor: colors.bg, borderRadius: 10, padding: 16, minHeight: 88, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={copied === "ok" ? "Valor copiado" : copied === "error" ? "Não foi possível copiar" : `Copiar ${display}`}
          disabled={display === "Erro"} onPress={() => void copy()} style={[s.close, display === "Erro" && s.dim]}>
          <Text style={[s.closeText, { color: copied === "ok" ? colors.green : copied === "error" ? colors.red : colors.text }]}>{copied === "ok" ? "✓" : copied === "error" ? "!" : "⧉"}</Text>
        </Pressable>
        <View style={{ flex: 1, alignItems: "flex-end", justifyContent: "center" }}>
          <Text style={s.hint}>{stored !== null && op ? `${show(stored)} ${op}` : " "}</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit accessibilityLiveRegion="polite" style={{ color: colors.yellow, fontSize: 44, fontWeight: "700" }}>{display}</Text>
        </View>
      </View>
      {ROWS.map((row, r) => <View key={r} style={{ flexDirection: "row", gap: 8 }}>
        {row.map((key) => {
          const operator = ["÷", "×", "−", "+", "="].includes(key);
          return <Pressable key={key} accessibilityRole="button" accessibilityLabel={key === "⌫" ? "Apagar" : key === "C" ? "Limpar" : key} onPress={() => press(key)}
            style={({ pressed }) => [s.action, { flex: 1, minHeight: 68, backgroundColor: operator ? colors.yellow : colors.raised }, pressed && s.dim]}>
            <Text style={[s.actionText, { fontSize: 26, color: operator ? colors.bg : colors.text }]}>{key}</Text>
          </Pressable>;
        })}
      </View>)}
    </View>
  </Sheet>;
}
