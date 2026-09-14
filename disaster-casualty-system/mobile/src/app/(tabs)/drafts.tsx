import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  deleteLocalFormDraft,
  getLocalFormDrafts,
  type LocalFormDraft,
} from "../../offline/formDrafts";

const COLORS = {
  maroon: "#7B1113",
  text: "#17213A",
  muted: "#69758C",
  border: "#DCE3EE",
  background: "#F7F9FC",
  white: "#FFFFFF",
  red: "#C92D32",
};

function formatDraftDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return date.toLocaleString();
}

function draftTypeLabel(formType: string): string {
  switch (formType) {
    case "casualty":
      return "Casualty";
    default:
      return formType.replace(/_/g, " ");
  }
}

export default function DraftsScreen() {
  const [drafts, setDrafts] = useState<LocalFormDraft[]>([]);

  const loadDrafts = useCallback(async () => {
    setDrafts(await getLocalFormDrafts());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadDrafts();
    }, [loadDrafts]),
  );

  async function handleDeleteDraft(draft: LocalFormDraft) {
    Alert.alert(
      "Delete draft?",
      "This removes the saved draft from this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteLocalFormDraft(draft.id);
            await loadDrafts();
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Local Drafts</Text>
        <Text style={styles.title}>Drafts</Text>
        <Text style={styles.subtitle}>
          Saved forms stay on this device until submitted or deleted.
        </Text>
      </View>

      <FlatList
        data={drafts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons
              name="document-text-outline"
              size={30}
              color={COLORS.muted}
            />
            <Text style={styles.emptyTitle}>No drafts yet</Text>
            <Text style={styles.emptyText}>
              Use Save Draft while adding a casualty to store unfinished work.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIcon}>
                <Ionicons
                  name="document-outline"
                  size={20}
                  color={COLORS.maroon}
                />
              </View>
              <View style={styles.cardTitleGroup}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardMeta}>
                  {draftTypeLabel(item.formType)} - {formatDraftDate(item.updatedAt)}
                </Text>
              </View>
            </View>

            <View style={styles.actions}>
              <Pressable
                onPress={() => {
                  if (item.formType === "casualty") {
                    router.push({
                      pathname: "/(tabs)/add-casualty",
                      params: { draftId: item.id },
                    });
                  }
                }}
                style={({ pressed }) => [
                  styles.resumeButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.resumeText}>Resume</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  void handleDeleteDraft(item);
                }}
                style={({ pressed }) => [
                  styles.deleteButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.deleteText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    padding: 22,
    backgroundColor: COLORS.maroon,
  },
  eyebrow: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    marginTop: 8,
    color: COLORS.white,
    fontSize: 30,
    fontWeight: "900",
  },
  subtitle: {
    marginTop: 7,
    color: "rgba(255,255,255,0.76)",
    fontSize: 13,
    lineHeight: 19,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  emptyState: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    borderRadius: 14,
    backgroundColor: COLORS.white,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "900",
  },
  emptyText: {
    color: COLORS.muted,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },
  card: {
    gap: 14,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    backgroundColor: COLORS.white,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#FFF4F4",
  },
  cardTitleGroup: {
    flex: 1,
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "900",
  },
  cardMeta: {
    marginTop: 4,
    color: COLORS.muted,
    fontSize: 12,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  resumeButton: {
    flex: 1,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: COLORS.maroon,
  },
  resumeText: {
    color: COLORS.white,
    fontWeight: "900",
  },
  deleteButton: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#F0C5C5",
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: "#FFF4F4",
  },
  deleteText: {
    color: COLORS.red,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.72,
  },
});

