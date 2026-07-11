import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const COLORS = {
  maroon: "#7B1113",
  darkMaroon: "#5F0B0D",
  white: "#FFFFFF",
  background: "#F3F5F9",
  text: "#17213A",
  secondaryText: "#7C88A0",
  border: "#E4E8EF",

  paleRed: "#FCE6E7",
  red: "#C92D32",

  paleOrange: "#FFF0DF",
  orange: "#D96D12",

  paleBlue: "#DFF2FC",
  blue: "#0B6B9B",

  paleGreen: "#E8F4EA",
  green: "#3C6D4A",

  synced: "#28B463",
  pending: "#F0A000",
};

type CasualtyStatus =
  | "Missing"
  | "Injured"
  | "Evacuated"
  | "Safe";

type SyncStatus = "Synced" | "Pending";

type CasualtyRecord = {
  id: string;
  name: string;
  age: number;
  location: string;
  status: CasualtyStatus;
  syncStatus: SyncStatus;
  time: string;
};

const casualtyRecords: CasualtyRecord[] = [
  {
    id: "C-2026-001",
    name: "Juan dela Cruz",
    age: 42,
    location: "San Isidro, QC",
    status: "Injured",
    syncStatus: "Synced",
    time: "09:14 AM",
  },
  {
    id: "C-2026-002",
    name: "Maria Santos",
    age: 28,
    location: "Batasan Hills, QC",
    status: "Evacuated",
    syncStatus: "Synced",
    time: "09:32 AM",
  },
  {
    id: "C-2026-003",
    name: "Roberto Reyes",
    age: 55,
    location: "Commonwealth, QC",
    status: "Missing",
    syncStatus: "Pending",
    time: "10:05 AM",
  },
  {
    id: "C-2026-004",
    name: "Ana Mendoza",
    age: 34,
    location: "Payatas, QC",
    status: "Safe",
    syncStatus: "Synced",
    time: "10:18 AM",
  },
  {
    id: "C-2026-005",
    name: "Daniel Garcia",
    age: 19,
    location: "Bagong Silangan, QC",
    status: "Injured",
    syncStatus: "Pending",
    time: "10:46 AM",
  },
  {
    id: "C-2026-006",
    name: "Lorna Villanueva",
    age: 63,
    location: "Tandang Sora, QC",
    status: "Evacuated",
    syncStatus: "Synced",
    time: "11:07 AM",
  },
  {
    id: "C-2026-007",
    name: "Miguel Ramos",
    age: 31,
    location: "Holy Spirit, QC",
    status: "Safe",
    syncStatus: "Synced",
    time: "11:22 AM",
  },
];

const filters = [
  "All",
  "Missing",
  "Injured",
  "Evacuated",
  "Safe",
] as const;

type FilterOption = (typeof filters)[number];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function getStatusStyle(status: CasualtyStatus) {
  switch (status) {
    case "Missing":
      return {
        backgroundColor: COLORS.paleRed,
        color: COLORS.red,
      };

    case "Injured":
      return {
        backgroundColor: COLORS.paleOrange,
        color: COLORS.orange,
      };

    case "Evacuated":
      return {
        backgroundColor: COLORS.paleBlue,
        color: COLORS.blue,
      };

    case "Safe":
      return {
        backgroundColor: COLORS.paleGreen,
        color: COLORS.green,
      };
  }
}

function CasualtyCard({
  item,
}: {
  item: CasualtyRecord;
}) {
  const statusStyle = getStatusStyle(item.status);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.recordCard,
        pressed && styles.recordCardPressed,
      ]}
      onPress={() => {
        /*
         * Replace this later with the actual casualty details route.
         */
        console.log("Open casualty:", item.id);
      }}
    >
      <View style={styles.recordTopRow}>
        <View
          style={[
            styles.avatar,
            {
              backgroundColor: statusStyle.backgroundColor,
            },
          ]}
        >
          <Text
            style={[
              styles.avatarText,
              {
                color: statusStyle.color,
              },
            ]}
          >
            {getInitials(item.name)}
          </Text>
        </View>

        <View style={styles.recordMain}>
          <Text style={styles.recordName}>{item.name}</Text>

          <Text style={styles.recordMeta}>
            {item.id} · Age {item.age}
          </Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: statusStyle.backgroundColor,
            },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              {
                color: statusStyle.color,
              },
            ]}
          >
            {item.status}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.recordBottomRow}>
        <View style={styles.locationRow}>
          <Ionicons
            name="location-outline"
            size={14}
            color={COLORS.secondaryText}
          />

          <Text style={styles.locationText}>
            {item.location}
          </Text>
        </View>

        <View style={styles.syncRow}>
          <View
            style={[
              styles.syncDot,
              {
                backgroundColor:
                  item.syncStatus === "Synced"
                    ? COLORS.synced
                    : COLORS.pending,
              },
            ]}
          />

          <Text style={styles.syncText}>
            {item.syncStatus}
          </Text>

          <Text style={styles.timeText}>· {item.time}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function RecordsScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] =
    useState<FilterOption>("All");

  const filteredRecords = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return casualtyRecords.filter((record) => {
      const matchesFilter =
        activeFilter === "All" ||
        record.status === activeFilter;

      const matchesSearch =
        !normalizedSearch ||
        record.name.toLowerCase().includes(normalizedSearch) ||
        record.id.toLowerCase().includes(normalizedSearch) ||
        record.location.toLowerCase().includes(normalizedSearch);

      return matchesFilter && matchesSearch;
    });
  }, [activeFilter, searchQuery]);

  const formattedDate = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

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
          <Text style={styles.headerTitle}>
            Casualty Records
          </Text>

          <Text style={styles.headerSubtitle}>
            {casualtyRecords.length} entries · {formattedDate}
          </Text>

          <View style={styles.searchBar}>
            <Ionicons
              name="search-outline"
              size={19}
              color="rgba(255,255,255,0.72)"
            />

            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={styles.searchInput}
              placeholder="Search name or ID..."
              placeholderTextColor="rgba(255,255,255,0.65)"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />

            <Pressable
              style={({ pressed }) => [
                styles.filterButton,
                pressed && styles.pressed,
              ]}
              onPress={() => {
                console.log("Open advanced filters");
              }}
              accessibilityRole="button"
              accessibilityLabel="Open filters"
            >
              <Ionicons
                name="options-outline"
                size={18}
                color={COLORS.white}
              />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      <View style={styles.filterSection}>
        <FlatList
          horizontal
          data={filters}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => {
            const isActive = activeFilter === item;

            return (
              <Pressable
                onPress={() => setActiveFilter(item)}
                style={({ pressed }) => [
                  styles.filterChip,
                  isActive && styles.filterChipActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    isActive && styles.filterChipTextActive,
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      <FlatList
        data={filteredRecords}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CasualtyCard item={item} />
        )}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons
              name="search-outline"
              size={48}
              color={COLORS.secondaryText}
            />

            <Text style={styles.emptyTitle}>
              No casualty records found
            </Text>

            <Text style={styles.emptyDescription}>
              Try changing the search keyword or selected status.
            </Text>
          </View>
        }
      />

      <Pressable
        onPress={() =>
          router.push("/(tabs)/add-casualty")
        }
        style={({ pressed }) => [
          styles.floatingButton,
          pressed && styles.floatingButtonPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Add casualty"
      >
        <Ionicons
          name="add"
          size={31}
          color={COLORS.white}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  headerSafeArea: {
    backgroundColor: COLORS.maroon,
  },
  header: {
    backgroundColor: COLORS.maroon,
    paddingHorizontal: 6,
    paddingTop: 10,
    paddingBottom: 18,
  },
  headerTitle: {
    color: COLORS.white,
    fontSize: 21,
    fontWeight: "800",
  },
  headerSubtitle: {
    color: "rgba(255,255,255,0.80)",
    fontSize: 12,
    marginTop: 7,
  },

  searchBar: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 17,
    paddingLeft: 14,
    paddingRight: 9,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  searchInput: {
    flex: 1,
    minHeight: 46,
    color: COLORS.white,
    fontSize: 14,
    paddingHorizontal: 11,
  },
  filterButton: {
    width: 37,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.17)",
  },

  filterSection: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterList: {
    paddingHorizontal: 2,
    paddingVertical: 12,
    gap: 8,
  },
  filterChip: {
    minHeight: 33,
    paddingHorizontal: 16,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F5F8",
  },
  filterChipActive: {
    backgroundColor: COLORS.maroon,
  },
  filterChipText: {
    color: "#35415B",
    fontSize: 12,
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: COLORS.white,
  },

  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 4,
    paddingTop: 13,
    paddingBottom: 110,
    gap: 10,
  },

  recordCard: {
    minHeight: 112,
    paddingHorizontal: 16,
    paddingTop: 15,
    paddingBottom: 13,
    borderRadius: 17,
    backgroundColor: COLORS.white,
    elevation: 3,
    shadowColor: "#728099",
    shadowOpacity: 0.10,
    shadowRadius: 9,
    shadowOffset: {
      width: 0,
      height: 4,
    },
  },
  recordCardPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
  recordTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: "900",
  },
  recordMain: {
    flex: 1,
  },
  recordName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800",
  },
  recordMeta: {
    color: COLORS.secondaryText,
    fontSize: 11,
    marginTop: 5,
  },
  statusBadge: {
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "800",
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginTop: 12,
    marginBottom: 10,
  },

  recordBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  locationRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  locationText: {
    flex: 1,
    color: COLORS.secondaryText,
    fontSize: 10,
    marginLeft: 5,
  },
  syncRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  syncDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  syncText: {
    color: COLORS.secondaryText,
    fontSize: 9,
  },
  timeText: {
    color: COLORS.secondaryText,
    fontSize: 9,
    marginLeft: 5,
  },

  floatingButton: {
    position: "absolute",
    right: 20,
    bottom: 18,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.maroon,
    elevation: 10,
    shadowColor: COLORS.maroon,
    shadowOpacity: 0.34,
    shadowRadius: 11,
    shadowOffset: {
      width: 0,
      height: 6,
    },
  },
  floatingButtonPressed: {
    opacity: 0.84,
    transform: [{ scale: 0.95 }],
  },

  pressed: {
    opacity: 0.76,
  },

  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
    paddingTop: 90,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "800",
    marginTop: 14,
  },
  emptyDescription: {
    color: COLORS.secondaryText,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 7,
  },
});