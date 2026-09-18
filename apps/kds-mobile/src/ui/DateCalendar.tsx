import { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "./Button";
import { theme } from "./theme";

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

export function DateCalendar({
  value,
  onSelect,
  onClose,
}: {
  value: string;
  onSelect: (date: string) => void;
  onClose: () => void;
}) {
  const [month, setMonth] = useState(
    () => new Date(`${value.slice(0, 7)}-01T12:00:00`)
  );
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const offset = month.getDay();
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const today = dateKey(new Date());
  const cells = Math.ceil((offset + days) / 7) * 7;
  return (
    <Modal
      transparent
      animationType="fade"
      onRequestClose={onClose}
      supportedOrientations={["portrait", "landscape-left", "landscape-right"]}
    >
      <SafeAreaView style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.title}>Selecionar dia</Text>
            <View style={styles.navigation}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Mês anterior"
                style={styles.arrow}
                onPress={() => setMonth(new Date(year, monthIndex - 1, 1, 12))}
              >
                <Text style={styles.title}>‹</Text>
              </Pressable>
              <Text style={styles.month}>
                {month.toLocaleDateString("pt-BR", {
                  month: "long",
                  year: "numeric",
                })}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Próximo mês"
                style={styles.arrow}
                onPress={() => setMonth(new Date(year, monthIndex + 1, 1, 12))}
              >
                <Text style={styles.title}>›</Text>
              </Pressable>
            </View>
            <View style={styles.grid}>
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
                <Text key={day} style={styles.weekday}>
                  {day}
                </Text>
              ))}
              {Array.from({ length: cells }, (_, index) => {
                const day = index - offset + 1;
                if (day < 1 || day > days)
                  return <View key={index} style={styles.day} />;
                const key = dateKey(new Date(year, monthIndex, day, 12));
                return (
                  <Pressable
                    key={index}
                    accessibilityRole="button"
                    accessibilityLabel={`${day} de ${month.toLocaleDateString(
                      "pt-BR",
                      { month: "long", year: "numeric" }
                    )}`}
                    accessibilityState={{ selected: key === value }}
                    onPress={() => onSelect(key)}
                    style={[
                      styles.day,
                      key === today && styles.today,
                      key === value && styles.selected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        key === value && styles.selectedText,
                      ]}
                    >
                      {day}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.navigation}>
              <Button variant="outline" onPress={() => onSelect(today)}>
                Hoje
              </Button>
              <Button variant="ghost" onPress={onClose}>
                Cancelar
              </Button>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.62)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 390,
    maxHeight: "100%",
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    overflow: "hidden",
  },
  content: { padding: 16, gap: 12 },
  title: {
    color: theme.colors.foreground,
    fontFamily: theme.typography.bold,
    fontSize: 20,
  },
  navigation: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  arrow: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  month: {
    flex: 1,
    textAlign: "center",
    color: theme.colors.foreground,
    fontFamily: theme.typography.semibold,
    textTransform: "capitalize",
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  weekday: {
    width: "14.285714%",
    textAlign: "center",
    color: theme.colors.mutedForeground,
    fontSize: 12,
    paddingVertical: 8,
  },
  day: {
    width: "14.285714%",
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  today: { borderColor: theme.colors.primary },
  selected: { backgroundColor: theme.colors.primary },
  dayText: {
    color: theme.colors.foreground,
    fontFamily: theme.typography.medium,
    fontSize: 15,
  },
  selectedText: { color: theme.colors.primaryForeground },
});
