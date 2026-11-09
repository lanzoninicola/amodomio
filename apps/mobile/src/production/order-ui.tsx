import { useEffect, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, Animated, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { Text } from "../ui/Text";
import { formatProductionQuantity } from "../../../../shared/production/order-plan";
import type { ProductionPlan, OrderStatus } from "./order-types";

export const colors = { bg: "#101010", panel: "#282828", raised: "#333333", line: "#444444", text: "#ffffff", muted: "#b3b3b3", yellow: "#fdbc12", green: "#aec355", red: "#ff8d86" };
export const statusLabels: Record<OrderStatus, string> = { planned: "Planejada", in_progress: "Em produção", finished: "Concluída", cancelled: "Cancelada" };
export const statusColors: Record<OrderStatus, string> = { planned: colors.muted, in_progress: "#ee8043", finished: colors.green, cancelled: colors.muted };
export const stepColors = ["#fdbc12", "#bf9bd6", "#6dcbd1", "#ee8043"];
export const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
export const numeric = (value: string) => Number(value.trim().replace(",", "."));
export const qty = (value: number, unit: string) => {
  const formatted = formatProductionQuantity(value, unit);
  return `${formatted.value} ${formatted.unit}`;
};
export function dayKey(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function shiftDay(value: string, amount: number) {
  const date = new Date(`${value}T12:00:00-03:00`);
  date.setUTCDate(date.getUTCDate() + amount);
  return dayKey(date);
}
/** "Hoje", "Amanhã", "Ontem" ou "qua., 04/11/2026". */
export function relativeDay(value: string) {
  const today = dayKey();
  if (value === today) return "Hoje";
  if (value === shiftDay(today, 1)) return "Amanhã";
  if (value === shiftDay(today, -1)) return "Ontem";
  const weekday = new Date(`${value}T12:00:00-03:00`).toLocaleDateString("pt-BR", { weekday: "short", timeZone: "America/Sao_Paulo" });
  return `${weekday} ${labelDay(value)}`;
}
export function weekdayName(value: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00-03:00`).toLocaleDateString("pt-BR", { weekday: "long", timeZone: "America/Sao_Paulo" });
}
export const labelDay = (value: string) => `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`;

/** Shared short transitions respect the device's reduced-motion preference. */
export function FadeContent({ children, changeKey }: { children: ReactNode; changeKey: string }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (active) setReduceMotion(value); });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    opacity.stopAnimation();
    if (reduceMotion) { opacity.setValue(1); return; }
    opacity.setValue(0.35);
    const animation = Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [changeKey, reduceMotion, opacity]);
  return <Animated.View style={{ opacity, gap: 16 }}>{children}</Animated.View>;
}
export function Workflow({ phase }: { phase: number }) {
  return <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 12 }}>
    {["Dados", "Preparações", "Produção", "Conclusão"].map((label, index) => <View key={label} style={{ flex: 1, gap: 6 }}>
      <View style={{ height: 3, borderRadius: 2, backgroundColor: index < phase ? colors.green : index === phase ? colors.yellow : colors.line }} />
      <Text accessibilityLabel={`${label}${index === phase ? ", fase atual" : index < phase ? ", concluída" : ""}`} style={{ color: index === phase ? colors.text : colors.muted, fontSize: 11, fontWeight: index === phase ? "700" : "400" }}>{index < phase ? "✓ " : ""}{label}</Text>
    </View>)}
  </View>;
}
export function Progress({ done, total }: { done: number; total: number }) {
  return <View accessible accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total || 1, now: done, text: `${done} de ${total} etapas concluídas` }} style={{ gap: 8 }}>
    <Text style={s.hint}>{done} de {total} etapas concluídas</Text>
    <View style={{ height: 5, backgroundColor: colors.line, borderRadius: 4, overflow: "hidden" }}><View style={{ height: 5, width: `${total ? done / total * 100 : 0}%`, backgroundColor: colors.green }} /></View>
  </View>;
}
export function Action({ label, onPress, disabled, secondary, danger, compact }: {
  label: string; onPress: () => void; disabled?: boolean; secondary?: boolean; danger?: boolean; compact?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: Boolean(disabled) }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [s.action, compact && s.compactAction, secondary ? s.secondaryAction : s.primaryAction, (pressed || disabled) && s.dim]}>
    <Text style={[s.actionText, secondary ? { color: danger ? colors.red : colors.text } : { color: colors.bg }]}>{label}</Text>
  </Pressable>;
}
export function Field({ label, ...props }: TextInputProps & { label?: string }) {
  return <View style={s.field}>{label ? <Text style={s.label}>{label}</Text> : null}<TextInput placeholderTextColor={colors.muted} {...props} style={[s.input, props.style]} /></View>;
}
export function Panel({ children }: { children: ReactNode }) { return <View style={s.panel}>{children}</View>; }
export function Sheet({ title, children, onClose, footer, maxWidth = 740 }: { title: string; children: ReactNode; onClose: () => void; footer?: ReactNode; maxWidth?: number }) {
  return <Modal transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
    <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fechar janela" />
      <View style={[s.sheet, { maxWidth }]} accessibilityViewIsModal>
        <View style={s.sheetHeader}><Text accessibilityRole="header" style={s.sectionTitle}>{title}</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar janela" hitSlop={4} style={s.close}><Text style={s.closeText}>×</Text></Pressable>
        </View>
        <View style={s.sheetBody}>{children}</View>
        {footer ? <View style={s.footer}>{footer}</View> : null}
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
export function Lines({ lines }: { lines: ProductionPlan["totals"] }) {
  return <View>{lines.map((line) => <View key={line.id} style={s.ingredient}>
    <Text style={s.ingredientName}>{line.name}</Text><Text style={s.ingredientQuantity}>{qty(line.quantity, line.unit)}</Text>
  </View>)}{!lines.length ? <Text style={s.hint}>Nenhum ingrediente a acrescentar.</Text> : null}</View>;
}
export function Plan({ plan }: { plan: ProductionPlan }) {
  return <View style={s.stack}>
    {plan.preparations.map((preparation, index) => <View key={preparation.id} style={[s.panel, { borderLeftWidth: 4, borderLeftColor: stepColors[index % stepColors.length] }]}>
      <Text style={s.sectionTitle}>{preparation.name}</Text><Lines lines={preparation.ingredients} />
      {preparation.notes ? <Text style={s.hint}>{preparation.notes}</Text> : null}
    </View>)}
    <Panel><Text style={s.sectionTitle}>Mistura final</Text>
      {plan.final.preparedItems.map((name, index) => <Text key={`${index}:${name}`} style={s.prepared}>+ {name} preparado</Text>)}
      <Lines lines={plan.final.ingredients} />
    </Panel>
  </View>;
}
export function Empty({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return <View style={s.empty}><Text style={s.sectionTitle}>{title}</Text><Text style={s.hint}>{description}</Text>{children}</View>;
}
export function ErrorNotice({ message }: { message: string }) {
  return message ? <View accessibilityRole="alert" style={s.error}><Text style={{ color: colors.red, fontSize: 16 }}>{message}</Text></View> : null;
}
export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg }, header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderColor: colors.line },
  headerCopy: { flex: 1, minWidth: 0 }, eyebrow: { color: colors.yellow, fontSize: 11, letterSpacing: 1.5 }, title: { color: colors.text, fontSize: 24, fontWeight: "700" },
  sectionTitle: { color: colors.text, fontSize: 21, fontWeight: "700", flexShrink: 1 }, label: { color: colors.text, fontSize: 16 }, hint: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  stack: { gap: 16 }, row: { flexDirection: "row", alignItems: "center", gap: 12 }, flex: { flex: 1, minWidth: 0 }, body: { flex: 1, minHeight: 0 },
  scroll: { padding: 16, gap: 16, paddingBottom: 28 }, panel: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 20, gap: 12 },
  input: { fontFamily: "IBMPlexMono_Regular", color: colors.text, backgroundColor: colors.bg, borderColor: colors.line, borderWidth: 1, borderRadius: 8, minHeight: 56, fontSize: 20, paddingHorizontal: 16, paddingVertical: 12 },
  field: { gap: 8, width: "100%", maxWidth: 440 }, action: { alignSelf: "flex-start", flexShrink: 1, maxWidth: "100%", minHeight: 64, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  compactAction: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 10 }, primaryAction: { backgroundColor: colors.yellow }, secondaryAction: { backgroundColor: colors.raised, borderColor: colors.line, borderWidth: 1 },
  actionText: { fontSize: 18, fontWeight: "700", textAlign: "center" }, dim: { opacity: 0.45 }, footer: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center", padding: 16, gap: 10, borderTopWidth: 1, borderColor: colors.line, backgroundColor: colors.panel },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", padding: 16, justifyContent: "center", alignItems: "center" },
  sheet: { width: "100%", maxWidth: 740, maxHeight: "94%", backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, borderRadius: 14, overflow: "hidden", flexShrink: 1 },
  sheetHeader: { flexDirection: "row", gap: 12, justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderColor: colors.line },
  sheetBody: { flexShrink: 1, minHeight: 0 }, close: { width: 48, height: 48, alignItems: "center", justifyContent: "center", backgroundColor: colors.raised, borderRadius: 8 }, closeText: { color: colors.text, fontSize: 30 },
  ingredient: { flexDirection: "row", gap: 16, alignItems: "center", paddingVertical: 16, borderBottomWidth: 1, borderColor: colors.line },
  ingredientName: { flex: 1, color: colors.text, fontSize: 19 }, ingredientQuantity: { flexShrink: 0, color: colors.yellow, fontSize: 25, fontWeight: "700" },
  prepared: { color: colors.green, fontSize: 19, paddingVertical: 6 }, empty: { alignItems: "center", justifyContent: "center", padding: 32, gap: 14 },
  error: { margin: 12, padding: 14, backgroundColor: "#3c2323", borderWidth: 1, borderColor: "#81413c", borderRadius: 8 },
  badge: { alignSelf: "flex-start", fontSize: 13, fontWeight: "700", paddingVertical: 6, paddingHorizontal: 10, borderRadius: 5, backgroundColor: colors.bg },
});
