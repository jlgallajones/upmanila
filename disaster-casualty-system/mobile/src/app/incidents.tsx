import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  closeIncident,
  createIncident,
  getIncidents,
  type Incident,
} from "../api/incidents";
import { getCurrentUser } from "../auth/session";

const COLORS = {
  maroon: "#7B1113",
  white: "#FFFFFF",
  background: "#F3F5F9",
  card: "#FFFFFF",
  text: "#17213A",
  secondaryText: "#69758C",
  mutedText: "#9AA6BA",
  border: "#E5E9F0",
  fieldBackground: "#F7F9FC",
  fieldBorder: "#D9E0EA",
  green: "#2E7D4F",
  orange: "#D96D12",
  red: "#C92D32",
};

const SCREEN_PADDING = 16;

const REFERENCE_MANAGER_ROLES = [
  "super_admin",
  "administrator",
  "encoder",
] as const;

const DISASTER_TYPES = [
  "Typhoon",
  "Flood",
  "Fire",
  "Earthquake",
  "Landslide",
  "Volcanic Eruption",
  "Storm Surge",
  "Other",
] as const;

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatLocation(incident: Incident): string {
  const parts = [
    incident.barangay,
    incident.municipality,
    incident.province,
  ].filter(
    (part): part is string =>
      typeof part === "string" && part.trim().length > 0,
  );

  return parts.length > 0 ? parts.join(", ") : "Location unavailable";
}

function formatRoleAllowed(role: string | null): boolean {
  return (
    role !== null &&
    REFERENCE_MANAGER_ROLES.includes(
      role as (typeof REFERENCE_MANAGER_ROLES)[number],
    )
  );
}

function IncidentCard({
  incident,
  canClose,
  onClose,
}: {
  incident: Incident;
  canClose: boolean;
  onClose: () => void;
}) {
  return (
    <View style={styles.incidentCard}>
      <View style={styles.cardTopRow}>
        <View style={styles.incidentIcon}>
          <Ionicons
            name="warning-outline"
            size={20}
            color={COLORS.maroon}
          />
        </View>

        <View style={styles.cardMain}>
          <Text style={styles.incidentName} numberOfLines={2}>
            {incident.incident_name}
          </Text>

          <Text style={styles.incidentMeta} numberOfLines={1}>
            {incident.incident_code} - {incident.disaster_type}
          </Text>
        </View>

        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>
            {incident.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.cardDivider} />

      <View style={styles.detailRow}>
        <Ionicons
          name="location-outline"
          size={15}
          color={COLORS.secondaryText}
        />
        <Text style={styles.detailText} numberOfLines={1}>
          {formatLocation(incident)}
        </Text>
      </View>

      <View style={styles.detailRow}>
        <Ionicons
          name="calendar-outline"
          size={15}
          color={COLORS.secondaryText}
        />
        <Text style={styles.detailText}>
          Started {formatDate(incident.started_at)}
        </Text>
      </View>

      {canClose ? (
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [
            styles.closeIncidentButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="close-circle-outline"
            size={17}
            color={COLORS.red}
          />
          <Text style={styles.closeIncidentText}>
            Close Incident
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [query, setQuery] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(
    null,
  );
  const [currentUserRole, setCurrentUserRole] = useState<
    string | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    null,
  );
  const [isCreateModalVisible, setIsCreateModalVisible] =
    useState(false);
  const [newIncidentName, setNewIncidentName] = useState("");
  const [newDisasterType, setNewDisasterType] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const canCreateIncident = formatRoleAllowed(currentUserRole);

  const loadIncidents = useCallback(async () => {
    try {
      setErrorMessage(null);

      const [user, data] = await Promise.all([
        getCurrentUser(),
        getIncidents(),
      ]);

      setCurrentUserId(user?.id ?? null);
      setCurrentUserRole(user?.role ?? null);
      setIncidents(data);
    } catch (error) {
      console.error("Unable to load incidents:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load active incidents.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      void loadIncidents();
    }, [loadIncidents]),
  );

  const filteredIncidents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return incidents;
    }

    return incidents.filter((incident) => {
      const searchable = [
        incident.incident_name,
        incident.incident_code,
        incident.disaster_type,
        incident.barangay,
        incident.municipality,
        incident.province,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedQuery);
    });
  }, [incidents, query]);

  async function handleRefresh() {
    try {
      setIsRefreshing(true);
      await loadIncidents();
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleCreateIncident() {
    const incidentName = newIncidentName.trim();
    const disasterType = newDisasterType.trim();
    const location = newLocation.trim();

    if (!currentUserId) {
      Alert.alert(
        "Login required",
        "Please log in again before creating an incident.",
      );
      return;
    }

    if (!canCreateIncident) {
      Alert.alert(
        "Permission required",
        "Your account is not allowed to create disaster incidents.",
      );
      return;
    }

    if (!incidentName || !disasterType) {
      Alert.alert(
        "Complete incident details",
        "Enter an incident name and disaster type.",
      );
      return;
    }

    try {
      setIsCreating(true);

      const created = await createIncident({
        incidentName,
        disasterType,
        municipality: location || undefined,
      });

      setIncidents((current) => [created, ...current]);
      setNewIncidentName("");
      setNewDisasterType("");
      setNewLocation("");
      setIsCreateModalVisible(false);

      Alert.alert(
        "Incident created",
        "The new disaster incident is now available for casualty records.",
      );
    } catch (error) {
      console.error("Unable to create incident:", error);

      Alert.alert(
        "Unable to create incident",
        error instanceof Error
          ? error.message
          : "Please review the incident details and try again.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  function handleCloseIncident(incident: Incident) {
    Alert.alert(
      "Close incident",
      `Close ${incident.incident_name}? It will no longer appear as an active incident.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Close",
          style: "destructive",
          onPress: async () => {
            try {
              await closeIncident(incident.id);

              setIncidents((current) =>
                current.filter((item) => item.id !== incident.id),
              );
            } catch (error) {
              console.error("Unable to close incident:", error);

              Alert.alert(
                "Unable to close incident",
                error instanceof Error
                  ? error.message
                  : "Please try again.",
              );
            }
          },
        },
      ],
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator
          size="large"
          color={COLORS.maroon}
        />
        <Text style={styles.centerStateText}>
          Loading active incidents...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={COLORS.maroon}
      />

      <SafeAreaView
        edges={["top"]}
        style={styles.headerSafeArea}
      >
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name="chevron-back"
                size={22}
                color={COLORS.white}
              />
            </Pressable>

            {canCreateIncident ? (
              <Pressable
                onPress={() => setIsCreateModalVisible(true)}
                style={({ pressed }) => [
                  styles.headerActionButton,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name="add"
                  size={22}
                  color={COLORS.white}
                />
              </Pressable>
            ) : null}
          </View>

          <Text style={styles.headerTitle}>
            Incident Management
          </Text>
          <Text style={styles.headerSubtitle}>
            {incidents.length} active incidents
          </Text>

          <View style={styles.searchBar}>
            <Ionicons
              name="search-outline"
              size={18}
              color="rgba(255,255,255,0.72)"
            />
            <TextInput
              value={query}
              onChangeText={setQuery}
              style={styles.searchInput}
              placeholder="Search incident, type, or location"
              placeholderTextColor="rgba(255,255,255,0.65)"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>
      </SafeAreaView>

      {errorMessage ? (
        <View style={styles.errorBanner}>
          <Ionicons
            name="alert-circle-outline"
            size={20}
            color={COLORS.red}
          />
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      <FlatList
        data={filteredIncidents}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <IncidentCard
            incident={item}
            canClose={canCreateIncident}
            onClose={() => handleCloseIncident(item)}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[COLORS.maroon]}
            tintColor={COLORS.maroon}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons
              name="warning-outline"
              size={48}
              color={COLORS.secondaryText}
            />
            <Text style={styles.emptyTitle}>
              No incidents found
            </Text>
            <Text style={styles.emptyText}>
              Pull down to refresh or create a new active incident.
            </Text>
          </View>
        }
      />

      <Modal
        visible={isCreateModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCreateModalVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setIsCreateModalVisible(false)}
        >
          <Pressable style={styles.createSheet}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                Create Incident
              </Text>
              <Pressable
                onPress={() => setIsCreateModalVisible(false)}
                style={styles.sheetCloseButton}
              >
                <Ionicons
                  name="close"
                  size={20}
                  color={COLORS.secondaryText}
                />
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>INCIDENT NAME</Text>
            <TextInput
              value={newIncidentName}
              onChangeText={setNewIncidentName}
              style={styles.input}
              placeholder="e.g. Flood in San Isidro"
              placeholderTextColor={COLORS.mutedText}
            />

            <Text style={styles.fieldLabel}>DISASTER TYPE</Text>
            <View style={styles.typeGrid}>
              {DISASTER_TYPES.map((type) => {
                const selected = newDisasterType === type;

                return (
                  <Pressable
                    key={type}
                    onPress={() => setNewDisasterType(type)}
                    style={({ pressed }) => [
                      styles.typeChip,
                      selected && styles.typeChipActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeChipText,
                        selected && styles.typeChipTextActive,
                      ]}
                    >
                      {type}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>LOCATION</Text>
            <TextInput
              value={newLocation}
              onChangeText={setNewLocation}
              style={styles.input}
              placeholder="Municipality or city"
              placeholderTextColor={COLORS.mutedText}
            />

            <Pressable
              disabled={isCreating}
              onPress={() => {
                void handleCreateIncident();
              }}
              style={({ pressed }) => [
                styles.createButton,
                isCreating && styles.disabledButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.createButtonText}>
                {isCreating ? "Creating..." : "Create Incident"}
              </Text>
              {isCreating ? (
                <ActivityIndicator
                  size="small"
                  color={COLORS.white}
                />
              ) : (
                <Ionicons
                  name="checkmark-circle-outline"
                  size={19}
                  color={COLORS.white}
                />
              )}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },
  centerStateText: {
    color: COLORS.secondaryText,
    fontSize: 13,
    marginTop: 12,
  },
  headerSafeArea: {
    backgroundColor: COLORS.maroon,
  },
  header: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 8,
    paddingBottom: 18,
    backgroundColor: COLORS.maroon,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  headerActionButton: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  headerTitle: {
    color: COLORS.white,
    fontSize: 22,
    fontWeight: "900",
  },
  headerSubtitle: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 12,
    marginTop: 6,
  },
  searchBar: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    paddingHorizontal: 13,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  searchInput: {
    flex: 1,
    minHeight: 46,
    color: COLORS.white,
    fontSize: 14,
    paddingLeft: 9,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: SCREEN_PADDING,
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F4C3C5",
    backgroundColor: "#FFF1F1",
    gap: 8,
  },
  errorText: {
    flex: 1,
    color: COLORS.red,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 14,
    paddingBottom: 28,
    gap: 11,
  },
  incidentCard: {
    paddingHorizontal: 15,
    paddingTop: 15,
    paddingBottom: 14,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    elevation: 2,
    shadowColor: "#728099",
    shadowOpacity: 0.08,
    shadowRadius: 9,
    shadowOffset: {
      width: 0,
      height: 4,
    },
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  incidentIcon: {
    width: 43,
    height: 43,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
    backgroundColor: "#FFF2F2",
  },
  cardMain: {
    flex: 1,
    minWidth: 0,
  },
  incidentName: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
  },
  incidentMeta: {
    color: COLORS.secondaryText,
    fontSize: 11,
    marginTop: 5,
  },
  statusBadge: {
    borderRadius: 13,
    paddingHorizontal: 9,
    paddingVertical: 6,
    marginLeft: 8,
    backgroundColor: "#EAF7EF",
  },
  statusText: {
    color: COLORS.green,
    fontSize: 9,
    fontWeight: "900",
  },
  cardDivider: {
    height: 1,
    marginTop: 13,
    marginBottom: 11,
    backgroundColor: COLORS.border,
  },
  detailRow: {
    minHeight: 24,
    flexDirection: "row",
    alignItems: "center",
  },
  detailText: {
    flex: 1,
    color: COLORS.secondaryText,
    fontSize: 11,
    marginLeft: 7,
  },
  closeIncidentButton: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#F4C3C5",
    marginTop: 10,
    backgroundColor: "#FFF4F4",
    gap: 7,
  },
  closeIncidentText: {
    color: COLORS.red,
    fontSize: 12,
    fontWeight: "800",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 80,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "900",
    marginTop: 14,
  },
  emptyText: {
    color: COLORS.secondaryText,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 7,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(23,33,58,0.38)",
  },
  createSheet: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 10,
    paddingBottom: 24,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: COLORS.white,
  },
  sheetHandle: {
    width: 42,
    height: 4,
    alignSelf: "center",
    borderRadius: 2,
    backgroundColor: "#D7DDE8",
    marginBottom: 14,
  },
  sheetHeader: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sheetTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "900",
  },
  sheetCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.fieldBackground,
  },
  fieldLabel: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.3,
    marginTop: 10,
    marginBottom: 8,
  },
  input: {
    minHeight: 50,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.fieldBorder,
    borderRadius: 13,
    backgroundColor: COLORS.fieldBackground,
    color: COLORS.text,
    fontSize: 14,
  },
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  typeChip: {
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: "#F4F5F8",
  },
  typeChipActive: {
    backgroundColor: COLORS.maroon,
  },
  typeChipText: {
    color: "#35415B",
    fontSize: 12,
    fontWeight: "700",
  },
  typeChipTextActive: {
    color: COLORS.white,
  },
  createButton: {
    minHeight: 51,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    marginTop: 18,
    backgroundColor: COLORS.maroon,
    gap: 8,
  },
  createButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.7,
  },
  pressed: {
    opacity: 0.76,
  },
});
