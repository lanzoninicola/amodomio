import { forwardRef, useState } from "react";
import {
  StyleSheet,
  Pressable,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { theme } from "./theme";

export const Input = forwardRef<
  TextInput,
  TextInputProps & { label?: string; error?: string }
>(function Input({ label, error, style, secureTextEntry, ...props }, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.group}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View>
        <TextInput
          ref={ref}
          placeholderTextColor={theme.colors.ring}
          style={[
            styles.input,
            secureTextEntry && { paddingRight: 88 },
            error && styles.invalid,
            style,
          ]}
          secureTextEntry={secureTextEntry && !visible}
          {...props}
        />
        {secureTextEntry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={visible ? "Ocultar senha" : "Mostrar senha"}
            onPress={() => setVisible((value) => !value)}
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              bottom: 0,
              justifyContent: "center",
              paddingHorizontal: 12,
            }}
          >
            <Text style={styles.label}>{visible ? "Ocultar" : "Mostrar"}</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  group: { gap: 7 },
  label: {
    color: theme.colors.foreground,
    fontFamily: theme.typography.medium,
    fontSize: 14,
  },
  input: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: theme.colors.input,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: theme.colors.foreground,
    fontFamily: theme.typography.regular,
    fontSize: 14,
  },
  invalid: { borderColor: theme.colors.destructive },
  error: {
    color: theme.colors.destructive,
    fontFamily: theme.typography.regular,
    fontSize: 12,
  },
});
