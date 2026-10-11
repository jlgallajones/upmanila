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

const COLORS = {
  cyan: "#00838F",
  cyanSoft: "#E0F7FA",
  ink: "#000000",
  muted: "#6B6B6B",
  border: "#E6E6E6",
  white: "#FFFFFF",
  background: "#FAFAFA",
};

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
  return (
    <View style={styles.screen}>
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.backButtonPressed,
            ]}
          >
            <Ionicons
              name="chevron-back"
              size={20}
              color={COLORS.cyan}
            />
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>

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
        <Text style={styles.intro}>{intro}</Text>

        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>

            {section.body ? (
              <Text style={styles.bodyText}>{section.body}</Text>
            ) : null}

            {section.bullets?.map((item) => (
              <View key={item} style={styles.bulletRow}>
                <View style={styles.bulletDot} />
                <Text style={styles.bodyText}>{item}</Text>
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
    backgroundColor: COLORS.background,
  },
  headerSafeArea: {
    backgroundColor: COLORS.cyan,
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
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
    marginBottom: 18,
  },
  backButtonPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.98 }],
  },
  backButtonText: {
    color: COLORS.cyan,
    fontSize: 13,
    fontWeight: "900",
  },
  headerTitle: {
    color: COLORS.white,
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
    color: COLORS.ink,
    fontSize: 15,
    lineHeight: 23,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    padding: 16,
  },
  section: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    padding: 16,
    marginTop: 14,
  },
  sectionTitle: {
    color: COLORS.ink,
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 9,
  },
  bodyText: {
    flex: 1,
    color: COLORS.muted,
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
    backgroundColor: COLORS.cyan,
    marginTop: 8,
  },
});
