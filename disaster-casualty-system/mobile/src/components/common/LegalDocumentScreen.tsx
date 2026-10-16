import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import ThemeToggleButton from "../theme-toggle-button";
import { useThemeMode } from "../../theme/theme-mode";

type LegalSection = {
  title: string;
  body?: string;
  bullets?: string[];
};

type LegalDocumentScreenProps = {
  title: string;
  updatedAt: string;
  intro: string;
  sections: LegalSection[];
};

export default function LegalDocumentScreen({
  title,
  updatedAt,
  intro,
  sections,
}: LegalDocumentScreenProps) {
  const { colors, isDark } = useThemeMode();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <SafeAreaView
        edges={["top"]}
        style={[
          styles.headerSafeArea,
          { backgroundColor: isDark ? colors.background : colors.primary },
        ]}
      >
        <View
          style={[
            styles.header,
            { backgroundColor: isDark ? colors.background : colors.primary },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              {
                backgroundColor: colors.surface,
              },
              pressed && styles.backButtonPressed,
            ]}
          >
            <Ionicons
              name="chevron-back"
              size={20}
              color={colors.primary}
            />
            <Text style={[styles.backButtonText, { color: colors.primary }]}>Back</Text>
          </Pressable>

          <View style={styles.themeToggleSlot}>
            <ThemeToggleButton compact inverted />
          </View>

          <Text style={styles.headerTitle}>{title}</Text>
          <Text style={styles.headerSubtitle}>
            Draft operational notice. Last updated: {updatedAt}.
          </Text>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={[
            styles.intro,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              color: colors.text,
            },
          ]}
        >
          {intro}
        </Text>

        {sections.map((section) => (
          <View
            key={section.title}
            style={[
              styles.section,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {section.title}
            </Text>

            {section.body ? (
              <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
                {section.body}
              </Text>
            ) : null}

            {section.bullets?.map((item) => (
              <View key={item} style={styles.bulletRow}>
                <View
                  style={[
                    styles.bulletDot,
                    {
                      backgroundColor: colors.primary,
                    },
                  ]}
                />
                <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
                  {item}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  headerSafeArea: {
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 22,
    paddingTop: 12,
  },
  backButton: {
    minHeight: 38,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    paddingHorizontal: 12,
    marginBottom: 18,
  },
  themeToggleSlot: {
    position: "absolute",
    top: 12,
    right: 20,
    zIndex: 2,
  },
  backButtonPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.98 }],
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: "900",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 31,
    lineHeight: 36,
    fontWeight: "900",
    letterSpacing: 0,
  },
  headerSubtitle: {
    color: "rgba(255, 255, 255, 0.78)",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 34,
    paddingTop: 20,
  },
  intro: {
    fontSize: 15,
    lineHeight: 23,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  section: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginTop: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 9,
  },
  bodyText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 8,
  },
  bulletDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    marginTop: 8,
  },
});
