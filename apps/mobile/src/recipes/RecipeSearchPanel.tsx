import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Text } from "../ui/Text";

/** Busca touch compartilhada pela lista de receitas e pela produção. */
export function RecipeSearchPanel({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const key = (label: string, action: () => void, disabled = false, wide = false) => (
    <Pressable key={label} accessibilityRole="button" accessibilityLabel={label === "⌫ Apagar" ? "Apagar última letra" : label}
      accessibilityState={{ disabled }} disabled={disabled} onPress={action}
      style={({ pressed }) => [styles.key, wide && styles.wideKey, (pressed || disabled) && { opacity: 0.45 }]}>
      <Text style={styles.keyText}>{label}</Text>
    </Pressable>
  );
  return <View style={styles.panel}>
    <Text style={styles.label}>Pesquisar receita</Text>
    <TextInput accessibilityLabel="Pesquisar receita" placeholder="Nome da receita" placeholderTextColor="#b3b3b3"
      value={value} onChangeText={onChange} showSoftInputOnFocus={false} autoCorrect={false} autoCapitalize="characters" style={styles.input} />
    <View style={styles.editKeys}>
      {key("⌫ Apagar", () => onChange(Array.from(value).slice(0, -1).join("")), !value, true)}
      {key("Limpar", () => onChange(""), !value, true)}
    </View>
    <View style={styles.alphabet}>
      {"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split("").map((letter) => key(letter, () => onChange(value + letter)))}
    </View>
    <Pressable accessibilityRole="button" onPress={() => onChange(value + " ")} style={({ pressed }) => [styles.space, pressed && { opacity: 0.45 }]}>
      <Text style={styles.keyText}>Espaço</Text>
    </Pressable>
  </View>;
}
const styles = StyleSheet.create({
  panel: { gap: 12 }, label: { color: "#fff", fontSize: 16 },
  input: { backgroundColor: "#282828", color: "#fff", borderWidth: 1, borderColor: "#444", borderRadius: 8, minHeight: 52, paddingHorizontal: 12, fontSize: 18 },
  editKeys: { flexDirection: "row", gap: 8 }, alphabet: { flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "space-between" },
  key: { width: "17%", minWidth: 44, minHeight: 48, borderWidth: 1, borderColor: "#444", backgroundColor: "#282828", borderRadius: 8, justifyContent: "center", alignItems: "center" },
  wideKey: { flex: 1, width: undefined, paddingHorizontal: 8 }, keyText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  space: { minHeight: 48, paddingHorizontal: 24, alignSelf: "center", borderRadius: 8, borderWidth: 1, borderColor: "#444", backgroundColor: "#282828", alignItems: "center", justifyContent: "center" },
});
