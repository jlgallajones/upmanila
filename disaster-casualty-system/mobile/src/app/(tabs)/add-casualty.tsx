import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
  createCasualty,
  getCasualty,
  getCasualtyTriageHistory,
  getCasualtyTransportHistory,
  updateCasualty,
  type CasualtyTransportHistoryItem,
  type CasualtyTriageHistoryItem,
  type CasualtyRecord,
  type CreateCasualtyPayload,
  type UpdateCasualtyPayload,
} from "../../api/casualties";
import { uploadAttachment } from "../../api/attachments";
import {
  createIncident,
  getIncidents,
  type Incident,
} from "../../api/incidents";
import {
  createEvacuationCenter,
  getEvacuationCenters,
  type EvacuationCenter,
} from "../../api/evacuation-centers";
import {
  createHealthcareFacility,
  getHealthcareFacilities,
  type HealthcareFacility,
} from "../../api/healthcare-facilities";
import { getCurrentUser } from "../../auth/session";
import {
  isNetworkSubmissionError,
  queueCasualtySubmission,
} from "../../offline/casualtyQueue";

const COLORS = {
  maroon: "#7B1113",
  darkMaroon: "#5E0B0D",
  white: "#FFFFFF",
  background: "#FFFFFF",
  fieldBackground: "#F7F9FC",
  fieldBorder: "#D9E0EA",
  text: "#17213A",
  secondaryText: "#7D889E",
  muted: "#A5ADBB",
  green: "#2E7D4F",
};

const STEPS = [
  "Personal",
  "Address",
  "Incident",
  "Triage",
  "Transport",
  "Status",
  "Remarks",
] as const;

const SEX_OPTIONS = ["Male", "Female", "Unknown"] as const;

const DISASTER_TYPE_OPTIONS = [
  "Typhoon",
  "Flood",
  "Fire",
  "Earthquake",
  "Landslide",
  "Volcanic Eruption",
  "Storm Surge",
  "Other",
] as const;

const STATUS_OPTIONS = [
  "Safe",
  "Displaced",
  "Evacuated",
  "Rescued",
  "Missing",
  "Injured",
  "Hospitalized",
  "Deceased",
  "Unknown",
] as const;

const SEVERITY_OPTIONS = [
  "None",
  "Minor",
  "Moderate",
  "Severe",
  "Critical",
] as const;

const TRIAGE_SYSTEM_OPTIONS = [
  "START",
  "NATO",
  "SIEVE/SORT",
  "SMART",
  "Care Flight",
  "MASS",
  "SALT",
  "ED Triage",
  "Urgent/Non-urgent",
  "Other",
] as const;

const TRIAGE_CATEGORY_OPTIONS = [
  "Immediate",
  "Delayed",
  "Minimal",
  "Expectant",
  "Unknown",
] as const;

const TRIAGE_STAGE_OPTIONS = [
  "On-site",
  "Facility Arrival",
  "Reassessment",
] as const;

const TRANSPORT_REQUIRED_OPTIONS = [
  "Yes",
  "No",
  "Unknown",
] as const;

const TRANSPORT_MODE_OPTIONS = [
  "EMS",
  "Private Vehicle",
  "Independent",
  "Walk-in",
  "Other",
  "Unknown",
] as const;

const EMS_UNIT_TYPE_OPTIONS = [
  "BLS",
  "ALS",
  "Other",
  "Unknown",
] as const;

const FACILITY_LEVEL_OPTIONS = [
  "Primary",
  "Secondary",
  "Tertiary",
  "Specialized",
  "Unknown",
] as const;

const REFERENCE_MANAGER_ROLES = [
  "super_admin",
  "administrator",
  "encoder",
] as const;

type StepName = (typeof STEPS)[number];

type ChoiceSheetName =
  | "sex"
  | "incident"
  | "evacuationCenter"
  | "healthcareFacility"
  | "disasterType"
  | "facilityLevel"
  | "triageSystem"
  | "triageCategory"
  | "triageStage"
  | "transportRequired"
  | "transportMode"
  | "emsUnitType"
  | "casualtyStatus"
  | "severity";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

type FormState = {
  idNumber: string;
  age: string;
  firstName: string;
  middleName: string;
  lastName: string;
  sex: string;
  dateOfBirth: string;

  houseStreet: string;
  barangay: string;
  municipality: string;
  province: string;
  region: string;

  incidentId: string;
  incidentName: string;
  currentLocation: string;
  evacuationCenterId: string;
  evacuationCenter: string;
  latitude: string;
  longitude: string;

  triageSystem: string;
  triageCategory: string;
  triageStage: string;
  triageTime: string;
  triageLocation: string;
  triageNotes: string;

  transportRequired: string;
  transportMode: string;
  emsUnitType: string;
  departedSceneTime: string;
  arrivedFacilityTime: string;
  transportNotes: string;

  casualtyStatus: string;
  severity: string;
  healthcareFacilityId: string;
  healthcareFacility: string;
  hospitalName: string;
  visibleInjury: string;
  medicalCondition: string;
  assistanceNeeded: string;
  assistanceProvided: string;

  remarks: string;
};

type SelectedPhoto = {
  uri: string;
  fileName: string;
  mimeType: string;
  fileSize?: number;
};

type EvacuationCenterLabelSource = Pick<
  EvacuationCenter,
  "center_name" | "barangay" | "municipality"
>;

type HealthcareFacilityLabelSource = Pick<
  HealthcareFacility,
  "facility_name" | "facility_level" | "municipality"
>;

const initialForm: FormState = {
  idNumber: "",
  age: "",
  firstName: "",
  middleName: "",
  lastName: "",
  sex: "",
  dateOfBirth: "",

  houseStreet: "",
  barangay: "",
  municipality: "",
  province: "",
  region: "",

  incidentId: "",
  incidentName: "",
  currentLocation: "",
  evacuationCenterId: "",
  evacuationCenter: "",
  latitude: "",
  longitude: "",

  triageSystem: "",
  triageCategory: "",
  triageStage: "",
  triageTime: "",
  triageLocation: "",
  triageNotes: "",

  transportRequired: "",
  transportMode: "",
  emsUnitType: "",
  departedSceneTime: "",
  arrivedFacilityTime: "",
  transportNotes: "",

  casualtyStatus: "",
  severity: "",
  healthcareFacilityId: "",
  healthcareFacility: "",
  hospitalName: "",
  visibleInjury: "",
  medicalCondition: "",
  assistanceNeeded: "",
  assistanceProvided: "",

  remarks: "",
};

type CasualtyStatus =
  CreateCasualtyPayload["incidentDetails"]["currentStatus"];

type CasualtySeverity =
  NonNullable<CreateCasualtyPayload["incidentDetails"]["severity"]>;

type TriageAssessment =
  NonNullable<CreateCasualtyPayload["triageAssessment"]>;

type TriageSystem = TriageAssessment["triageSystem"];
type TriageCategory = TriageAssessment["triageCategory"];
type TriageStage = NonNullable<TriageAssessment["triageStage"]>;
type TransportRecord =
  NonNullable<CreateCasualtyPayload["transportRecord"]>;
type TransportRequired = TransportRecord["transportRequired"];
type TransportMode = NonNullable<TransportRecord["transportMode"]>;
type EmsUnitType = NonNullable<TransportRecord["emsUnitType"]>;

function valueOrEmpty(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function titleCase(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatEvacuationCenterLabel(
  center: EvacuationCenterLabelSource,
): string {
  const location = [center.barangay, center.municipality]
    .filter(
      (part): part is string =>
        typeof part === "string" && part.trim().length > 0,
    )
    .join(", ");

  return location
    ? `${center.center_name} - ${location}`
    : center.center_name;
}

function formatHealthcareFacilityLabel(
  facility: HealthcareFacilityLabelSource,
): string {
  const details = [titleCase(facility.facility_level), facility.municipality]
    .filter(
      (part): part is string =>
        typeof part === "string" && part.trim().length > 0,
    )
    .join(", ");

  return details
    ? `${facility.facility_name} - ${details}`
    : facility.facility_name;
}

function normalizeEnumValue(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function normalizeStatus(value: string): CasualtyStatus {
  const normalized = normalizeEnumValue(value);
  const allowed: CasualtyStatus[] = [
    "safe",
    "displaced",
    "evacuated",
    "rescued",
    "missing",
    "injured",
    "hospitalized",
    "deceased",
    "unknown",
  ];

  return allowed.includes(normalized as CasualtyStatus)
    ? (normalized as CasualtyStatus)
    : "unknown";
}

function normalizeSeverity(value: string): CasualtySeverity {
  const normalized = normalizeEnumValue(value);
  const allowed: CasualtySeverity[] = [
    "none",
    "minor",
    "moderate",
    "severe",
    "critical",
  ];

  return allowed.includes(normalized as CasualtySeverity)
    ? (normalized as CasualtySeverity)
    : "none";
}

function normalizeTriageSystem(value: string): TriageSystem {
  switch (value.trim().toLowerCase()) {
    case "urgent/non-urgent":
    case "urgent / non-urgent":
      return "urgent_non_urgent";
    case "nato":
      return "nato";
    case "sieve/sort":
    case "sieve / sort":
      return "sieve_sort";
    case "smart":
      return "smart";
    case "care flight":
      return "care_flight";
    case "mass":
      return "mass";
    case "salt":
      return "salt";
    case "ed triage":
      return "ed_triage";
    case "other":
      return "other";
    case "start":
    default:
      return "start";
  }
}

function normalizeTriageCategory(value: string): TriageCategory {
  const normalized = normalizeEnumValue(value);
  const allowed: TriageCategory[] = [
    "immediate",
    "delayed",
    "minimal",
    "expectant",
    "unknown",
  ];

  return allowed.includes(normalized as TriageCategory)
    ? (normalized as TriageCategory)
    : "unknown";
}

function normalizeTriageStage(value: string): TriageStage {
  switch (value.trim().toLowerCase()) {
    case "facility arrival":
      return "facility_arrival";
    case "reassessment":
      return "reassessment";
    case "on-site":
    default:
      return "on_site";
  }
}

function formatTriageSystem(value: string | null | undefined): string {
  switch (value) {
    case "urgent_non_urgent":
      return "Urgent/Non-urgent";
    case "nato":
      return "NATO";
    case "start":
      return "START";
    case "sieve_sort":
      return "SIEVE/SORT";
    case "smart":
      return "SMART";
    case "care_flight":
      return "Care Flight";
    case "mass":
      return "MASS";
    case "salt":
      return "SALT";
    case "ed_triage":
      return "ED Triage";
    case "other":
      return "Other";
    default:
      return "";
  }
}

function formatTriageStage(value: string | null | undefined): string {
  switch (value) {
    case "facility_arrival":
      return "Facility Arrival";
    case "reassessment":
      return "Reassessment";
    case "on_site":
      return "On-site";
    default:
      return "";
  }
}

function normalizeTransportRequired(value: string): TransportRequired {
  const normalized = normalizeEnumValue(value);
  const allowed: TransportRequired[] = ["yes", "no", "unknown"];

  return allowed.includes(normalized as TransportRequired)
    ? (normalized as TransportRequired)
    : "unknown";
}

function normalizeTransportMode(value: string): TransportMode {
  switch (value.trim().toLowerCase()) {
    case "ems":
      return "ems";
    case "private vehicle":
      return "private_vehicle";
    case "independent":
      return "independent";
    case "walk-in":
    case "walk in":
      return "walk_in";
    case "other":
      return "other";
    case "unknown":
    default:
      return "unknown";
  }
}

function normalizeEmsUnitType(value: string): EmsUnitType {
  switch (value.trim().toLowerCase()) {
    case "bls":
      return "bls";
    case "als":
      return "als";
    case "other":
      return "other";
    case "unknown":
    default:
      return "unknown";
  }
}

function formatTransportRequired(
  value: string | null | undefined,
): string {
  switch (value) {
    case "yes":
      return "Yes";
    case "no":
      return "No";
    case "unknown":
      return "Unknown";
    default:
      return "";
  }
}

function formatTransportMode(value: string | null | undefined): string {
  switch (value) {
    case "ems":
      return "EMS";
    case "private_vehicle":
      return "Private Vehicle";
    case "independent":
      return "Independent";
    case "walk_in":
      return "Walk-in";
    case "other":
      return "Other";
    case "unknown":
      return "Unknown";
    default:
      return "";
  }
}

function formatEmsUnitType(value: string | null | undefined): string {
  switch (value) {
    case "bls":
      return "BLS";
    case "als":
      return "ALS";
    case "other":
      return "Other";
    case "unknown":
      return "Unknown";
    default:
      return "";
  }
}

function parseOptionalInteger(value: string): number | undefined {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  const parsed = Number.parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function parseOptionalNumber(value: string): number | undefined {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  const parsed = Number.parseFloat(trimmed);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function normalizeDate(value: string): string | undefined {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);

  if (!match) {
    return trimmed;
  }

  const [, month, day, year] = match;

  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function formatDateForInput(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();

  return `${month}/${day}/${year}`;
}

function formatTodayForInput(): string {
  return formatDateForInput(new Date());
}

function formatDateTimeForInput(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${month}/${day}/${year} ${hour}:${minute}`;
}

function parseDateTimeInput(value: string): string | undefined {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  const isoDate = new Date(trimmed);

  if (!Number.isNaN(isoDate.getTime())) {
    return isoDate.toISOString();
  }

  const match =
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/.exec(
      trimmed,
    );

  if (!match) {
    return trimmed;
  }

  const [, month, day, year, hour, minute] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );

  return Number.isNaN(date.getTime()) ? trimmed : date.toISOString();
}

function getValidDateTimeInput(value: string): Date | null {
  const parsed = parseDateTimeInput(value);

  if (!parsed) {
    return null;
  }

  const date = new Date(parsed);

  return Number.isNaN(date.getTime()) ? null : date;
}

function getTriageFormSignature(form: FormState): string {
  if (!form.triageCategory.trim()) {
    return "";
  }

  return JSON.stringify({
    system: normalizeTriageSystem(form.triageSystem),
    category: normalizeTriageCategory(form.triageCategory),
    stage: normalizeTriageStage(form.triageStage),
    time: parseDateTimeInput(form.triageTime) ?? "",
    location: form.triageLocation.trim(),
    notes: form.triageNotes.trim(),
  });
}

function getTransportFormSignature(form: FormState): string {
  if (!form.transportRequired.trim()) {
    return "";
  }

  return JSON.stringify({
    required: normalizeTransportRequired(form.transportRequired),
    mode: normalizeTransportMode(form.transportMode),
    emsUnitType: normalizeEmsUnitType(form.emsUnitType),
    departed: parseDateTimeInput(form.departedSceneTime) ?? "",
    arrived: parseDateTimeInput(form.arrivedFacilityTime) ?? "",
    receivingFacilityId: form.healthcareFacilityId.trim(),
    notes: form.transportNotes.trim(),
  });
}

function parseDateInput(value: string): Date {
  const normalized = normalizeDate(value);

  if (!normalized) {
    return new Date();
  }

  const date = new Date(`${normalized}T00:00:00`);

  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function getValidDateInput(value: string): Date | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const normalized = normalizeDate(trimmed);

  if (!normalized || !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return null;
  }

  const date = new Date(`${normalized}T00:00:00`);

  return Number.isNaN(date.getTime()) ? null : date;
}

function isInRange(
  value: string,
  min: number,
  max: number,
): boolean {
  const parsed = parseOptionalNumber(value);

  return parsed === undefined || (parsed >= min && parsed <= max);
}

function generateCasualtyIdNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  const second = String(now.getSeconds()).padStart(2, "0");
  const millisecond = String(now.getMilliseconds()).padStart(3, "0");
  const suffix = Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase();

  return `CAS-${year}${month}${day}-${hour}${minute}${second}${millisecond}-${suffix}`;
}

function generateUuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
    /[xy]/g,
    (character) => {
      const random = Math.floor(Math.random() * 16);
      const value =
        character === "x" ? random : (random & 0x3) | 0x8;

      return value.toString(16);
    },
  );
}

function mapRecordToForm(
  record: CasualtyRecord,
  latestTriage?: CasualtyTriageHistoryItem,
  latestTransport?: CasualtyTransportHistoryItem,
): FormState {
  return {
    idNumber: valueOrEmpty(record.casualty.id_number),
    age: valueOrEmpty(record.casualty.estimated_age),
    firstName: valueOrEmpty(record.casualty.first_name),
    middleName: valueOrEmpty(record.casualty.middle_name),
    lastName: valueOrEmpty(record.casualty.last_name),
    sex: valueOrEmpty(record.casualty.sex),
    dateOfBirth: valueOrEmpty(record.casualty.date_of_birth),

    houseStreet: valueOrEmpty(record.casualty.house_street),
    barangay: valueOrEmpty(record.casualty.barangay),
    municipality: valueOrEmpty(record.casualty.municipality),
    province: valueOrEmpty(record.casualty.province),
    region: valueOrEmpty(record.casualty.region),

    incidentId: record.incident.id,
    incidentName: record.incident.incident_name,
    currentLocation: valueOrEmpty(record.current_location),
    evacuationCenterId: valueOrEmpty(record.evacuation_center_id),
    evacuationCenter: valueOrEmpty(
      record.evacuation_center
        ? formatEvacuationCenterLabel(record.evacuation_center)
        : record.evacuation_center_id,
    ),
    latitude: valueOrEmpty(record.latitude),
    longitude: valueOrEmpty(record.longitude),

    triageSystem: formatTriageSystem(latestTriage?.triage_system),
    triageCategory: titleCase(latestTriage?.triage_category),
    triageStage: formatTriageStage(latestTriage?.triage_stage),
    triageTime: latestTriage?.triaged_at
      ? formatDateTimeForInput(new Date(latestTriage.triaged_at))
      : "",
    triageLocation: valueOrEmpty(latestTriage?.location),
    triageNotes: valueOrEmpty(latestTriage?.notes),

    transportRequired: formatTransportRequired(
      latestTransport?.transport_required,
    ),
    transportMode: formatTransportMode(latestTransport?.transport_mode),
    emsUnitType: formatEmsUnitType(latestTransport?.ems_unit_type),
    departedSceneTime: latestTransport?.departed_scene_at
      ? formatDateTimeForInput(
          new Date(latestTransport.departed_scene_at),
        )
      : "",
    arrivedFacilityTime: latestTransport?.arrived_facility_at
      ? formatDateTimeForInput(
          new Date(latestTransport.arrived_facility_at),
        )
      : "",
    transportNotes: valueOrEmpty(latestTransport?.notes),

    casualtyStatus: titleCase(record.current_status),
    severity: titleCase(record.severity),
    healthcareFacilityId: valueOrEmpty(
      latestTransport?.receiving_facility_id ??
        record.healthcare_facility_id,
    ),
    healthcareFacility: valueOrEmpty(
      latestTransport?.receiving_facility
        ? formatHealthcareFacilityLabel(
            latestTransport.receiving_facility,
          )
        : record.healthcare_facility
          ? formatHealthcareFacilityLabel(record.healthcare_facility)
          : record.healthcare_facility_id,
    ),
    hospitalName: valueOrEmpty(record.hospital_name),
    visibleInjury: valueOrEmpty(record.visible_injury),
    medicalCondition: valueOrEmpty(record.medical_condition),
    assistanceNeeded: valueOrEmpty(record.assistance_needed),
    assistanceProvided: valueOrEmpty(record.assistance_provided),

    remarks: valueOrEmpty(record.remarks),
  };
}

type FieldProps = {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
  keyboardType?: "default" | "numeric" | "phone-pad";
  multiline?: boolean;
  editable?: boolean;
};

function FormField({
  label,
  value,
  placeholder,
  onChangeText,
  keyboardType = "default",
  multiline = false,
  editable = true,
}: FieldProps) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.muted}
        keyboardType={keyboardType}
        multiline={multiline}
        editable={editable}
        textAlignVertical={multiline ? "top" : "center"}
        style={[
          styles.input,
          !editable && styles.inputDisabled,
          multiline && styles.multilineInput,
        ]}
      />
    </View>
  );
}

type SelectFieldProps = {
  label: string;
  value: string;
  placeholder: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

function SelectField({
  label,
  value,
  placeholder,
  icon = "chevron-down-outline",
  onPress,
}: SelectFieldProps) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>

      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.selectInput,
          pressed && styles.pressed,
        ]}
      >
        <Text
          style={[
            styles.selectText,
            !value && styles.placeholderText,
          ]}
        >
          {value || placeholder}
        </Text>

        <Ionicons
          name={icon}
          size={18}
          color={COLORS.secondaryText}
        />
      </Pressable>
    </View>
  );
}

type ChoiceOption = {
  key?: string;
  label: string;
  selected: boolean;
  onSelect: () => void;
};

type ChoiceSheetProps = {
  visible: boolean;
  title: string;
  options: ChoiceOption[];
  searchQuery: string;
  searchable?: boolean;
  onSearchChange: (value: string) => void;
  onClose: () => void;
};

function ChoiceSheet({
  visible,
  title,
  options,
  searchQuery,
  searchable = false,
  onSearchChange,
  onClose,
}: ChoiceSheetProps) {
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredOptions =
    searchable && normalizedSearch.length > 0
      ? options.filter((option) =>
          option.label.toLowerCase().includes(normalizedSearch),
        )
      : options;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.choiceSheet}>
          <View style={styles.sheetHandle} />

          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>

            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.sheetCloseButton,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Close options"
            >
              <Ionicons
                name="close"
                size={20}
                color={COLORS.secondaryText}
              />
            </Pressable>
          </View>

          {searchable ? (
            <View style={styles.sheetSearchBar}>
              <Ionicons
                name="search-outline"
                size={18}
                color={COLORS.secondaryText}
              />

              <TextInput
                value={searchQuery}
                onChangeText={onSearchChange}
                style={styles.sheetSearchInput}
                placeholder="Search options..."
                placeholderTextColor={COLORS.muted}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          ) : null}

          <ScrollView
            contentContainerStyle={styles.choiceList}
            showsVerticalScrollIndicator={false}
          >
            {filteredOptions.length === 0 ? (
              <View style={styles.choiceEmptyState}>
                <Text style={styles.choiceEmptyTitle}>
                  No options found
                </Text>
                <Text style={styles.choiceEmptyText}>
                  Create a new option first, then it will appear here.
                </Text>
              </View>
            ) : null}

            {filteredOptions.map((option) => (
              <Pressable
                key={option.key ?? option.label}
                onPress={() => {
                  option.onSelect();
                  onClose();
                }}
                style={({ pressed }) => [
                  styles.choiceOption,
                  option.selected && styles.choiceOptionSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.choiceOptionText,
                    option.selected &&
                      styles.choiceOptionTextSelected,
                  ]}
                >
                  {option.label}
                </Text>

                {option.selected ? (
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={COLORS.maroon}
                  />
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

type DatePickerSheetProps = {
  visible: boolean;
  value: string;
  onSelect: (value: string) => void;
  onClose: () => void;
};

function DatePickerSheet({
  visible,
  value,
  onSelect,
  onClose,
}: DatePickerSheetProps) {
  const [visibleMonth, setVisibleMonth] = useState(() =>
    parseDateInput(value),
  );

  useEffect(() => {
    if (visible) {
      setVisibleMonth(parseDateInput(value));
    }
  }, [value, visible]);

  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const selectedDate = parseDateInput(value);

  const dayCells = [
    ...Array.from({ length: firstDay }, (_, index) => ({
      key: `empty-${index}`,
      day: null,
    })),
    ...Array.from({ length: daysInMonth }, (_, index) => ({
      key: `day-${index + 1}`,
      day: index + 1,
    })),
  ];

  function moveMonth(offset: number) {
    setVisibleMonth((current) => {
      const next = new Date(current);
      next.setMonth(current.getMonth() + offset);
      return next;
    });
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.dateSheet}>
          <View style={styles.sheetHandle} />

          <View style={styles.dateHeader}>
            <Pressable
              onPress={() => moveMonth(-1)}
              style={styles.dateArrowButton}
            >
              <Ionicons
                name="chevron-back"
                size={20}
                color={COLORS.maroon}
              />
            </Pressable>

            <Text style={styles.dateTitle}>
              {MONTH_NAMES[month]} {year}
            </Text>

            <Pressable
              onPress={() => moveMonth(1)}
              style={styles.dateArrowButton}
            >
              <Ionicons
                name="chevron-forward"
                size={20}
                color={COLORS.maroon}
              />
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {["S", "M", "T", "W", "T", "F", "S"].map(
              (day, index) => (
                <Text
                  key={`${day}-${index}`}
                  style={styles.weekLabel}
                >
                  {day}
                </Text>
              ),
            )}
          </View>

          <View style={styles.dayGrid}>
            {dayCells.map((cell) => {
              const isSelected =
                cell.day !== null &&
                selectedDate.getFullYear() === year &&
                selectedDate.getMonth() === month &&
                selectedDate.getDate() === cell.day;

              return (
                <Pressable
                  key={cell.key}
                  disabled={cell.day === null}
                  onPress={() => {
                    if (cell.day === null) {
                      return;
                    }

                    onSelect(
                      formatDateForInput(
                        new Date(year, month, cell.day),
                      ),
                    );
                    onClose();
                  }}
                  style={[
                    styles.dayCell,
                    isSelected && styles.dayCellSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      isSelected && styles.dayTextSelected,
                    ]}
                  >
                    {cell.day ?? ""}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => {
              onSelect(formatTodayForInput());
              onClose();
            }}
            style={styles.todayButton}
          >
            <Text style={styles.todayButtonText}>Use Today</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function AddCasualtyScreen() {
  const { editId } = useLocalSearchParams<{
    editId?: string;
  }>();

  const casualtyId = Array.isArray(editId) ? editId[0] : editId;
  const isEditing = Boolean(casualtyId);
  const [currentStep, setCurrentStep] = useState(0);
  const [form, setForm] = useState<FormState>(() => ({
    ...initialForm,
    idNumber: isEditing ? "" : generateCasualtyIdNumber(),
    triageSystem: isEditing ? "" : "START",
    triageStage: isEditing ? "" : "On-site",
    triageTime: isEditing ? "" : formatDateTimeForInput(new Date()),
    transportRequired: isEditing ? "" : "Unknown",
    transportMode: isEditing ? "" : "Unknown",
    emsUnitType: isEditing ? "" : "Unknown",
  }));
  const [isLoadingRecord, setIsLoadingRecord] =
    useState(isEditing);
  const [initialTriageSignature, setInitialTriageSignature] =
    useState("");
  const [initialTransportSignature, setInitialTransportSignature] =
    useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeChoiceSheet, setActiveChoiceSheet] =
    useState<ChoiceSheetName | null>(null);
  const [choiceSearchQuery, setChoiceSearchQuery] = useState("");
  const [isDatePickerVisible, setIsDatePickerVisible] =
    useState(false);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoadingIncidents, setIsLoadingIncidents] =
    useState(false);
  const [incidentError, setIncidentError] =
    useState<string | null>(null);
  const [newIncidentName, setNewIncidentName] = useState("");
  const [newIncidentType, setNewIncidentType] = useState("");
  const [isCreatingIncident, setIsCreatingIncident] =
    useState(false);
  const [evacuationCenters, setEvacuationCenters] = useState<
    EvacuationCenter[]
  >([]);
  const [isLoadingEvacuationCenters, setIsLoadingEvacuationCenters] =
    useState(false);
  const [evacuationCenterError, setEvacuationCenterError] =
    useState<string | null>(null);
  const [newEvacuationCenterName, setNewEvacuationCenterName] =
    useState("");
  const [newEvacuationCenterAddress, setNewEvacuationCenterAddress] =
    useState("");
  const [
    newEvacuationCenterCapacity,
    setNewEvacuationCenterCapacity,
  ] = useState("");
  const [isCreatingEvacuationCenter, setIsCreatingEvacuationCenter] =
    useState(false);
  const [healthcareFacilities, setHealthcareFacilities] = useState<
    HealthcareFacility[]
  >([]);
  const [isLoadingHealthcareFacilities, setIsLoadingHealthcareFacilities] =
    useState(false);
  const [healthcareFacilityError, setHealthcareFacilityError] =
    useState<string | null>(null);
  const [newHealthcareFacilityName, setNewHealthcareFacilityName] =
    useState("");
  const [newHealthcareFacilityLevel, setNewHealthcareFacilityLevel] =
    useState("");
  const [
    newHealthcareFacilityAddress,
    setNewHealthcareFacilityAddress,
  ] = useState("");
  const [
    isCreatingHealthcareFacility,
    setIsCreatingHealthcareFacility,
  ] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(
    null,
  );
  const [currentUserRole, setCurrentUserRole] = useState<
    string | null
  >(null);
  const [selectedPhoto, setSelectedPhoto] =
    useState<SelectedPhoto | null>(null);
  const [isCapturingLocation, setIsCapturingLocation] =
    useState(false);

  const stepName: StepName = STEPS[currentStep];
  const screenTitle = isEditing ? "Edit Casualty" : "Add Casualty";
  const finalActionLabel = isEditing
    ? "Save Changes"
    : "Submit Casualty";
  const hasGpsCoordinates =
    form.latitude.trim().length > 0 &&
    form.longitude.trim().length > 0;
  const locationActionLabel = hasGpsCoordinates
    ? "Update current GPS location"
    : "Use current GPS location";
  const canManageReferenceData =
    currentUserRole !== null &&
    REFERENCE_MANAGER_ROLES.includes(
      currentUserRole as (typeof REFERENCE_MANAGER_ROLES)[number],
    );

  const personPayload = useMemo<CreateCasualtyPayload["person"]>(
    () => ({
      idNumber: form.idNumber,
      identificationStatus:
        form.firstName.trim() || form.lastName.trim()
          ? "identified"
          : "unidentified",
      firstName: form.firstName,
      middleName: form.middleName,
      lastName: form.lastName,
      dateOfBirth: normalizeDate(form.dateOfBirth),
      estimatedAge: parseOptionalInteger(form.age),
      sex: form.sex,
      houseStreet: form.houseStreet,
      barangay: form.barangay,
      municipality: form.municipality,
      province: form.province,
      region: form.region,
    }),
    [form],
  );

  const incidentDetailsPayload = useMemo<
    CreateCasualtyPayload["incidentDetails"]
  >(
    () => ({
      currentStatus: normalizeStatus(form.casualtyStatus),
      severity: normalizeSeverity(form.severity),
      evacuationCenterId:
        form.evacuationCenterId || undefined,
      healthcareFacilityId:
        form.healthcareFacilityId || undefined,
      currentLocation: form.currentLocation,
      hospitalName: form.hospitalName,
      visibleInjury: form.visibleInjury,
      medicalCondition: form.medicalCondition,
      assistanceNeeded: form.assistanceNeeded,
      assistanceProvided: form.assistanceProvided,
      remarks: form.remarks,
      latitude: parseOptionalNumber(form.latitude),
      longitude: parseOptionalNumber(form.longitude),
    }),
    [form],
  );

  const triageAssessmentPayload = useMemo<
    CreateCasualtyPayload["triageAssessment"]
  >(() => {
    if (!form.triageCategory.trim()) {
      return undefined;
    }

    if (
      isEditing &&
      getTriageFormSignature(form) === initialTriageSignature
    ) {
      return undefined;
    }

    return {
      triageSystem: normalizeTriageSystem(form.triageSystem),
      triageCategory: normalizeTriageCategory(form.triageCategory),
      triageStage: normalizeTriageStage(form.triageStage),
      triagedAt: parseDateTimeInput(form.triageTime),
      location: form.triageLocation || form.currentLocation,
      notes: form.triageNotes,
    };
  }, [form, initialTriageSignature, isEditing]);

  const transportRecordPayload = useMemo<
    CreateCasualtyPayload["transportRecord"]
  >(() => {
    if (!form.transportRequired.trim()) {
      return undefined;
    }

    if (
      isEditing &&
      getTransportFormSignature(form) === initialTransportSignature
    ) {
      return undefined;
    }

    return {
      transportRequired: normalizeTransportRequired(
        form.transportRequired,
      ),
      transportMode: normalizeTransportMode(form.transportMode),
      emsUnitType: normalizeEmsUnitType(form.emsUnitType),
      departedSceneAt: parseDateTimeInput(form.departedSceneTime),
      arrivedFacilityAt: parseDateTimeInput(form.arrivedFacilityTime),
      receivingFacilityId: form.healthcareFacilityId || undefined,
      notes: form.transportNotes,
    };
  }, [form, initialTransportSignature, isEditing]);

  const updatePayload = useMemo<UpdateCasualtyPayload>(
    () => ({
      incidentId: form.incidentId || undefined,
      person: personPayload,
      incidentDetails: incidentDetailsPayload,
      triageAssessment: triageAssessmentPayload,
      transportRecord: transportRecordPayload,
    }),
    [
      form.incidentId,
      incidentDetailsPayload,
      personPayload,
      triageAssessmentPayload,
      transportRecordPayload,
    ],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadCurrentUser() {
      const user = await getCurrentUser();

      if (isMounted) {
        setCurrentUserId(user?.id ?? null);
        setCurrentUserRole(user?.role ?? null);
      }
    }

    void loadCurrentUser();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadIncidentOptions() {
      try {
        setIsLoadingIncidents(true);
        setIncidentError(null);

        const data = await getIncidents();

        if (isMounted) {
          setIncidents(data);
        }
      } catch (error) {
        console.error("Failed to load incidents:", error);

        if (isMounted) {
          setIncidentError(
            error instanceof Error
              ? error.message
              : "Unable to load disaster incidents.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingIncidents(false);
        }
      }
    }

    void loadIncidentOptions();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadEvacuationCenterOptions() {
      if (!form.incidentId) {
        setEvacuationCenters([]);
        setEvacuationCenterError(null);
        return;
      }

      try {
        setIsLoadingEvacuationCenters(true);
        setEvacuationCenterError(null);

        const data = await getEvacuationCenters(form.incidentId);

        if (isMounted) {
          setEvacuationCenters(data);
        }
      } catch (error) {
        console.error("Failed to load evacuation centers:", error);

        if (isMounted) {
          setEvacuationCenterError(
            error instanceof Error
              ? error.message
              : "Unable to load evacuation centers.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingEvacuationCenters(false);
        }
      }
    }

    void loadEvacuationCenterOptions();

    return () => {
      isMounted = false;
    };
  }, [form.incidentId]);

  useEffect(() => {
    let isMounted = true;

    async function loadHealthcareFacilityOptions() {
      try {
        setIsLoadingHealthcareFacilities(true);
        setHealthcareFacilityError(null);

        const data = await getHealthcareFacilities();

        if (isMounted) {
          setHealthcareFacilities(data);
        }
      } catch (error) {
        console.error("Failed to load healthcare facilities:", error);

        if (isMounted) {
          setHealthcareFacilityError(
            error instanceof Error
              ? error.message
              : "Unable to load healthcare facilities.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingHealthcareFacilities(false);
        }
      }
    }

    void loadHealthcareFacilityOptions();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadEditableRecord() {
      if (!casualtyId) {
        setIsLoadingRecord(false);
        return;
      }

      try {
        setIsLoadingRecord(true);
        setLoadError(null);

        const [record, triageHistory, transportHistory] =
          await Promise.all([
            getCasualty(casualtyId),
            getCasualtyTriageHistory(casualtyId),
            getCasualtyTransportHistory(casualtyId),
          ]);

        if (isMounted) {
          const mappedForm = mapRecordToForm(
            record,
            triageHistory[0],
            transportHistory[0],
          );
          setForm(mappedForm);
          setInitialTriageSignature(
            getTriageFormSignature(mappedForm),
          );
          setInitialTransportSignature(
            getTransportFormSignature(mappedForm),
          );
        }
      } catch (error) {
        console.error("Failed to load casualty for editing:", error);

        if (isMounted) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Unable to load casualty for editing.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingRecord(false);
        }
      }
    }

    void loadEditableRecord();

    return () => {
      isMounted = false;
    };
  }, [casualtyId]);

  function updateField<K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function openChoiceSheet(sheetName: ChoiceSheetName) {
    setChoiceSearchQuery("");
    setActiveChoiceSheet(sheetName);
  }

  function isActiveChoiceSheetSearchable(): boolean {
    return (
      activeChoiceSheet === "incident" ||
      activeChoiceSheet === "evacuationCenter" ||
      activeChoiceSheet === "healthcareFacility"
    );
  }

  function validateCurrentStep(): boolean {
    switch (stepName) {
      case "Personal":
        if (!form.firstName.trim() && !form.lastName.trim()) {
          Alert.alert(
            "Name required",
            "Enter at least a first name or last name before continuing.",
          );
          return false;
        }

        if (!form.sex.trim()) {
          Alert.alert(
            "Sex required",
            "Select the casualty sex before continuing.",
          );
          return false;
        }

        if (form.dateOfBirth.trim()) {
          const dateOfBirth = getValidDateInput(form.dateOfBirth);

          if (!dateOfBirth) {
            Alert.alert(
              "Invalid date of birth",
              "Enter a valid date using mm/dd/yyyy.",
            );
            return false;
          }

          if (dateOfBirth > new Date()) {
            Alert.alert(
              "Invalid date of birth",
              "Date of birth cannot be in the future.",
            );
            return false;
          }
        }

        return true;

      case "Address":
        if (!form.barangay.trim() || !form.municipality.trim()) {
          Alert.alert(
            "Address required",
            "Enter the barangay and municipality or city before continuing.",
          );
          return false;
        }

        return true;

      case "Incident":
        if (!form.incidentId) {
          Alert.alert(
            "Incident required",
            "Choose or create a disaster incident before continuing.",
          );
          return false;
        }

        if (!form.currentLocation.trim()) {
          Alert.alert(
            "Current location required",
            "Enter where the casualty was found before continuing.",
          );
          return false;
        }

        if (!isInRange(form.latitude, -90, 90)) {
          Alert.alert(
            "Invalid latitude",
            "Latitude must be from -90 to 90.",
          );
          return false;
        }

        if (!isInRange(form.longitude, -180, 180)) {
          Alert.alert(
            "Invalid longitude",
            "Longitude must be from -180 to 180.",
          );
          return false;
        }

        return true;

      case "Triage":
        if (!form.triageSystem.trim()) {
          Alert.alert(
            "Triage system required",
            "Select the triage system used for this casualty.",
          );
          return false;
        }

        if (!form.triageCategory.trim()) {
          Alert.alert(
            "Triage category required",
            "Select the casualty triage category before continuing.",
          );
          return false;
        }

        if (!form.triageStage.trim()) {
          Alert.alert(
            "Triage stage required",
            "Select whether this triage was on-site, facility arrival, or reassessment.",
          );
          return false;
        }

        if (!form.triageTime.trim()) {
          Alert.alert(
            "Triage time required",
            "Enter the time this triage assessment was performed.",
          );
          return false;
        }

        if (!getValidDateTimeInput(form.triageTime)) {
          Alert.alert(
            "Invalid triage time",
            "Enter triage time using mm/dd/yyyy hh:mm.",
          );
          return false;
        }

        return true;

      case "Transport": {
        if (!form.transportRequired.trim()) {
          Alert.alert(
            "Transport status required",
            "Select whether this casualty requires transport.",
          );
          return false;
        }

        const transportRequired = normalizeTransportRequired(
          form.transportRequired,
        );
        const transportMode = normalizeTransportMode(form.transportMode);

        if (
          transportRequired === "yes" &&
          transportMode === "unknown"
        ) {
          Alert.alert(
            "Transport mode required",
            "Select EMS, private vehicle, independent, walk-in, or other.",
          );
          return false;
        }

        if (
          transportRequired === "yes" &&
          !form.healthcareFacilityId
        ) {
          Alert.alert(
            "Receiving facility required",
            "Select or create the receiving healthcare facility before continuing.",
          );
          return false;
        }

        if (
          transportMode === "ems" &&
          !form.emsUnitType.trim()
        ) {
          Alert.alert(
            "EMS unit type required",
            "Select BLS, ALS, other, or unknown for EMS transport.",
          );
          return false;
        }

        const departedSceneAt = form.departedSceneTime.trim()
          ? getValidDateTimeInput(form.departedSceneTime)
          : null;
        const arrivedFacilityAt = form.arrivedFacilityTime.trim()
          ? getValidDateTimeInput(form.arrivedFacilityTime)
          : null;

        if (form.departedSceneTime.trim() && !departedSceneAt) {
          Alert.alert(
            "Invalid departed time",
            "Enter departed scene time using mm/dd/yyyy hh:mm.",
          );
          return false;
        }

        if (form.arrivedFacilityTime.trim() && !arrivedFacilityAt) {
          Alert.alert(
            "Invalid arrival time",
            "Enter arrived facility time using mm/dd/yyyy hh:mm.",
          );
          return false;
        }

        if (
          departedSceneAt &&
          arrivedFacilityAt &&
          arrivedFacilityAt < departedSceneAt
        ) {
          Alert.alert(
            "Invalid transport times",
            "Arrived facility time cannot be before departed scene time.",
          );
          return false;
        }

        return true;
      }

      case "Status":
        if (!form.casualtyStatus.trim()) {
          Alert.alert(
            "Casualty status required",
            "Select the casualty status before continuing.",
          );
          return false;
        }

        return true;

      case "Remarks":
        return true;
    }
  }

  async function handleCreateIncident() {
    const incidentName = newIncidentName.trim();
    const disasterType = newIncidentType.trim();

    if (!currentUserId) {
      Alert.alert(
        "Unable to create incident",
        "Please log in again before creating an incident.",
      );
      return;
    }

    if (!canManageReferenceData) {
      Alert.alert(
        "Permission required",
        "Your account is not allowed to create disaster incidents.",
      );
      return;
    }

    if (!incidentName || !disasterType) {
      Alert.alert(
        "Complete incident details",
        "Enter both the disaster incident name and disaster type.",
      );
      return;
    }

    try {
      setIsCreatingIncident(true);
      setIncidentError(null);

      const incident = await createIncident({
        incidentName,
        disasterType,
        province: form.province || undefined,
        municipality: form.municipality || undefined,
        barangay: form.barangay || undefined,
      });

      setIncidents((current) => {
        const exists = current.some((item) => item.id === incident.id);

        return exists
          ? current.map((item) =>
              item.id === incident.id ? incident : item,
            )
          : [incident, ...current];
      });

      updateField("incidentId", incident.id);
      updateField("incidentName", incident.incident_name);
      setNewIncidentName("");
      setNewIncidentType("");

      Alert.alert(
        "Incident ready",
        "The disaster incident has been added and selected for this casualty.",
      );
    } catch (error) {
      console.error("Failed to create incident:", error);

      Alert.alert(
        "Unable to create incident",
        error instanceof Error
          ? error.message
          : "Please review the incident details and try again.",
      );
    } finally {
      setIsCreatingIncident(false);
    }
  }

  async function handleCreateEvacuationCenter() {
    const centerName = newEvacuationCenterName.trim();

    if (!form.incidentId) {
      Alert.alert(
        "Select an incident first",
        "Choose or create a disaster incident before adding an evacuation center.",
      );
      return;
    }

    if (!currentUserId) {
      Alert.alert(
        "Unable to create evacuation center",
        "Please log in again before creating an evacuation center.",
      );
      return;
    }

    if (!canManageReferenceData) {
      Alert.alert(
        "Permission required",
        "Your account is not allowed to create evacuation centers.",
      );
      return;
    }

    if (!centerName) {
      Alert.alert(
        "Enter center name",
        "Add the evacuation center name before creating it.",
      );
      return;
    }

    try {
      setIsCreatingEvacuationCenter(true);
      setEvacuationCenterError(null);

      const center = await createEvacuationCenter({
        incidentId: form.incidentId,
        centerName,
        address: newEvacuationCenterAddress || undefined,
        barangay: form.barangay || undefined,
        municipality: form.municipality || undefined,
        province: form.province || undefined,
        capacity: parseOptionalInteger(newEvacuationCenterCapacity),
      });

      setEvacuationCenters((current) => {
        const exists = current.some((item) => item.id === center.id);

        return exists
          ? current.map((item) =>
              item.id === center.id ? center : item,
            )
          : [center, ...current];
      });

      updateField("evacuationCenterId", center.id);
      updateField(
        "evacuationCenter",
        formatEvacuationCenterLabel(center),
      );
      setNewEvacuationCenterName("");
      setNewEvacuationCenterAddress("");
      setNewEvacuationCenterCapacity("");

      Alert.alert(
        "Evacuation center ready",
        "The evacuation center has been added and selected for this casualty.",
      );
    } catch (error) {
      console.error("Failed to create evacuation center:", error);

      Alert.alert(
        "Unable to create evacuation center",
        error instanceof Error
          ? error.message
          : "Please review the center details and try again.",
      );
    } finally {
      setIsCreatingEvacuationCenter(false);
    }
  }

  async function handleCreateHealthcareFacility() {
    const facilityName = newHealthcareFacilityName.trim();
    const facilityLevel =
      normalizeEnumValue(newHealthcareFacilityLevel) || "unknown";

    if (!currentUserId) {
      Alert.alert(
        "Unable to create healthcare facility",
        "Please log in again before creating a healthcare facility.",
      );
      return;
    }

    if (!canManageReferenceData) {
      Alert.alert(
        "Permission required",
        "Your account is not allowed to create healthcare facilities.",
      );
      return;
    }

    if (!facilityName) {
      Alert.alert(
        "Enter facility name",
        "Add the healthcare facility name before creating it.",
      );
      return;
    }

    try {
      setIsCreatingHealthcareFacility(true);
      setHealthcareFacilityError(null);

      const facility = await createHealthcareFacility({
        facilityName,
        facilityLevel,
        address: newHealthcareFacilityAddress || undefined,
        barangay: form.barangay || undefined,
        municipality: form.municipality || undefined,
        province: form.province || undefined,
      });

      setHealthcareFacilities((current) => {
        const exists = current.some((item) => item.id === facility.id);

        return exists
          ? current.map((item) =>
              item.id === facility.id ? facility : item,
            )
          : [facility, ...current];
      });

      updateField("healthcareFacilityId", facility.id);
      updateField(
        "healthcareFacility",
        formatHealthcareFacilityLabel(facility),
      );
      updateField("hospitalName", facility.facility_name);
      setNewHealthcareFacilityName("");
      setNewHealthcareFacilityLevel("");
      setNewHealthcareFacilityAddress("");

      Alert.alert(
        "Healthcare facility ready",
        "The healthcare facility has been added and selected for this casualty.",
      );
    } catch (error) {
      console.error("Failed to create healthcare facility:", error);

      Alert.alert(
        "Unable to create healthcare facility",
        error instanceof Error
          ? error.message
          : "Please review the facility details and try again.",
      );
    } finally {
      setIsCreatingHealthcareFacility(false);
    }
  }

  async function setPhotoFromPickerResult(
    result: ImagePicker.ImagePickerResult,
  ) {
    if (result.canceled || result.assets.length === 0) {
      return;
    }

    const asset = result.assets[0];
    const fallbackName = `casualty-photo-${Date.now()}.jpg`;

    setSelectedPhoto({
      uri: asset.uri,
      fileName: asset.fileName ?? fallbackName,
      mimeType: asset.mimeType ?? "image/jpeg",
      fileSize: asset.fileSize,
    });
  }

  async function pickPhotoFromLibrary() {
    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Photo permission needed",
        "Allow photo library access to attach a casualty photo.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.72,
      allowsEditing: false,
    });

    await setPhotoFromPickerResult(result);
  }

  async function takePhotoWithCamera() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Camera permission needed",
        "Allow camera access to capture a casualty photo.",
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.72,
      allowsEditing: false,
    });

    await setPhotoFromPickerResult(result);
  }

  function handlePickPhoto() {
    Alert.alert("Add casualty photo", "Choose a photo source.", [
      {
        text: "Camera",
        onPress: () => {
          void takePhotoWithCamera();
        },
      },
      {
        text: "Photo Library",
        onPress: () => {
          void pickPhotoFromLibrary();
        },
      },
      {
        text: "Cancel",
        style: "cancel",
      },
    ]);
  }

  async function handleUseCurrentLocation() {
    try {
      setIsCapturingLocation(true);

      const permission =
        await Location.requestForegroundPermissionsAsync();

      if (permission.status !== "granted") {
        Alert.alert(
          "Location permission needed",
          "Allow location access to capture the current GPS coordinates.",
        );
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      updateField(
        "latitude",
        position.coords.latitude.toFixed(7),
      );
      updateField(
        "longitude",
        position.coords.longitude.toFixed(7),
      );

      if (!form.currentLocation.trim()) {
        updateField(
          "currentLocation",
          `${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`,
        );
      }
    } catch (error) {
      console.error("Failed to capture location:", error);

      Alert.alert(
        "Unable to capture location",
        error instanceof Error
          ? error.message
          : "Please try again or enter the coordinates manually.",
      );
    } finally {
      setIsCapturingLocation(false);
    }
  }

  async function uploadSelectedPhoto(
    casualtyIncidentId: string,
  ): Promise<string | null> {
    if (!selectedPhoto) {
      return null;
    }

    try {
      const base64Data = await FileSystem.readAsStringAsync(
        selectedPhoto.uri,
        {
          encoding: FileSystem.EncodingType.Base64,
        },
      );

      await uploadAttachment({
        casualtyIncidentId,
        fileName: selectedPhoto.fileName,
        fileType: "photo",
        mimeType: selectedPhoto.mimeType,
        base64Data,
        fileSizeBytes: selectedPhoto.fileSize,
      });

      return null;
    } catch (error) {
      console.error("Failed to upload casualty photo:", error);

      return error instanceof Error
        ? error.message
        : "The photo could not be uploaded.";
    }
  }

  function getChoiceSheetTitle(): string {
    switch (activeChoiceSheet) {
      case "sex":
        return "Select Sex";
      case "incident":
        return "Select Disaster Incident";
      case "evacuationCenter":
        return "Select Evacuation Center";
      case "healthcareFacility":
        return "Select Healthcare Facility";
      case "disasterType":
        return "Select Disaster Type";
      case "facilityLevel":
        return "Select Facility Level";
      case "triageSystem":
        return "Select Triage System";
      case "triageCategory":
        return "Select Triage Category";
      case "triageStage":
        return "Select Triage Stage";
      case "transportRequired":
        return "Select Transport Status";
      case "transportMode":
        return "Select Transport Mode";
      case "emsUnitType":
        return "Select EMS Unit Type";
      case "casualtyStatus":
        return "Select Casualty Status";
      case "severity":
        return "Select Severity";
      default:
        return "";
    }
  }

  function getChoiceOptions(): ChoiceOption[] {
    switch (activeChoiceSheet) {
      case "sex":
        return SEX_OPTIONS.map((option) => ({
          label: option,
          selected:
            form.sex.toLowerCase() === option.toLowerCase(),
          onSelect: () => updateField("sex", option),
        }));

      case "incident": {
        const incidentOptions =
          incidents.length > 0
            ? incidents
            : form.incidentId && form.incidentName
              ? [
                  {
                    id: form.incidentId,
                    incident_name: form.incidentName,
                    incident_code: "",
                    disaster_type: "",
                    description: null,
                    province: null,
                    municipality: null,
                    barangay: null,
                    started_at: "",
                    ended_at: null,
                    status: "active" as const,
                  },
                ]
              : [];

        return incidentOptions.map((incident) => ({
          key: incident.id,
          label: incident.incident_name,
          selected: form.incidentId === incident.id,
          onSelect: () => {
            updateField("incidentId", incident.id);
            updateField("incidentName", incident.incident_name);
            updateField("evacuationCenterId", "");
            updateField("evacuationCenter", "");
          },
        }));
      }

      case "evacuationCenter": {
        const evacuationOptions =
          evacuationCenters.length > 0
            ? evacuationCenters
            : form.evacuationCenterId && form.evacuationCenter
              ? [
                  {
                    id: form.evacuationCenterId,
                    incident_id: form.incidentId,
                    center_name: form.evacuationCenter,
                    address: null,
                    barangay: null,
                    municipality: null,
                    province: null,
                    capacity: null,
                    contact_person: null,
                    contact_number: null,
                    latitude: null,
                    longitude: null,
                    is_active: true,
                    created_at: "",
                    updated_at: "",
                  },
                ]
              : [];

        return evacuationOptions.map((center) => ({
          key: center.id,
          label: formatEvacuationCenterLabel(center),
          selected: form.evacuationCenterId === center.id,
          onSelect: () => {
            updateField("evacuationCenterId", center.id);
            updateField(
              "evacuationCenter",
              formatEvacuationCenterLabel(center),
            );
          },
        }));
      }

      case "healthcareFacility": {
        const facilityOptions =
          healthcareFacilities.length > 0
            ? healthcareFacilities
            : form.healthcareFacilityId && form.healthcareFacility
              ? [
                  {
                    id: form.healthcareFacilityId,
                    facility_name: form.healthcareFacility,
                    facility_level: "unknown",
                    address: null,
                    barangay: null,
                    municipality: null,
                    province: null,
                    contact_person: null,
                    contact_number: null,
                    latitude: null,
                    longitude: null,
                    is_active: true,
                    created_at: "",
                    updated_at: "",
                  },
                ]
              : [];

        return facilityOptions.map((facility) => ({
          key: facility.id,
          label: formatHealthcareFacilityLabel(facility),
          selected: form.healthcareFacilityId === facility.id,
          onSelect: () => {
            updateField("healthcareFacilityId", facility.id);
            updateField(
              "healthcareFacility",
              formatHealthcareFacilityLabel(facility),
            );
            updateField("hospitalName", facility.facility_name);
          },
        }));
      }

      case "disasterType":
        return DISASTER_TYPE_OPTIONS.map((option) => ({
          label: option,
          selected:
            newIncidentType.toLowerCase() === option.toLowerCase(),
          onSelect: () => setNewIncidentType(option),
        }));

      case "facilityLevel":
        return FACILITY_LEVEL_OPTIONS.map((option) => ({
          label: option,
          selected:
            newHealthcareFacilityLevel.toLowerCase() ===
            option.toLowerCase(),
          onSelect: () => setNewHealthcareFacilityLevel(option),
        }));

      case "triageSystem":
        return TRIAGE_SYSTEM_OPTIONS.map((option) => ({
          label: option,
          selected:
            form.triageSystem.toLowerCase() ===
            option.toLowerCase(),
          onSelect: () => updateField("triageSystem", option),
        }));

      case "triageCategory":
        return TRIAGE_CATEGORY_OPTIONS.map((option) => ({
          label: option,
          selected:
            form.triageCategory.toLowerCase() ===
            option.toLowerCase(),
          onSelect: () => updateField("triageCategory", option),
        }));

      case "triageStage":
        return TRIAGE_STAGE_OPTIONS.map((option) => ({
          label: option,
          selected:
            form.triageStage.toLowerCase() === option.toLowerCase(),
          onSelect: () => updateField("triageStage", option),
        }));

      case "transportRequired":
        return TRANSPORT_REQUIRED_OPTIONS.map((option) => ({
          label: option,
          selected:
            form.transportRequired.toLowerCase() ===
            option.toLowerCase(),
          onSelect: () => updateField("transportRequired", option),
        }));

      case "transportMode":
        return TRANSPORT_MODE_OPTIONS.map((option) => ({
          label: option,
          selected:
            form.transportMode.toLowerCase() ===
            option.toLowerCase(),
          onSelect: () => updateField("transportMode", option),
        }));

      case "emsUnitType":
        return EMS_UNIT_TYPE_OPTIONS.map((option) => ({
          label: option,
          selected:
            form.emsUnitType.toLowerCase() === option.toLowerCase(),
          onSelect: () => updateField("emsUnitType", option),
        }));

      case "casualtyStatus":
        return STATUS_OPTIONS.map((option) => ({
          label: option,
          selected:
            form.casualtyStatus.toLowerCase() ===
            option.toLowerCase(),
          onSelect: () => updateField("casualtyStatus", option),
        }));

      case "severity":
        return SEVERITY_OPTIONS.map((option) => ({
          label: option,
          selected:
            form.severity.toLowerCase() === option.toLowerCase(),
          onSelect: () => updateField("severity", option),
        }));

      default:
        return [];
    }
  }

  async function handleSubmit() {
    if (!isEditing || !casualtyId) {
      if (!currentUserId) {
        Alert.alert(
          "Unable to submit casualty",
          "Please log in again before submitting this casualty.",
        );
        return;
      }

      if (!form.incidentId) {
        Alert.alert(
          "Select a disaster incident",
          "Choose or create a disaster incident before submitting this casualty.",
        );
        setCurrentStep(2);
        return;
      }

      try {
        setIsSubmitting(true);

        const payload: CreateCasualtyPayload = {
          clientRecordId: generateUuid(),
          incidentId: form.incidentId,
          person: personPayload,
          incidentDetails: incidentDetailsPayload,
          triageAssessment: triageAssessmentPayload,
          transportRecord: transportRecordPayload,
        };

        const response = await createCasualty(payload);

        const createdRecordId =
          response.data.casualtyIncident.id;

        const photoUploadError =
          await uploadSelectedPhoto(createdRecordId);

        Alert.alert(
          "Casualty submitted",
          photoUploadError
            ? `The casualty record was saved, but the photo upload failed: ${photoUploadError}`
            : "The casualty record has been saved successfully.",
          [
            {
              text: "OK",
              onPress: () =>
                router.replace(
                  `/casualty/${encodeURIComponent(createdRecordId)}` as never,
                ),
            },
          ],
        );
      } catch (error) {
        console.error("Failed to submit casualty:", error);

        if (isNetworkSubmissionError(error)) {
          await queueCasualtySubmission({
            clientRecordId: generateUuid(),
            incidentId: form.incidentId,
            person: personPayload,
            incidentDetails: incidentDetailsPayload,
            triageAssessment: triageAssessmentPayload,
            transportRecord: transportRecordPayload,
          });

          Alert.alert(
            "Saved offline",
            "The casualty record was saved on this device and will sync when the connection is available.",
          );
          return;
        }

        Alert.alert(
          "Unable to submit casualty",
          error instanceof Error
            ? error.message
            : "Please review the record and try again.",
        );
      } finally {
        setIsSubmitting(false);
      }

      return;
    }

    try {
      setIsSubmitting(true);

      await updateCasualty(casualtyId, updatePayload);
      const photoUploadError = await uploadSelectedPhoto(casualtyId);

      Alert.alert(
        "Casualty updated",
        photoUploadError
          ? `The casualty record was saved, but the photo upload failed: ${photoUploadError}`
          : "The casualty record has been saved successfully.",
        [
          {
            text: "OK",
            onPress: () =>
              router.replace(
                `/casualty/${encodeURIComponent(casualtyId)}` as never,
              ),
          },
        ],
      );
    } catch (error) {
      console.error("Failed to update casualty:", error);

      Alert.alert(
        "Unable to save changes",
        error instanceof Error
          ? error.message
          : "Please review the record and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function goNext() {
    if (!validateCurrentStep()) {
      return;
    }

    if (currentStep < STEPS.length - 1) {
      setCurrentStep((step) => step + 1);
      return;
    }

    void handleSubmit();
  }

  function goBack() {
    if (currentStep > 0) {
      setCurrentStep((step) => step - 1);
      return;
    }

    router.back();
  }

  function renderPersonalStep() {
    return (
      <>
        <View style={styles.twoColumnRow}>
          <View style={styles.halfColumn}>
            <FormField
              label="ID NUMBER"
              value={form.idNumber}
              placeholder="Auto generated"
              editable={false}
              onChangeText={(value) =>
                updateField("idNumber", value)
              }
            />
          </View>

          <View style={styles.halfColumn}>
            <FormField
              label="AGE"
              value={form.age}
              placeholder="Age"
              keyboardType="numeric"
              onChangeText={(value) =>
                updateField("age", value)
              }
            />
          </View>
        </View>

        <FormField
          label="FIRST NAME"
          value={form.firstName}
          placeholder="First name"
          onChangeText={(value) =>
            updateField("firstName", value)
          }
        />

        <FormField
          label="MIDDLE NAME"
          value={form.middleName}
          placeholder="Middle name"
          onChangeText={(value) =>
            updateField("middleName", value)
          }
        />

        <FormField
          label="LAST NAME"
          value={form.lastName}
          placeholder="Last name"
          onChangeText={(value) =>
            updateField("lastName", value)
          }
        />

        <View style={styles.twoColumnRow}>
          <View style={styles.halfColumn}>
            <SelectField
              label="SEX"
              value={form.sex}
              placeholder="Select sex"
              onPress={() => openChoiceSheet("sex")}
            />
          </View>

          <View style={styles.halfColumn}>
            <SelectField
              label="DATE OF BIRTH"
              value={form.dateOfBirth}
              placeholder="mm/dd/yyyy"
              icon="calendar-outline"
              onPress={() => setIsDatePickerVisible(true)}
            />
          </View>
        </View>
      </>
    );
  }

  function renderAddressStep() {
    return (
      <>
        <FormField
          label="HOUSE / STREET"
          value={form.houseStreet}
          placeholder="House number, street, subdivision"
          onChangeText={(value) =>
            updateField("houseStreet", value)
          }
        />

        <FormField
          label="BARANGAY"
          value={form.barangay}
          placeholder="Barangay"
          onChangeText={(value) =>
            updateField("barangay", value)
          }
        />

        <FormField
          label="MUNICIPALITY / CITY"
          value={form.municipality}
          placeholder="Municipality or city"
          onChangeText={(value) =>
            updateField("municipality", value)
          }
        />

        <FormField
          label="PROVINCE"
          value={form.province}
          placeholder="Province"
          onChangeText={(value) =>
            updateField("province", value)
          }
        />

        <FormField
          label="REGION"
          value={form.region}
          placeholder="Region"
          onChangeText={(value) =>
            updateField("region", value)
          }
        />
      </>
    );
  }

  function renderIncidentStep() {
    return (
      <>
        <SelectField
          label="DISASTER INCIDENT"
          value={form.incidentName || form.incidentId}
          placeholder={
            isLoadingIncidents
              ? "Loading active incidents..."
              : "Select active incident"
          }
          onPress={() => openChoiceSheet("incident")}
        />

        {incidentError ? (
          <View style={styles.inlineWarning}>
            <Ionicons
              name="alert-circle-outline"
              size={18}
              color={COLORS.maroon}
            />
            <Text style={styles.inlineWarningText}>
              {incidentError}
            </Text>
          </View>
        ) : null}

        {canManageReferenceData ? (
          <View style={styles.quickCreateCard}>
            <View style={styles.quickCreateHeader}>
              <Ionicons
                name="add-circle-outline"
                size={20}
                color={COLORS.maroon}
              />
              <Text style={styles.quickCreateTitle}>
                Quick create incident
              </Text>
            </View>

            <FormField
              label="NEW INCIDENT NAME"
              value={newIncidentName}
              placeholder="e.g. Flood in Barangay San Isidro"
              onChangeText={setNewIncidentName}
            />

            <SelectField
              label="DISASTER TYPE"
              value={newIncidentType}
              placeholder="Select disaster type"
              onPress={() => openChoiceSheet("disasterType")}
            />

            <Pressable
              disabled={isCreatingIncident}
              onPress={() => {
                void handleCreateIncident();
              }}
              style={({ pressed }) => [
                styles.createIncidentButton,
                isCreatingIncident && styles.disabledButton,
                pressed && styles.primaryButtonPressed,
              ]}
            >
              <Text style={styles.createIncidentButtonText}>
                {isCreatingIncident
                  ? "Creating incident..."
                  : "Create and select incident"}
              </Text>

              {isCreatingIncident ? (
                <ActivityIndicator
                  size="small"
                  color={COLORS.white}
                />
              ) : (
                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color={COLORS.white}
                />
              )}
            </Pressable>
          </View>
        ) : null}

        <FormField
          label="CURRENT LOCATION"
          value={form.currentLocation}
          placeholder="Where the casualty was found"
          onChangeText={(value) =>
            updateField("currentLocation", value)
          }
        />

        <SelectField
          label="EVACUATION CENTER"
          value={form.evacuationCenter}
          placeholder={
            !form.incidentId
              ? "Select incident first"
              : isLoadingEvacuationCenters
                ? "Loading evacuation centers..."
                : "Select evacuation center"
          }
          onPress={() =>
            openChoiceSheet("evacuationCenter")
          }
        />

        {evacuationCenterError ? (
          <View style={styles.inlineWarning}>
            <Ionicons
              name="alert-circle-outline"
              size={18}
              color={COLORS.maroon}
            />
            <Text style={styles.inlineWarningText}>
              {evacuationCenterError}
            </Text>
          </View>
        ) : null}

        {canManageReferenceData ? (
          <View style={styles.quickCreateCard}>
            <View style={styles.quickCreateHeader}>
              <Ionicons
                name="business-outline"
                size={20}
                color={COLORS.maroon}
              />
              <Text style={styles.quickCreateTitle}>
                Quick create evacuation center
              </Text>
            </View>

            <FormField
              label="CENTER NAME"
              value={newEvacuationCenterName}
              placeholder="e.g. San Isidro Covered Court"
              onChangeText={setNewEvacuationCenterName}
            />

            <FormField
              label="ADDRESS"
              value={newEvacuationCenterAddress}
              placeholder="Street, building, or landmark"
              onChangeText={setNewEvacuationCenterAddress}
            />

            <FormField
              label="CAPACITY"
              value={newEvacuationCenterCapacity}
              placeholder="Estimated capacity"
              keyboardType="numeric"
              onChangeText={setNewEvacuationCenterCapacity}
            />

            <Pressable
              disabled={
                isCreatingEvacuationCenter || !form.incidentId
              }
              onPress={() => {
                void handleCreateEvacuationCenter();
              }}
              style={({ pressed }) => [
                styles.createIncidentButton,
                (isCreatingEvacuationCenter || !form.incidentId) &&
                  styles.disabledButton,
                pressed && styles.primaryButtonPressed,
              ]}
            >
              <Text style={styles.createIncidentButtonText}>
                {isCreatingEvacuationCenter
                  ? "Creating center..."
                  : "Create and select center"}
              </Text>

              {isCreatingEvacuationCenter ? (
                <ActivityIndicator
                  size="small"
                  color={COLORS.white}
                />
              ) : (
                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color={COLORS.white}
                />
              )}
            </Pressable>
          </View>
        ) : null}

        <View style={styles.twoColumnRow}>
          <View style={styles.halfColumn}>
            <FormField
              label="LATITUDE"
              value={form.latitude}
              placeholder="14.5995"
              keyboardType="numeric"
              onChangeText={(value) =>
                updateField("latitude", value)
              }
            />
          </View>

          <View style={styles.halfColumn}>
            <FormField
              label="LONGITUDE"
              value={form.longitude}
              placeholder="120.9842"
              keyboardType="numeric"
              onChangeText={(value) =>
                updateField("longitude", value)
              }
            />
          </View>
        </View>

        <Pressable
          disabled={isCapturingLocation}
          onPress={() => {
            void handleUseCurrentLocation();
          }}
          style={[
            styles.locationButton,
            isCapturingLocation && styles.disabledButton,
          ]}
        >
          {isCapturingLocation ? (
            <ActivityIndicator
              size="small"
              color={COLORS.maroon}
            />
          ) : (
            <Ionicons
              name="locate-outline"
              size={19}
              color={COLORS.maroon}
            />
          )}
          <Text style={styles.locationButtonText}>
            {isCapturingLocation
              ? "Capturing GPS location..."
              : locationActionLabel}
          </Text>
        </Pressable>
      </>
    );
  }

  function renderTriageStep() {
    return (
      <>
        <SelectField
          label="TRIAGE SYSTEM"
          value={form.triageSystem}
          placeholder="Select triage system"
          onPress={() => openChoiceSheet("triageSystem")}
        />

        <SelectField
          label="TRIAGE CATEGORY"
          value={form.triageCategory}
          placeholder="Select triage category"
          onPress={() => openChoiceSheet("triageCategory")}
        />

        <SelectField
          label="TRIAGE STAGE"
          value={form.triageStage}
          placeholder="Select triage stage"
          onPress={() => openChoiceSheet("triageStage")}
        />

        <FormField
          label="TRIAGE TIME"
          value={form.triageTime}
          placeholder="mm/dd/yyyy hh:mm"
          onChangeText={(value) =>
            updateField("triageTime", value)
          }
        />

        <Pressable
          onPress={() =>
            updateField(
              "triageTime",
              formatDateTimeForInput(new Date()),
            )
          }
          style={({ pressed }) => [
            styles.locationButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="time-outline"
            size={19}
            color={COLORS.maroon}
          />
          <Text style={styles.locationButtonText}>
            Use current triage time
          </Text>
        </Pressable>

        <FormField
          label="TRIAGE LOCATION"
          value={form.triageLocation}
          placeholder="Where triage was performed"
          onChangeText={(value) =>
            updateField("triageLocation", value)
          }
        />

        <FormField
          label="TRIAGE NOTES"
          value={form.triageNotes}
          placeholder="Additional triage observations"
          multiline
          onChangeText={(value) =>
            updateField("triageNotes", value)
          }
        />
      </>
    );
  }

  function renderTransportStep() {
    return (
      <>
        <SelectField
          label="TRANSPORT REQUIRED"
          value={form.transportRequired}
          placeholder="Select transport status"
          onPress={() => openChoiceSheet("transportRequired")}
        />

        <SelectField
          label="TRANSPORT MODE"
          value={form.transportMode}
          placeholder="EMS, private vehicle, or other"
          onPress={() => openChoiceSheet("transportMode")}
        />

        <SelectField
          label="EMS UNIT TYPE"
          value={form.emsUnitType}
          placeholder="BLS, ALS, other, or unknown"
          onPress={() => openChoiceSheet("emsUnitType")}
        />

        <FormField
          label="DEPARTED SCENE TIME"
          value={form.departedSceneTime}
          placeholder="mm/dd/yyyy hh:mm"
          onChangeText={(value) =>
            updateField("departedSceneTime", value)
          }
        />

        <Pressable
          onPress={() =>
            updateField(
              "departedSceneTime",
              formatDateTimeForInput(new Date()),
            )
          }
          style={({ pressed }) => [
            styles.locationButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="exit-outline"
            size={19}
            color={COLORS.maroon}
          />
          <Text style={styles.locationButtonText}>
            Use current departure time
          </Text>
        </Pressable>

        <FormField
          label="ARRIVED FACILITY TIME"
          value={form.arrivedFacilityTime}
          placeholder="mm/dd/yyyy hh:mm"
          onChangeText={(value) =>
            updateField("arrivedFacilityTime", value)
          }
        />

        <Pressable
          onPress={() =>
            updateField(
              "arrivedFacilityTime",
              formatDateTimeForInput(new Date()),
            )
          }
          style={({ pressed }) => [
            styles.locationButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="enter-outline"
            size={19}
            color={COLORS.maroon}
          />
          <Text style={styles.locationButtonText}>
            Use current arrival time
          </Text>
        </Pressable>

        <SelectField
          label="RECEIVING FACILITY"
          value={form.healthcareFacility}
          placeholder={
            isLoadingHealthcareFacilities
              ? "Loading healthcare facilities..."
              : "Select receiving facility"
          }
          onPress={() => openChoiceSheet("healthcareFacility")}
        />

        {healthcareFacilityError ? (
          <View style={styles.inlineWarning}>
            <Ionicons
              name="alert-circle-outline"
              size={18}
              color={COLORS.maroon}
            />
            <Text style={styles.inlineWarningText}>
              {healthcareFacilityError}
            </Text>
          </View>
        ) : null}

        {canManageReferenceData ? (
          <View style={styles.quickCreateCard}>
            <View style={styles.quickCreateHeader}>
              <Ionicons
                name="medkit-outline"
                size={20}
                color={COLORS.maroon}
              />
              <Text style={styles.quickCreateTitle}>
                Quick create healthcare facility
              </Text>
            </View>

            <FormField
              label="FACILITY NAME"
              value={newHealthcareFacilityName}
              placeholder="e.g. Philippine General Hospital"
              onChangeText={setNewHealthcareFacilityName}
            />

            <SelectField
              label="FACILITY LEVEL"
              value={newHealthcareFacilityLevel}
              placeholder="Select facility level"
              onPress={() => openChoiceSheet("facilityLevel")}
            />

            <FormField
              label="ADDRESS"
              value={newHealthcareFacilityAddress}
              placeholder="Street, building, or landmark"
              onChangeText={setNewHealthcareFacilityAddress}
            />

            <Pressable
              disabled={isCreatingHealthcareFacility}
              onPress={() => {
                void handleCreateHealthcareFacility();
              }}
              style={({ pressed }) => [
                styles.createIncidentButton,
                isCreatingHealthcareFacility &&
                  styles.disabledButton,
                pressed && styles.primaryButtonPressed,
              ]}
            >
              <Text style={styles.createIncidentButtonText}>
                {isCreatingHealthcareFacility
                  ? "Creating facility..."
                  : "Create and select facility"}
              </Text>

              {isCreatingHealthcareFacility ? (
                <ActivityIndicator
                  size="small"
                  color={COLORS.white}
                />
              ) : (
                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color={COLORS.white}
                />
              )}
            </Pressable>
          </View>
        ) : null}

        <FormField
          label="TRANSPORT NOTES"
          value={form.transportNotes}
          placeholder="Unit, vehicle, transfer, or transport notes"
          multiline
          onChangeText={(value) =>
            updateField("transportNotes", value)
          }
        />
      </>
    );
  }

  function renderStatusStep() {
    return (
      <>
        <SelectField
          label="CASUALTY STATUS"
          value={form.casualtyStatus}
          placeholder="Select status"
          onPress={() =>
            openChoiceSheet("casualtyStatus")
          }
        />

        <SelectField
          label="SEVERITY"
          value={form.severity}
          placeholder="Select severity"
          onPress={() => openChoiceSheet("severity")}
        />

        <FormField
          label="HOSPITAL / FACILITY"
          value={form.hospitalName}
          placeholder="Hospital or medical facility"
          onChangeText={(value) =>
            updateField("hospitalName", value)
          }
        />

        <FormField
          label="VISIBLE INJURY"
          value={form.visibleInjury}
          placeholder="Describe visible injuries"
          multiline
          onChangeText={(value) =>
            updateField("visibleInjury", value)
          }
        />

        <FormField
          label="MEDICAL CONDITION"
          value={form.medicalCondition}
          placeholder="Known medical condition"
          multiline
          onChangeText={(value) =>
            updateField("medicalCondition", value)
          }
        />

        <FormField
          label="ASSISTANCE NEEDED"
          value={form.assistanceNeeded}
          placeholder="Required assistance"
          multiline
          onChangeText={(value) =>
            updateField("assistanceNeeded", value)
          }
        />

        <FormField
          label="ASSISTANCE PROVIDED"
          value={form.assistanceProvided}
          placeholder="Assistance already provided"
          multiline
          onChangeText={(value) =>
            updateField("assistanceProvided", value)
          }
        />
      </>
    );
  }

  function renderRemarksStep() {
    return (
      <>
        <FormField
          label="REMARKS"
          value={form.remarks}
          placeholder="Additional information about the casualty"
          multiline
          onChangeText={(value) =>
            updateField("remarks", value)
          }
        />

        <Pressable
          onPress={() => {
            void handlePickPhoto();
          }}
          style={({ pressed }) => [
            styles.uploadCard,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.uploadIcon}>
            <Ionicons
              name="camera-outline"
              size={25}
              color={COLORS.maroon}
            />
          </View>

          <View style={styles.uploadTextWrapper}>
            <Text style={styles.uploadTitle}>
              {selectedPhoto
                ? "Casualty photo selected"
                : "Add casualty photo"}
            </Text>
            <Text style={styles.uploadDescription}>
              {selectedPhoto
                ? `${selectedPhoto.fileName} - uploads when saved.`
                : "Select or capture a photo to upload with this record."}
            </Text>
          </View>

          <Ionicons
            name="chevron-forward-outline"
            size={20}
            color={COLORS.secondaryText}
          />
        </Pressable>

        <View style={styles.reviewCard}>
          <Ionicons
            name="information-circle-outline"
            size={22}
            color={COLORS.maroon}
          />

          <Text style={styles.reviewText}>
            Review all information before submitting. The record
            will be marked as submitted and may require administrator
            verification.
          </Text>
        </View>
      </>
    );
  }

  function renderCurrentStep() {
    switch (stepName) {
      case "Personal":
        return renderPersonalStep();

      case "Address":
        return renderAddressStep();

      case "Incident":
        return renderIncidentStep();

      case "Triage":
        return renderTriageStep();

      case "Transport":
        return renderTransportStep();

      case "Status":
        return renderStatusStep();

      case "Remarks":
        return renderRemarksStep();
    }
  }

  if (isLoadingRecord) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator
          size="large"
          color={COLORS.maroon}
        />

        <Text style={styles.centerStateText}>
          Loading casualty record...
        </Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.centerState}>
        <Ionicons
          name="alert-circle-outline"
          size={42}
          color={COLORS.maroon}
        />

        <Text style={styles.centerStateTitle}>
          Unable to edit record
        </Text>

        <Text style={styles.centerStateText}>
          {loadError}
        </Text>

        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.centerStateButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.centerStateButtonText}>
            Go Back
          </Text>
        </Pressable>
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
              onPress={goBack}
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name="chevron-back"
                size={23}
                color={COLORS.white}
              />
            </Pressable>
          </View>

          <View style={styles.headerTitleWrapper}>
            <Text style={styles.headerTitle}>
              {screenTitle}
            </Text>
            <Text style={styles.headerSubtitle}>
              Step {currentStep + 1} of {STEPS.length} -{" "}
              {stepName}
            </Text>
          </View>

          <View style={styles.progressRow}>
            {STEPS.map((step, index) => {
              const isActive = index === currentStep;
              const isCompleted = index < currentStep;

              return (
                <View key={step} style={styles.progressItem}>
                  <View
                    style={[
                      styles.progressLine,
                      (isActive || isCompleted) &&
                        styles.progressLineActive,
                    ]}
                  />

                  <Text
                    style={[
                      styles.progressLabel,
                      isActive && styles.progressLabelActive,
                    ]}
                  >
                    {step.toUpperCase()}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {renderCurrentStep()}
        </ScrollView>

        <SafeAreaView
          edges={["bottom"]}
          style={styles.footerSafeArea}
        >
          <View style={styles.footer}>
            {currentStep > 0 ? (
              <Pressable
                onPress={goBack}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.secondaryButtonText}>
                  Previous
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={goNext}
              disabled={isSubmitting}
              style={({ pressed }) => [
                styles.primaryButton,
                currentStep === 0 && styles.fullWidthButton,
                isSubmitting && styles.disabledButton,
                pressed && styles.primaryButtonPressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {currentStep === STEPS.length - 1
                  ? finalActionLabel
                  : "Continue"}
              </Text>

              {isSubmitting ? (
                <ActivityIndicator
                  size="small"
                  color={COLORS.white}
                />
              ) : (
                <Ionicons
                  name={
                    currentStep === STEPS.length - 1
                      ? "checkmark-circle-outline"
                      : "arrow-forward-outline"
                  }
                  size={19}
                  color={COLORS.white}
                />
              )}
            </Pressable>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>

      <ChoiceSheet
        visible={activeChoiceSheet !== null}
        title={getChoiceSheetTitle()}
        options={getChoiceOptions()}
        searchQuery={choiceSearchQuery}
        searchable={isActiveChoiceSheetSearchable()}
        onSearchChange={setChoiceSearchQuery}
        onClose={() => setActiveChoiceSheet(null)}
      />

      <DatePickerSheet
        visible={isDatePickerVisible}
        value={form.dateOfBirth}
        onSelect={(value) => updateField("dateOfBirth", value)}
        onClose={() => setIsDatePickerVisible(false)}
      />
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
    paddingHorizontal: 28,
    backgroundColor: COLORS.background,
  },
  centerStateTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "900",
    marginTop: 14,
  },
  centerStateText: {
    color: COLORS.secondaryText,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 10,
  },
  centerStateButton: {
    minHeight: 43,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
    borderRadius: 12,
    marginTop: 18,
    backgroundColor: COLORS.maroon,
  },
  centerStateButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "800",
  },
  keyboardView: {
    flex: 1,
  },

  sheetBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(23,33,58,0.38)",
  },
  choiceSheet: {
    maxHeight: "72%",
    paddingHorizontal: 16,
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
    marginBottom: 8,
  },
  sheetTitle: {
    color: COLORS.text,
    fontSize: 16,
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
  sheetSearchBar: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.fieldBorder,
    borderRadius: 13,
    backgroundColor: COLORS.fieldBackground,
    marginBottom: 10,
  },
  sheetSearchInput: {
    flex: 1,
    minHeight: 44,
    color: COLORS.text,
    fontSize: 14,
    paddingLeft: 9,
  },
  choiceList: {
    paddingBottom: 4,
    gap: 8,
  },
  choiceEmptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  choiceEmptyTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800",
  },
  choiceEmptyText: {
    color: COLORS.secondaryText,
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 6,
  },
  choiceOption: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.fieldBorder,
    borderRadius: 13,
    backgroundColor: COLORS.fieldBackground,
  },
  choiceOptionSelected: {
    borderColor: COLORS.maroon,
    backgroundColor: "#FFF4F4",
  },
  choiceOptionText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
  },
  choiceOptionTextSelected: {
    color: COLORS.maroon,
  },

  dateSheet: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: COLORS.white,
  },
  dateHeader: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  dateArrowButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF4F4",
  },
  dateTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "900",
  },
  weekRow: {
    flexDirection: "row",
    marginTop: 6,
  },
  weekLabel: {
    width: `${100 / 7}%`,
    color: COLORS.secondaryText,
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
  },
  dayGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
  },
  dayCell: {
    width: `${100 / 7}%`,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCellSelected: {
    borderRadius: 12,
    backgroundColor: COLORS.maroon,
  },
  dayText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
  },
  dayTextSelected: {
    color: COLORS.white,
  },
  todayButton: {
    minHeight: 45,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    marginTop: 12,
    backgroundColor: COLORS.maroon,
  },
  todayButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "800",
  },

  headerSafeArea: {
    backgroundColor: COLORS.maroon,
  },
  header: {
    backgroundColor: COLORS.maroon,
    paddingHorizontal: 7,
    paddingTop: 8,
    paddingBottom: 13,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    width: 37,
    height: 37,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  headerTitleWrapper: {
    marginTop: 10,
  },
  headerTitle: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: "800",
  },
  headerSubtitle: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 12,
    marginTop: 5,
  },

  progressRow: {
    flexDirection: "row",
    marginTop: 17,
    gap: 6,
  },
  progressItem: {
    flex: 1,
  },
  progressLine: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.24)",
  },
  progressLineActive: {
    backgroundColor: COLORS.white,
  },
  progressLabel: {
    color: "rgba(255,255,255,0.42)",
    fontSize: 8,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 6,
  },
  progressLabelActive: {
    color: COLORS.white,
  },

  formContent: {
    paddingHorizontal: 14,
    paddingTop: 23,
    paddingBottom: 30,
  },
  fieldGroup: {
    marginBottom: 17,
  },
  label: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
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
  inputDisabled: {
    color: COLORS.secondaryText,
    backgroundColor: "#EEF2F7",
  },
  multilineInput: {
    minHeight: 105,
    paddingTop: 14,
  },
  selectInput: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.fieldBorder,
    borderRadius: 13,
    backgroundColor: COLORS.fieldBackground,
  },
  selectText: {
    color: COLORS.text,
    fontSize: 14,
  },
  placeholderText: {
    color: COLORS.muted,
  },

  twoColumnRow: {
    flexDirection: "row",
    gap: 12,
  },
  halfColumn: {
    flex: 1,
  },

  locationButton: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    borderWidth: 1,
    borderColor: COLORS.maroon,
    backgroundColor: "#FFF8F8",
    gap: 9,
  },
  locationButtonText: {
    color: COLORS.maroon,
    fontSize: 13,
    fontWeight: "700",
  },

  inlineWarning: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F1C8CA",
    backgroundColor: "#FFF6F6",
    marginTop: -5,
    marginBottom: 17,
    gap: 8,
  },
  inlineWarningText: {
    flex: 1,
    color: COLORS.secondaryText,
    fontSize: 11,
    lineHeight: 16,
  },

  quickCreateCard: {
    borderWidth: 1,
    borderColor: "#E8D4D6",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingTop: 13,
    paddingBottom: 12,
    marginBottom: 17,
    backgroundColor: "#FFF9F9",
  },
  quickCreateHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 13,
    gap: 8,
  },
  quickCreateTitle: {
    color: COLORS.maroon,
    fontSize: 13,
    fontWeight: "900",
  },
  createIncidentButton: {
    minHeight: 47,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: COLORS.maroon,
    gap: 8,
  },
  createIncidentButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "800",
  },

  uploadCard: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.fieldBorder,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: COLORS.fieldBackground,
  },
  uploadIcon: {
    width: 45,
    height: 45,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F6E9EB",
    marginRight: 13,
  },
  uploadTextWrapper: {
    flex: 1,
  },
  uploadTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800",
  },
  uploadDescription: {
    color: COLORS.secondaryText,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 5,
  },

  reviewCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 18,
    borderRadius: 13,
    padding: 14,
    backgroundColor: "#FFF6F6",
    borderWidth: 1,
    borderColor: "#F1C8CA",
  },
  reviewText: {
    flex: 1,
    color: COLORS.secondaryText,
    fontSize: 11,
    lineHeight: 17,
    marginLeft: 10,
  },

  footerSafeArea: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: "#E8EBF0",
  },
  footer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 11,
    paddingBottom: 7,
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    minHeight: 51,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.maroon,
    gap: 8,
  },
  fullWidthButton: {
    flex: 1,
  },
  primaryButtonPressed: {
    opacity: 0.84,
    transform: [{ scale: 0.99 }],
  },
  disabledButton: {
    opacity: 0.72,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "800",
  },
  secondaryButton: {
    minWidth: 105,
    minHeight: 51,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.fieldBorder,
    backgroundColor: COLORS.white,
  },
  secondaryButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
  },

  pressed: {
    opacity: 0.75,
  },
});
