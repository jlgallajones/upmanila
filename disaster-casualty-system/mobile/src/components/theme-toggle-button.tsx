import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text } from "react-native";

import { useThemeMode } from "@/theme/theme-mode";

type ThemeToggleButtonProps = {
  compact?: boolean;
  inverted?: boolean;
};

export default function ThemeToggleButton({
  compact = false,
  inverted = false,
}: ThemeToggleButtonProps) {
  const { colors, isDark, toggleTheme } = useThemeMode();

  const foregroundColor = inverted
    ? isDark
      ? colors.primary
      : colors.primaryDark
    : colors.primary;
  const backgroundColor = colors.surface;
  const borderColor = colors.selectedBorder;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Switch to ${isDark ? "light" : "dark"} mode`}
      onPress={toggleTheme}
      style={({ pressed }) => [
        styles.button,
        compact && styles.compact,
        {
          backgroundColor,
          borderColor,
          opacity: pressed ? 0.82 : 1,
        },
      ]}
    >
      <Ionicons
        name={isDark ? "sunny-outline" : "moon-outline"}
        size={compact ? 15 : 17}
        color={foregroundColor}
      />
      {!compact ? (
        <Text
          style={[
            styles.label,
            {
              color: foregroundColor,
            },
          ]}
        >
          {isDark ? "Light" : "Dark"}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 13,
  },
  compact: {
    width: 38,
    minHeight: 38,
    paddingHorizontal: 0,
  },
  label: {
    fontSize: 12,
    fontWeight: "900",
  },
});
