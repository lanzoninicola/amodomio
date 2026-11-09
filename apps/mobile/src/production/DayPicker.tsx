import { useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "../ui/Text";
import { Action, colors, dayKey, s, Sheet } from "./order-ui";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];
const pad = (n: number) => String(n).padStart(2, "0");

/** Calendário mensal para escolher o dia da lista de produções. */
export function DayPicker({ value, onChange, onClose }: { value: string; onChange: (day: string) => void; onClose: () => void }) {
  const [cursor, setCursor] = useState({ year: Number(value.slice(0, 4)), month: Number(value.slice(5, 7)) - 1 });
  const today = dayKey();
  const first = new Date(cursor.year, cursor.month, 1).getDay();
  const days = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const move = (amount: number) => setCursor(({ year, month }) => {
    const d = new Date(year, month + amount, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  return <Sheet title="Escolher o dia" maxWidth={440} onClose={onClose}>
    <View style={{ padding: 16, gap: 12 }}>
      <View style={[s.row, { justifyContent: "space-between" }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Mês anterior" onPress={() => move(-1)} style={s.close}><Text style={s.closeText}>‹</Text></Pressable>
        <Text style={s.label}>{MONTHS[cursor.month]} {cursor.year}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Próximo mês" onPress={() => move(1)} style={s.close}><Text style={s.closeText}>›</Text></Pressable>
      </View>
      <View style={{ flexDirection: "row" }}>{WEEKDAYS.map((d, i) => <Text key={i} style={[s.hint, { flex: 1, textAlign: "center" }]}>{d}</Text>)}</View>
      {Array.from({ length: cells.length / 7 }, (_, row) => <View key={row} style={{ flexDirection: "row", gap: 4 }}>
        {cells.slice(row * 7, row * 7 + 7).map((day, i) => {
          if (!day) return <View key={i} style={{ flex: 1 }} />;
          const key = `${cursor.year}-${pad(cursor.month + 1)}-${pad(day)}`;
          const selected = key === value;
          return <Pressable key={i} accessibilityRole="button" accessibilityLabel={`Dia ${day}`} accessibilityState={{ selected }} onPress={() => { onChange(key); onClose(); }}
            style={({ pressed }) => [{ flex: 1, minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: 10, borderWidth: 1,
              borderColor: key === today ? colors.yellow : "transparent", backgroundColor: selected ? colors.yellow : colors.panel }, pressed && s.dim]}>
            <Text style={{ color: selected ? colors.bg : colors.text, fontSize: 18, fontWeight: selected || key === today ? "700" : "400" }}>{day}</Text>
          </Pressable>;
        })}
      </View>)}
      <Action secondary compact label="Ir para hoje" onPress={() => { onChange(today); onClose(); }} />
    </View>
  </Sheet>;
}
