import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getUnitUsers,
  getManagedAccounts,
  registerAdminAccount,
  registerUnitUser,
  type ManagedAccount,
  type RegisterAdminAccountPayload,
  type RegisterUnitUserPayload,
} from "../api/accounts";
import { getCurrentUser } from "../auth/session";

const COLORS = {
  maroon: "#7B1113",
  white: "#FFFFFF",
  background: "#F3F5F9",
  text: "#15213A",
  muted: "#78849A",
  border: "#E4E8EF",
  green: "#2E7D4F",
  orange: "#E47A18",
  paleRed: "#FFF0F0",
};

type FilterMode = "all" | "unit";
type AccountRole = RegisterAdminAccountPayload["role"] | RegisterUnitUserPayload["role"];
type AccountForm = {
  fullName: string;
  email: string;
  password: string;
  role: AccountRole;
  phoneNumber?: string;
  assignedMunicipality?: string;
  assignedBarangay?: string;
};

const initialForm: AccountForm = {
  fullName: "",
  email: "",
  password: "",
  role: "administrator",
  phoneNumber: "",
  assignedMunicipality: "",
  assignedBarangay: "",
};

function roleLabel(role: string): string {
  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getUnitLabel(account: ManagedAccount): string {
  return (
    [account.assigned_barangay, account.assigned_municipality]
      .filter(Boolean)
      .join(", ") || "No assigned unit"
  );
}

function isSameUnit(
  account: ManagedAccount,
  unit: string | null,
): boolean {
  return getUnitLabel(account).toLowerCase() === (unit ?? "").toLowerCase();
}

export default function AccountManagementScreen() {
  const [accounts, setAccounts] = useState<ManagedAccount[]>([]);
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [form, setForm] = useState<AccountForm>(initialForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    try {
      setErrorMessage(null);
      setIsLoading(true);

      const user = await getCurrentUser();

      setCurrentRole(user?.role ?? null);

      if (
        user?.role !== "super_admin" &&
        user?.role !== "admin" &&
        user?.role !== "administrator"
      ) {
        setErrorMessage("Only admin accounts can manage accounts.");
        setAccounts([]);
        return;
      }

      const data =
        user.role === "super_admin"
          ? await getManagedAccounts()
          : await getUnitUsers();

      setForm((current) => ({
        ...current,
        role: user.role === "super_admin" ? "administrator" : "responder",
        assignedMunicipality:
          user.role === "super_admin"
            ? current.assignedMunicipality
            : current.assignedMunicipality || user.assigned_municipality || "",
        assignedBarangay:
          user.role === "super_admin"
            ? current.assignedBarangay
            : current.assignedBarangay || user.assigned_barangay || "",
      }));

      setAccounts(
        [...data].sort((a, b) =>
          a.full_name.localeCompare(b.full_name),
        ),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load accounts.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadAccounts();
    }, [loadAccounts]),
  );

  const units = useMemo(
    () =>
      Array.from(new Set(accounts.map(getUnitLabel))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [accounts],
  );

  const visibleAccounts = useMemo(() => {
    const filtered =
      filterMode === "unit" && selectedUnit
        ? accounts.filter((account) => isSameUnit(account, selectedUnit))
        : accounts;

    return [...filtered].sort((a, b) =>
      a.full_name.localeCompare(b.full_name),
    );
  }, [accounts, filterMode, selectedUnit]);

  const isSuperAdmin = currentRole === "super_admin";
  const roleOptions: AccountRole[] = isSuperAdmin
    ? ["administrator", "super_admin"]
    : ["responder", "documenter"];
  const formTitle = isSuperAdmin
    ? "Create admin account"
    : "Create responder/documenter account";
  const formSubtitle = isSuperAdmin
    ? "Admin accounts are assigned to a unit or location."
    : "Responder and documenter accounts are assigned under your unit.";
  const directorySubtitle = isSuperAdmin
    ? "Alphabetical directory of all managed user accounts."
    : "Responder and documenter accounts under your admin/unit scope.";
  const headerSubtitle = isSuperAdmin
    ? "Super admin account controls"
    : "Admin unit account controls";
  const createSuccessMessage = isSuperAdmin
    ? "The admin account can now log in with the temporary password."
    : "The responder or documenter account can now log in with the temporary password.";

  function updateForm<K extends keyof AccountForm>(
    key: K,
    value: AccountForm[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleCreateAccount() {
    const payload = {
      ...form,
      fullName: form.fullName.trim(),
      email: form.email.trim().toLowerCase(),
      password: form.password,
      phoneNumber: form.phoneNumber?.trim() || undefined,
      assignedMunicipality: form.assignedMunicipality?.trim() || undefined,
      assignedBarangay: form.assignedBarangay?.trim() || undefined,
    };

    if (!payload.fullName || !payload.email || !payload.password) {
      Alert.alert(
        "Missing required fields",
        "Full name, email, and temporary password are required.",
      );
      return;
    }

    try {
      setIsCreating(true);
      if (isSuperAdmin) {
        await registerAdminAccount({
          ...payload,
          role: payload.role === "super_admin" ? "super_admin" : "administrator",
        });
      } else {
        await registerUnitUser({
          ...payload,
          role: payload.role === "documenter" ? "documenter" : "responder",
        });
      }

      setForm({
        ...initialForm,
        role: isSuperAdmin ? "administrator" : "responder",
        assignedMunicipality: isSuperAdmin ? "" : form.assignedMunicipality,
        assignedBarangay: isSuperAdmin ? "" : form.assignedBarangay,
      });
      await loadAccounts();
      Alert.alert(
        "Account created",
        createSuccessMessage,
      );
    } catch (error) {
      Alert.alert(
        "Unable to create account",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setIsCreating(false);
    }
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
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color={COLORS.white}
            />
          </Pressable>

          <View style={styles.headerTextGroup}>
            <Text
              style={styles.title}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              Account Management
            </Text>
            <Text style={styles.subtitle}>{headerSubtitle}</Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {errorMessage ? (
          <View style={styles.noticeCard}>
            <Text style={styles.noticeText}>{errorMessage}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{formTitle}</Text>
          <Text style={styles.cardSubtitle}>{formSubtitle}</Text>

          <TextInput
            style={styles.input}
            value={form.fullName}
            onChangeText={(value) => updateForm("fullName", value)}
            placeholder="Full name"
            placeholderTextColor={COLORS.muted}
          />
          <TextInput
            style={styles.input}
            value={form.email}
            onChangeText={(value) => updateForm("email", value)}
            placeholder="Email"
            placeholderTextColor={COLORS.muted}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            value={form.password}
            onChangeText={(value) => updateForm("password", value)}
            placeholder="Temporary password"
            placeholderTextColor={COLORS.muted}
            secureTextEntry
          />

          <View style={styles.segmentedRow}>
            {roleOptions.map((role) => (
              <Pressable
                key={role}
                onPress={() => updateForm("role", role)}
                style={[
                  styles.segmentButton,
                  form.role === role && styles.segmentButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.segmentText,
                    form.role === role && styles.segmentTextActive,
                  ]}
                >
                  {roleLabel(role)}
                </Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            style={styles.input}
            value={form.phoneNumber}
            onChangeText={(value) => updateForm("phoneNumber", value)}
            placeholder="Phone number"
            placeholderTextColor={COLORS.muted}
            keyboardType="phone-pad"
          />
          <TextInput
            style={styles.input}
            value={form.assignedMunicipality}
            onChangeText={(value) =>
              updateForm("assignedMunicipality", value)
            }
            placeholder="Assigned municipality / city"
            placeholderTextColor={COLORS.muted}
          />
          <TextInput
            style={styles.input}
            value={form.assignedBarangay}
            onChangeText={(value) => updateForm("assignedBarangay", value)}
            placeholder="Assigned barangay / unit"
            placeholderTextColor={COLORS.muted}
          />

          <Pressable
            onPress={handleCreateAccount}
            disabled={isCreating}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.pressed,
              isCreating && styles.disabled,
            ]}
          >
            {isCreating ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.primaryButtonText}>Create account</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Users Directory</Text>
              <Text style={styles.cardSubtitle}>{directorySubtitle}</Text>
            </View>
            <Pressable
              onPress={() => void loadAccounts()}
              style={({ pressed }) => [
                styles.iconButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name="refresh-outline"
                size={20}
                color={COLORS.maroon}
              />
            </Pressable>
          </View>

          <View style={styles.segmentedRow}>
            <Pressable
              onPress={() => {
                setFilterMode("all");
                setSelectedUnit(null);
              }}
              style={[
                styles.segmentButton,
                filterMode === "all" && styles.segmentButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  filterMode === "all" && styles.segmentTextActive,
                ]}
              >
                All
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setFilterMode("unit");
                setSelectedUnit(units[0] ?? null);
              }}
              style={[
                styles.segmentButton,
                filterMode === "unit" && styles.segmentButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  filterMode === "unit" && styles.segmentTextActive,
                ]}
              >
                By Unit
              </Text>
            </Pressable>
          </View>

          {filterMode === "unit" ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.unitFilterRow}
            >
              {units.map((unit) => (
                <Pressable
                  key={unit}
                  onPress={() => setSelectedUnit(unit)}
                  style={[
                    styles.unitChip,
                    selectedUnit === unit && styles.unitChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.unitChipText,
                      selectedUnit === unit && styles.unitChipTextActive,
                    ]}
                  >
                    {unit}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}

          {isLoading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color={COLORS.maroon} />
              <Text style={styles.loadingText}>Loading accounts...</Text>
            </View>
          ) : visibleAccounts.length > 0 ? (
            <View style={styles.accountList}>
              {visibleAccounts.map((account) => (
                <View
                  key={account.id}
                  style={styles.accountCard}
                >
                  <View style={styles.accountAvatar}>
                    <Text style={styles.accountAvatarText}>
                      {account.full_name.slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.accountDetails}>
                    <Text style={styles.accountName}>
                      {account.full_name}
                    </Text>
                    <Text style={styles.accountEmail}>
                      {account.email}
                    </Text>
                    <Text style={styles.accountMeta}>
                      {roleLabel(account.role)} - {getUnitLabel(account)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      account.is_active && styles.statusPillActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        account.is_active && styles.statusPillTextActive,
                      ]}
                    >
                      {account.is_active ? "Active" : "Inactive"}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.loadingCard}>
              <Text style={styles.loadingText}>No accounts found.</Text>
            </View>
          )}
        </View>
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
    backgroundColor: COLORS.maroon,
  },
  header: {
    minHeight: 118,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingBottom: 22,
    backgroundColor: COLORS.maroon,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  headerTextGroup: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: COLORS.white,
    fontSize: 24,
    fontWeight: "900",
  },
  subtitle: {
    marginTop: 5,
    color: "rgba(255,255,255,0.72)",
    fontSize: 13,
    fontWeight: "700",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    gap: 14,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  cardHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "900",
  },
  cardSubtitle: {
    marginTop: 4,
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 13,
    color: COLORS.text,
    fontSize: 14,
  },
  segmentedRow: {
    flexDirection: "row",
    gap: 8,
  },
  segmentButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 10,
  },
  segmentButtonActive: {
    borderColor: COLORS.maroon,
    backgroundColor: COLORS.paleRed,
  },
  segmentText: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  segmentTextActive: {
    color: COLORS.maroon,
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.maroon,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "900",
  },
  iconButton: {
    width: 42,
    height: 42,
    flexShrink: 0,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#F8FAFC",
  },
  unitFilterRow: {
    gap: 8,
    paddingVertical: 2,
  },
  unitChip: {
    minHeight: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
  unitChipActive: {
    borderColor: COLORS.maroon,
    backgroundColor: COLORS.paleRed,
  },
  unitChipText: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  unitChipTextActive: {
    color: COLORS.maroon,
  },
  accountList: {
    gap: 10,
  },
  accountCard: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 11,
    backgroundColor: "#FBFCFE",
  },
  accountAvatar: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.paleRed,
  },
  accountAvatarText: {
    color: COLORS.maroon,
    fontSize: 16,
    fontWeight: "900",
  },
  accountDetails: {
    flex: 1,
    minWidth: 0,
  },
  accountName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "900",
  },
  accountEmail: {
    marginTop: 3,
    color: COLORS.muted,
    fontSize: 12,
  },
  accountMeta: {
    marginTop: 3,
    color: COLORS.muted,
    fontSize: 11,
  },
  statusPill: {
    minHeight: 28,
    borderRadius: 999,
    paddingHorizontal: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF4E7",
  },
  statusPillActive: {
    backgroundColor: "#EDF8F1",
  },
  statusPillText: {
    color: COLORS.orange,
    fontSize: 11,
    fontWeight: "900",
  },
  statusPillTextActive: {
    color: COLORS.green,
  },
  loadingCard: {
    minHeight: 88,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "700",
  },
  noticeCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F0C5C5",
    backgroundColor: "#FFF4F4",
    padding: 13,
  },
  noticeText: {
    color: COLORS.maroon,
    fontSize: 13,
    fontWeight: "800",
  },
  disabled: {
    opacity: 0.58,
  },
  pressed: {
    opacity: 0.72,
  },
});
