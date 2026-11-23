import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View, useWindowDimensions } from "react-native";
import { StatusBar } from "expo-status-bar";
import { ApiError, getLabels, submitLabel } from "../api/client";
import { Screen } from "../ui/Screen";
import { IconButton } from "../ui/IconButton";
import { KdsTypographyContext, Text } from "../ui/Text";
import { printFoodLabel } from "./qz-print";
import { shelfLifeLabel, type FoodLabelRecord, type LabelingItem, type LabelingSettings } from "../../../../shared/labeling/food-label";

const colors = { bg: "#101114", panel: "#1b1d22", raised: "#272a31", line: "#3a3d45", text: "#f8fafc", muted: "#a5a9b2", yellow: "#f5c518", green: "#22c55e", red: "#ef4444" };

export function LabelsScreen({ apiUrl, token, onBack, onUnauthorized }: {
  apiUrl: string; token: string; onBack: () => void; onUnauthorized: () => void;
}) {
  const { width } = useWindowDimensions();
  const [items, setItems] = useState<LabelingItem[]>([]);
  const [labels, setLabels] = useState<FoodLabelRecord[]>([]);
  const [settings, setSettings] = useState<LabelingSettings | null>(null);
  const [query, setQuery] = useState("");
  const [copies, setCopies] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const columns = width >= 1050 ? 3 : width >= 650 ? 2 : 1;
  const filtered = useMemo(() => items.filter((item) => item.name.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))), [items, query]);

  async function load() {
    try {
      const data = await getLabels(apiUrl, token);
      setItems(data.items); setLabels(data.labels); setSettings(data.settings); setError("");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onUnauthorized();
      else setError(e instanceof Error ? e.message : "Não foi possível carregar as etiquetas.");
    }
  }
  useEffect(() => { void load(); }, [apiUrl, token]);

  async function createAndPrint(item: LabelingItem) {
    if (busy) return;
    setBusy(true); setError(""); setMessage(`Preparando ${item.name}...`);
    let created: FoodLabelRecord | null = null;
    try {
      const response = await submitLabel(apiUrl, token, { intent: "create", itemId: item.id, copies });
      created = response.label;
      const printSettings = response.settings || settings;
      if (!printSettings) throw new Error("Configuração da impressora não carregada.");
      setLabels((current) => [created!, ...current]);
      setMessage(`Enviando para ${printSettings.printerName}...`);
      await printFoodLabel(created, printSettings);
      await submitLabel(apiUrl, token, { intent: "print-result", id: created.id, printed: true });
      setLabels((current) => current.map((row) => row.id === created!.id ? { ...row, printStatus: "printed" } : row));
      setMessage("Etiqueta impressa.");
    } catch (e) {
      const text = e instanceof Error ? e.message : String(e);
      if (created) {
        try { await submitLabel(apiUrl, token, { intent: "print-result", id: created.id, printed: false, error: text }); } catch {}
        setLabels((current) => current.map((row) => row.id === created!.id ? { ...row, printStatus: "failed", printError: text } : row));
      }
      if (e instanceof ApiError && e.status === 401) onUnauthorized();
      else setError(`Não foi possível imprimir. ${text}`);
      setMessage("");
    } finally { setBusy(false); }
  }

  return <KdsTypographyContext.Provider value={true}><Screen style={s.screen}><StatusBar style="light" />
    <View style={s.header}><IconButton icon="previous" label="Voltar" onPress={onBack} disabled={busy} /><View style={{ flex: 1 }}><Text style={s.eyebrow}>COZINHA</Text><Text style={s.title}>Etiquetas</Text></View><IconButton icon="refresh" label="Atualizar" onPress={() => void load()} disabled={busy} /></View>
    <View style={s.toolbar}><TextInput value={query} onChangeText={setQuery} placeholder="Buscar produto" placeholderTextColor={colors.muted} style={s.search} />
      <View style={s.counter}><Pressable onPress={() => setCopies(Math.max(1, copies - 1))} style={s.counterButton}><Text style={s.counterText}>−</Text></Pressable><Text style={s.copies}>{copies} via{copies > 1 ? "s" : ""}</Text><Pressable onPress={() => setCopies(Math.min(20, copies + 1))} style={s.counterButton}><Text style={s.counterText}>+</Text></Pressable></View>
    </View>
    {error ? <Text style={s.error}>{error}</Text> : null}{message ? <Text style={s.success}>{message}</Text> : null}
    {!settings && !error ? <ActivityIndicator color={colors.yellow} style={{ margin: 30 }} /> : null}
    <FlatList key={columns} numColumns={columns} data={filtered} keyExtractor={(item) => item.id} contentContainerStyle={s.list} columnWrapperStyle={columns > 1 ? { gap: 14 } : undefined}
      ListEmptyComponent={settings ? <Text style={s.empty}>Nenhum item habilitado. Configure a aba Etiquetas no cadastro do item.</Text> : null}
      renderItem={({ item }) => <Pressable disabled={busy} onPress={() => void createAndPrint(item)} style={({ pressed }) => [s.card, { maxWidth: `${100 / columns}%` }, (pressed || busy) && { opacity: .65 }]}><Text style={s.cardTitle}>{item.LabelingConfig.labelName || item.name}</Text><Text style={s.cardMeta}>Validade: {shelfLifeLabel(item.LabelingConfig.shelfLifeMinutes)}</Text><Text style={s.cardMeta}>{item.LabelingConfig.conservation}</Text><Text style={s.print}>IMPRIMIR →</Text></Pressable>} />
    {labels.length ? <View style={s.footer}><Text style={s.footerText}>Última: {labels[0].itemName} · {labels[0].printStatus === "printed" ? "impressa" : labels[0].printStatus === "failed" ? "falhou" : "enviando"}</Text></View> : null}
  </Screen></KdsTypographyContext.Provider>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg }, header: { minHeight: 82, padding: 14, flexDirection: "row", alignItems: "center", gap: 16, borderBottomWidth: 1, borderColor: colors.line },
  eyebrow: { color: colors.yellow, fontSize: 12, fontWeight: "700" }, title: { color: colors.text, fontSize: 28, fontWeight: "800" }, toolbar: { flexDirection: "row", flexWrap: "wrap", gap: 12, padding: 14 },
  search: { flex: 1, minWidth: 240, minHeight: 54, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, color: colors.text, paddingHorizontal: 16, fontSize: 18 },
  counter: { flexDirection: "row", alignItems: "center", gap: 10 }, counterButton: { width: 54, height: 54, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: colors.raised }, counterText: { color: colors.text, fontSize: 28 }, copies: { color: colors.text, minWidth: 80, textAlign: "center", fontWeight: "700" },
  error: { color: "white", backgroundColor: colors.red, padding: 12, marginHorizontal: 14, borderRadius: 8 }, success: { color: colors.bg, backgroundColor: colors.green, padding: 12, marginHorizontal: 14, borderRadius: 8, fontWeight: "700" },
  list: { padding: 14, gap: 14, flexGrow: 1 }, card: { flex: 1, minHeight: 160, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, padding: 18, marginBottom: 14 },
  cardTitle: { color: colors.text, fontSize: 22, fontWeight: "800" }, cardMeta: { color: colors.muted, fontSize: 15, marginTop: 7 }, print: { color: colors.yellow, fontSize: 16, fontWeight: "800", marginTop: "auto" }, empty: { color: colors.muted, textAlign: "center", marginTop: 50, fontSize: 17 },
  footer: { borderTopWidth: 1, borderColor: colors.line, padding: 12 }, footerText: { color: colors.muted, textAlign: "center" },
});
