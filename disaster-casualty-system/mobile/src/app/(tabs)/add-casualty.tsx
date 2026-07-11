import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
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
  "Status",
  "Remarks",
] as const;

type StepName = (typeof STEPS)[number];

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
  currentLocation: string;
  evacuationCenter: string;
  latitude: string;
  longitude: string;

  casualtyStatus: string;
  severity: string;
  hospitalName: string;
  visibleInjury: string;
  medicalCondition: string;
  assistanceNeeded: string;
  assistanceProvided: string;

  remarks: string;
};

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
  currentLocation: "",
  evacuationCenter: "",
  latitude: "",
  longitude: "",

  casualtyStatus: "",
  severity: "",
  hospitalName: "",
  visibleInjury: "",
  medicalCondition: "",
  assistanceNeeded: "",
  assistanceProvided: "",

  remarks: "",
};

type FieldProps = {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
  keyboardType?: "default" | "numeric" | "phone-pad";
  multiline?: boolean;
};

function FormField({
  label,
  value,
  placeholder,
  onChangeText,
  keyboardType = "default",
  multiline = false,
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
        textAlignVertical={multiline ? "top" : "center"}
        style={[
          styles.input,
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

export default function AddCasualtyScreen() {
  const [currentStep, setCurrentStep] = useState(0);
  const [form, setForm] = useState<FormState>(initialForm);

  const stepName: StepName = STEPS[currentStep];

  function updateField<K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function goNext() {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((step) => step + 1);
      return;
    }

    console.log("Submit casualty:", form);
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
              placeholder="e.g. C-2026-008"
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
              onPress={() => {
                updateField(
                  "sex",
                  form.sex === "Male"
                    ? "Female"
                    : form.sex === "Female"
                      ? "Unknown"
                      : "Male",
                );
              }}
            />
          </View>

          <View style={styles.halfColumn}>
            <SelectField
              label="DATE OF BIRTH"
              value={form.dateOfBirth}
              placeholder="mm/dd/yyyy"
              icon="calendar-outline"
              onPress={() =>
                updateField("dateOfBirth", "07/10/1990")
              }
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
          value={form.incidentId}
          placeholder="Select active incident"
          onPress={() =>
            updateField(
              "incidentId",
              "Typhoon Egay — Level 3 Response",
            )
          }
        />

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
          placeholder="Select evacuation center"
          onPress={() =>
            updateField(
              "evacuationCenter",
              "San Isidro Covered Court",
            )
          }
        />

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

        <Pressable style={styles.locationButton}>
          <Ionicons
            name="locate-outline"
            size={19}
            color={COLORS.maroon}
          />
          <Text style={styles.locationButtonText}>
            Use current GPS location
          </Text>
        </Pressable>
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
            updateField("casualtyStatus", "Injured")
          }
        />

        <SelectField
          label="SEVERITY"
          value={form.severity}
          placeholder="Select severity"
          onPress={() =>
            updateField("severity", "Moderate")
          }
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

        <Pressable style={styles.uploadCard}>
          <View style={styles.uploadIcon}>
            <Ionicons
              name="camera-outline"
              size={25}
              color={COLORS.maroon}
            />
          </View>

          <View style={styles.uploadTextWrapper}>
            <Text style={styles.uploadTitle}>
              Add casualty photo
            </Text>
            <Text style={styles.uploadDescription}>
              Capture a photo or select one from the device.
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

      case "Status":
        return renderStatusStep();

      case "Remarks":
        return renderRemarksStep();
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

            <View style={styles.headerTitleWrapper}>
              <Text style={styles.headerTitle}>
                Add Casualty
              </Text>
              <Text style={styles.headerSubtitle}>
                Step {currentStep + 1} of {STEPS.length} —{" "}
                {stepName}
              </Text>
            </View>
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
              style={({ pressed }) => [
                styles.primaryButton,
                currentStep === 0 && styles.fullWidthButton,
                pressed && styles.primaryButtonPressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {currentStep === STEPS.length - 1
                  ? "Submit Casualty"
                  : "Continue"}
              </Text>

              <Ionicons
                name={
                  currentStep === STEPS.length - 1
                    ? "checkmark-circle-outline"
                    : "arrow-forward-outline"
                }
                size={19}
                color={COLORS.white}
              />
            </Pressable>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
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
    marginRight: 11,
  },
  headerTitleWrapper: {
    flex: 1,
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
    paddingHorizontal: 2,
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
    paddingHorizontal: 12,
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