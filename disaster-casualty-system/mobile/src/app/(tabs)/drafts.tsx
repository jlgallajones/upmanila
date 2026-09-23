import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  FlatList,
  Modal,
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
      return "Victim";
    default:
      return formType.replace(/_/g, " ");
  }
}

export default function DraftsScreen() {
  const [drafts, setDrafts] = useState<LocalFormDraft[]>([]);

  const [draftToDelete, setDraftToDelete] =
    useState<LocalFormDraft | null>(null);

  const [isDeleting, setIsDeleting] = useState(false);

  const loadDrafts = useCallback(async () => {
    setDrafts(await getLocalFormDrafts());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadDrafts();
    }, [loadDrafts]),
  );

  function handleDeleteDraft(draft: LocalFormDraft) {
  setDraftToDelete(draft);
}

async function confirmDeleteDraft() {
  if (!draftToDelete || isDeleting) {
    return;
  }

  try {
    setIsDeleting(true);

    await deleteLocalFormDraft(draftToDelete.id);
    await loadDrafts();

    setDraftToDelete(null);
  } catch (error) {
    console.error("Unable to delete draft:", error);
  } finally {
    setIsDeleting(false);
  }
}

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Local Drafts</Text>
        <Text style={styles.title}>Drafts</Text>
        <Text style={styles.subtitle}>
          Drafts are unfinished forms saved on this device. They are not submitted or queued for sync, and only the creator account can see them.
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
              Use Save Draft while adding a victim to pause and continue later before submitting.
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
                onPress={() => handleDeleteDraft(item)}
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

      <Modal
        visible={draftToDelete !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isDeleting) {
            setDraftToDelete(null);
          }
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <Ionicons
                name="trash-outline"
                size={26}
                color={COLORS.red}
              />
            </View>

            <Text style={styles.modalTitle}>
              Delete draft?
            </Text>

            <Text style={styles.modalMessage}>
              {draftToDelete
                ? `Are you sure you want to delete "${draftToDelete.title}"? This draft will be permanently removed from this device.`
                : ""}
            </Text>

            <View style={styles.modalActions}>
              <Pressable
                disabled={isDeleting}
                onPress={() => setDraftToDelete(null)}
                style={({ pressed }) => [
                  styles.modalCancelButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.modalCancelText}>
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                disabled={isDeleting}
                onPress={() => {
                  void confirmDeleteDraft();
                }}
                style={({ pressed }) => [
                  styles.modalDeleteButton,
                  pressed && styles.pressed,
                  isDeleting && styles.disabledButton,
                ]}
              >
                <Ionicons
                  name="trash-outline"
                  size={17}
                  color={COLORS.white}
                />

                <Text style={styles.modalDeleteText}>
                  {isDeleting ? "Deleting..." : "Delete"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

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
  modalBackdrop: {
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  padding: 22,
  backgroundColor: "rgba(15, 23, 42, 0.48)",
},

modalCard: {
  width: "100%",
  maxWidth: 420,
  padding: 22,
  borderWidth: 1,
  borderColor: COLORS.border,
  borderRadius: 18,
  backgroundColor: COLORS.white,
},

modalIcon: {
  width: 52,
  height: 52,
  alignItems: "center",
  justifyContent: "center",
  marginBottom: 16,
  borderRadius: 16,
  backgroundColor: "#FFF1F1",
},

modalTitle: {
  color: COLORS.text,
  fontSize: 20,
  fontWeight: "900",
},

modalMessage: {
  marginTop: 8,
  color: COLORS.muted,
  fontSize: 14,
  lineHeight: 21,
},

modalActions: {
  flexDirection: "row",
  gap: 10,
  marginTop: 22,
},

modalCancelButton: {
  flex: 1,
  minHeight: 46,
  alignItems: "center",
  justifyContent: "center",
  borderWidth: 1,
  borderColor: COLORS.border,
  borderRadius: 12,
  backgroundColor: COLORS.white,
},

modalCancelText: {
  color: COLORS.text,
  fontSize: 14,
  fontWeight: "800",
},

modalDeleteButton: {
  flex: 1,
  minHeight: 46,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  borderRadius: 12,
  backgroundColor: COLORS.red,
},

modalDeleteText: {
  color: COLORS.white,
  fontSize: 14,
  fontWeight: "900",
},

disabledButton: {
  opacity: 0.55,
},
});
