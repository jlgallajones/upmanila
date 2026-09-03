import { Ionicons } from "@expo/vector-icons";
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  type StyleProp,
  Text,
  TextInput,
  type TextStyle,
  View,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  createCasualty,
  getCasualties,
  getCasualty,
  getCasualtyTriageHistory,
  getCasualtyTransportHistory,
  getNextCasualtyIdSequence,
  updateCasualty,
  type CasualtyTransportHistoryItem,
  type CasualtyTriageHistoryItem,
  type CasualtyRecord,
  type CreateCasualtyPayload,
  type UpdateCasualtyPayload,
} from "../../api/casualties";
import { uploadAttachment } from "../../api/attachments";
import { isAuthenticationTokenError } from "../../api/client";
import {
  createIncident,
  getIncidents,
  getResponderSafetyResponse,
  saveResponderSafetyResponse,
  type Incident,
  type ResponderSafetyResponseRecord,
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
import type {
  ReportingContext,
  UserRole,
} from "../../api/profile";
import { getCurrentUser } from "../../auth/session";
import {
  getResponderAssignment,
  type ResponderAssignment,
} from "../../auth/responderAssignment";
import {
  isNetworkSubmissionError,
  getQueuedCasualtySubmissions,
  queueCasualtySubmission,
  type QueuedCasualtyPayload,
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

const DEFAULT_STEPS = [
  "Personal",
  "Address",
  "Incident",
  "Triage",
  "Status",
  "Transport",
  "Hospital Care",
  "Remarks",
] as const;

const FIELD_RESPONDER_STEPS = ["Safety", "Triage", "Status"] as const;

const SA_RESPONDER_STEPS = [
  "Safety",
  "Intro",
  "Info",
  "Address",
  "Triage",
  "Treatment",
  "Transport",
  "Remarks",
] as const;

const HEALTHCARE_DOCUMENTER_STEPS = [
  "General Information",
  "Patient Information",
  "Triage",
  "Management",
  "Disposition",
] as const;

const ALL_STEPS = [
  ...DEFAULT_STEPS,
  ...FIELD_RESPONDER_STEPS,
  ...SA_RESPONDER_STEPS,
  ...HEALTHCARE_DOCUMENTER_STEPS,
] as const;

const SEX_OPTIONS = ["Male", "Female", "Unknown"] as const;

const YES_NO_OPTIONS_TEXT = ["Yes", "No"] as const;

const WITNESS_PRESENT_OPTIONS = [
  "Bystander",
  "EMS",
  "Police Officer",
  "Traffic Enforcer",
  "Fire Volunteer",
  "Relative",
  "Others",
] as const;

const WITNESS_RESPONSE_OPTIONS = [
  "First Aid",
  "CPR",
  "AED",
  "Unknown",
  "None",
] as const;

const CPR_TYPE_OPTIONS = [
  "Compression only",
  "Compression with ventilation",
] as const;

const PATIENT_FOR_OPTIONS = [
  "Pending Departure",
  "Release",
  "Referral or Transfer to Health Facility",
] as const;

const RELEASE_CONDITION_OPTIONS = ["Alive", "Dead"] as const;

const RELEASE_MEDICAL_CONTACT_OPTIONS = [
  "With medical contact",
  "Without medical contact",
] as const;

const EMS_VEHICLE_TYPE_OPTIONS = ["BLS", "ALS"] as const;

const PRECAUTION_OPTIONS = [
  "Standard",
  "Airborne",
  "Droplet",
  "Contact",
  "Protective Isolation",
  "Source Isolation",
] as const;

const RELEASE_OF_LIABILITY_TEXT =
  "The patient or authorized representative was informed of the risks, benefits, and possible consequences of refusing referral, transfer, or further medical care. The patient or representative accepts responsibility for the decision to release from care.";

const HOSPITAL_ARRIVAL_DISPOSITION_OPTIONS = [
  "Active Care",
  "Admitted to Hospital",
  "Discharged",
  "Transferred",
  "Deceased",
  "Unknown",
] as const;

const ADMITTED_UNIT_OPTIONS = [
  "ICU",
  "Ward",
  "Other Unit",
  "Not Admitted",
  "Unknown",
] as const;

const HAZARD_TYPE_OPTIONS = [
  "Volcanic Eruption",
  "Earthquake",
  "Tsunami",
  "Landslide",
  "Lahar / Volcanic Mudflow",
  "Sink Hole",
  "Geologic - Other",
  "Infectious Diseases",
  "Infestation",
  "Poisoning",
  "Biological - Other",
  "Typhoon",
  "Storm Surge",
  "LPA / ALPA",
  "Tropical Depression",
  "Monsoon Rain",
  "Flooding",
  "Flash Flood",
  "Lightning",
  "Drought",
  "Meteorological / Hydrological - Other",
  "Bombing",
  "Armed Conflict",
  "War",
  "Mass Gathering",
  "Ambush Incident",
  "Terrorist Activities",
  "Hostage Taking",
  "Coup d'etat",
  "Repatriation",
  "Civil Unrest",
  "Mass Shooting",
  "Societal - Other",
  "Fire",
  "Explosion",
  "Maritime Accident",
  "Air Accident",
  "Land Transportation Accident",
  "Trash Slide",
  "Technological - Other",
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

const PRIMARY_TRIAGE_SYSTEM_OPTIONS = [
  "STIEVE",
  "START",
  "mSTART",
  "JumpSTART",
  "SIEVE",
  "Care Flight",
  "SALT",
  "PTT",
  "MITT",
  "Homebush",
  "MPTT",
  "STM",
] as const;

const FIELD_RESPONDER_TRIAGE_SYSTEM_OPTIONS = [
  "STIEVE",
  "START",
] as const;

const SECONDARY_TRIAGE_SYSTEM_OPTIONS = [
  "SAVE",
  "SORT",
  "META",
  "SwiFT",
  "SMART",
  "Other",
] as const;

const SA_RESPONDER_TRIAGE_SYSTEM_OPTIONS = ["SORT"] as const;

const TERTIARY_TRIAGE_SYSTEM_OPTIONS = [
  "ESI",
  "NATO",
  "MASS",
  "METTS",
  "ED Triage",
  "Other",
] as const;

const TRIAGE_SYSTEM_OPTIONS = [
  ...PRIMARY_TRIAGE_SYSTEM_OPTIONS,
  ...SECONDARY_TRIAGE_SYSTEM_OPTIONS,
  ...TERTIARY_TRIAGE_SYSTEM_OPTIONS,
  "SIEVE/SORT",
  "RTS",
] as const;

type TriageSystemOption = (typeof TRIAGE_SYSTEM_OPTIONS)[number];

type AppendixAnswerOption = {
  label: string;
  value: string;
};

type AppendixQuestion = {
  key: string;
  label: string;
  options?: AppendixAnswerOption[];
  inputType?: "numeric";
};

const YES_NO_OPTIONS: AppendixAnswerOption[] = [
  { label: "Yes", value: "yes" },
  { label: "No", value: "no" },
];

const PRESENT_ABSENT_OPTIONS: AppendixAnswerOption[] = [
  { label: "Present", value: "present" },
  { label: "Absent", value: "absent" },
];

const FINAL_TRIAGE_COLOR_OPTIONS: AppendixAnswerOption[] = [
  { label: "Green", value: "green" },
  { label: "Yellow", value: "yellow" },
  { label: "Red", value: "red" },
  { label: "Black", value: "black" },
];

const FINAL_TRIAGE_WITH_WHITE_OPTIONS: AppendixAnswerOption[] = [
  { label: "Green", value: "green" },
  { label: "Yellow", value: "yellow" },
  { label: "Red", value: "red" },
  { label: "Black", value: "black" },
  { label: "White", value: "white" },
];

const ESI_TRIAGE_OPTIONS: AppendixAnswerOption[] = [
  { label: "ESI 1", value: "esi_1" },
  { label: "ESI 2", value: "esi_2" },
  { label: "ESI 3", value: "esi_3" },
  { label: "ESI 4", value: "esi_4" },
  { label: "ESI 5", value: "esi_5" },
];

const METTS_TRIAGE_OPTIONS: AppendixAnswerOption[] = [
  { label: "Red", value: "red" },
  { label: "Orange", value: "orange" },
  { label: "Yellow", value: "yellow" },
  { label: "Green", value: "green" },
  { label: "Blue", value: "blue" },
];

const START_RESPIRATION_OPTIONS: AppendixAnswerOption[] = [
  { label: "Absent", value: "absent" },
  { label: "More than 30", value: "more_than_30" },
  { label: "Less than 30", value: "less_than_30" },
];

const START_AIRWAY_QUESTION: AppendixQuestion = {
  key: "breathingAfterAirwayManagement",
  label: "Breathing after airway management?",
  options: YES_NO_OPTIONS,
};

const CAPILLARY_REFILL_OPTIONS: AppendixAnswerOption[] = [
  { label: "More than 2 sec", value: "more_than_2_seconds" },
  { label: "2 sec or less", value: "less_than_or_equal_to_2_seconds" },
];

const SIMPLE_COMMAND_OPTIONS: AppendixAnswerOption[] = [
  { label: "Follows commands", value: "yes" },
  { label: "Cannot follow", value: "no" },
];

const APPENDIX_TRIAGE_FIELDS: Record<string, AppendixQuestion[]> = {
  stieve: [
    {
      key: "specialPopulation",
      label: "Considered special population?",
      options: YES_NO_OPTIONS,
    },
    {
      key: "canWalkOrNoVisibleInjuries",
      label: "Can walk or has no visible injuries?",
      options: YES_NO_OPTIONS,
    },
    {
      key: "catastrophicHemorrhage",
      label: "Catastrophic hemorrhage?",
      options: YES_NO_OPTIONS,
    },
    {
      key: "suckingChestWound",
      label: "Sucking chest wound?",
      options: YES_NO_OPTIONS,
    },
    {
      key: "respirations",
      label: "Respirations",
      options: [
        { label: "Absent", value: "absent" },
        { label: "Less than 10", value: "less_than_10" },
        { label: "10-29", value: "10_to_29" },
        { label: "More than 30", value: "more_than_30" },
      ],
    },
    START_AIRWAY_QUESTION,
    {
      key: "pulse",
      label: "Pulse",
      options: [
        { label: "Absent", value: "absent" },
        { label: "Weak", value: "weak" },
        { label: "Strong", value: "strong" },
      ],
    },
    {
      key: "capillaryRefill",
      label: "Capillary refill",
      options: CAPILLARY_REFILL_OPTIONS,
    },
    {
      key: "followsSimpleCommands",
      label: "Mental status",
      options: SIMPLE_COMMAND_OPTIONS,
    },
    {
      key: "finalTriage",
      label: "Final triage",
      options: FINAL_TRIAGE_COLOR_OPTIONS,
    },
  ],
  start: [
    { key: "canWalk", label: "Can walk?", options: YES_NO_OPTIONS },
    {
      key: "spontaneousBreathing",
      label: "Spontaneous breathing?",
      options: YES_NO_OPTIONS,
    },
    START_AIRWAY_QUESTION,
    {
      key: "respirations",
      label: "Respirations",
      options: START_RESPIRATION_OPTIONS,
    },
    {
      key: "capillaryRefill",
      label: "Capillary refill",
      options: CAPILLARY_REFILL_OPTIONS,
    },
    {
      key: "radialPulse",
      label: "Radial pulse",
      options: PRESENT_ABSENT_OPTIONS,
    },
    {
      key: "followsSimpleCommands",
      label: "Mental status",
      options: SIMPLE_COMMAND_OPTIONS,
    },
    {
      key: "finalTriage",
      label: "Final triage",
      options: FINAL_TRIAGE_COLOR_OPTIONS,
    },
  ],
  mstart: [
    { key: "canWalk", label: "Can walk?", options: YES_NO_OPTIONS },
    {
      key: "spontaneousBreathing",
      label: "Spontaneous breathing?",
      options: YES_NO_OPTIONS,
    },
    START_AIRWAY_QUESTION,
    {
      key: "respirations",
      label: "Respirations",
      options: START_RESPIRATION_OPTIONS,
    },
    {
      key: "radialPulse",
      label: "Radial pulse",
      options: PRESENT_ABSENT_OPTIONS,
    },
    {
      key: "followsSimpleCommands",
      label: "Mental status",
      options: SIMPLE_COMMAND_OPTIONS,
    },
    {
      key: "finalTriage",
      label: "Final triage",
      options: FINAL_TRIAGE_COLOR_OPTIONS,
    },
  ],
  jumpstart: [
    { key: "canWalk", label: "Can walk?", options: YES_NO_OPTIONS },
    {
      key: "spontaneousBreathing",
      label: "Spontaneous breathing?",
      options: YES_NO_OPTIONS,
    },
    START_AIRWAY_QUESTION,
    {
      key: "palpablePulseAfterAirwayManagement",
      label: "Palpable pulse after airway management?",
      options: YES_NO_OPTIONS,
    },
    {
      key: "breathingAfterRescueBreaths",
      label: "Breathing after 5 rescue breaths?",
      options: YES_NO_OPTIONS,
    },
    {
      key: "respirations",
      label: "Respirations",
      options: [
        { label: "Absent", value: "absent" },
        { label: "More than 45", value: "more_than_45" },
        { label: "Less than 15", value: "less_than_15" },
        { label: "15-45", value: "15_to_45" },
      ],
    },
    {
      key: "radialPulse",
      label: "Radial pulse",
      options: PRESENT_ABSENT_OPTIONS,
    },
    {
      key: "mentalStatus",
      label: "Mental status",
      options: [
        { label: "Alert", value: "alert" },
        { label: "Responds to verbal stimuli", value: "verbal" },
        { label: "Responds to painful stimuli", value: "painful" },
        { label: "Unresponsive to noxious stimuli", value: "unresponsive" },
      ],
    },
    {
      key: "finalTriage",
      label: "Final triage",
      options: FINAL_TRIAGE_COLOR_OPTIONS,
    },
  ],
  nato: [
    { key: "canWalk", label: "Can walk?", options: YES_NO_OPTIONS },
    {
      key: "minorSelfCare",
      label: "Minor injuries, can self-care?",
      options: YES_NO_OPTIONS,
    },
    {
      key: "lowSurvivalComplexTreatment",
      label: "Complex treatment with low survival chance?",
      options: YES_NO_OPTIONS,
    },
    {
      key: "lifeSavingSurgeryHighSurvival",
      label: "Life-saving surgery, high survival chance?",
      options: YES_NO_OPTIONS,
    },
    {
      key: "delayedSurgeryPermitted",
      label: "Surgery can be delayed safely?",
      options: YES_NO_OPTIONS,
    },
    {
      key: "finalTriage",
      label: "Final triage",
      options: FINAL_TRIAGE_COLOR_OPTIONS,
    },
  ],
  sieve: [
    { key: "canWalk", label: "Can walk?", options: YES_NO_OPTIONS },
    { key: "injury", label: "Injury", options: PRESENT_ABSENT_OPTIONS },
    {
      key: "respirations",
      label: "Respirations",
      options: [
        { label: "Absent", value: "absent" },
        {
          label: "10 or below",
          value: "less_than_or_equal_to_10",
        },
        {
          label: "30 or above",
          value: "more_than_or_equal_to_30",
        },
        { label: "11-29", value: "eleven_to_twenty_nine" },
      ],
    },
    START_AIRWAY_QUESTION,
    {
      key: "heartRate",
      label: "Heart rate",
      options: [
        { label: ">120 bpm", value: "more_than_120" },
        { label: "<120 bpm", value: "less_than_120" },
      ],
    },
    {
      key: "capillaryRefill",
      label: "Capillary refill",
      options: [
        { label: "More than 2 sec", value: "more_than_2_seconds" },
        { label: "Less than 2 sec", value: "less_than_2_seconds" },
      ],
    },
    {
      key: "finalTriage",
      label: "Final triage",
      options: FINAL_TRIAGE_COLOR_OPTIONS,
    },
  ],
  sort: [
    {
      key: "gcs",
      label: "Glasgow Coma Scale",
      options: [
        { label: "13-15", value: "13_to_15" },
        { label: "9-12", value: "9_to_12" },
        { label: "6-8", value: "6_to_8" },
        { label: "4-5", value: "4_to_5" },
        { label: "3", value: "3" },
      ],
    },
    {
      key: "respiratoryRate",
      label: "Respiratory rate",
      options: [
        { label: "10-29", value: "10_to_29" },
        { label: ">=30", value: "more_than_or_equal_to_30" },
        { label: "6-9", value: "6_to_9" },
        { label: "1-5", value: "1_to_5" },
        { label: "0", value: "0" },
      ],
    },
    {
      key: "systolicBp",
      label: "Systolic BP",
      options: [
        { label: ">=90", value: "more_than_or_equal_to_90" },
        { label: "76-89", value: "76_to_89" },
        { label: "50-75", value: "50_to_75" },
        { label: "1-49", value: "1_to_49" },
        { label: "0", value: "0" },
      ],
    },
    {
      key: "finalTriage",
      label: "Final triage",
      options: FINAL_TRIAGE_COLOR_OPTIONS,
    },
  ],
  save: [
    {
      key: "saveCategory",
      label: "SAVE category",
      options: [
        {
          label: "Requires immediate interventions to live",
          value: "immediate_intervention_to_live",
        },
        {
          label: "Requires interventions but can tolerate brief delay",
          value: "brief_delay_tolerated",
        },
        {
          label: "No intervention needed to prevent loss of life or limb",
          value: "no_life_or_limb_intervention_needed",
        },
        { label: "Dead / unsalvageable", value: "dead_unsalvageable" },
      ],
    },
    {
      key: "finalTriage",
      label: "Final triage",
      options: FINAL_TRIAGE_COLOR_OPTIONS,
    },
  ],
  meta: [
    {
      key: "airwayRisk",
      label: "Actual or potential airway risk?",
      options: YES_NO_OPTIONS,
    },
    {
      key: "breathingRisk",
      label: "Actual or potential breathing risk?",
      options: YES_NO_OPTIONS,
    },
    {
      key: "circulationRisk",
      label: "Actual or potential circulation risk?",
      options: YES_NO_OPTIONS,
    },
    {
      key: "disabilityRisk",
      label: "Actual or potential disability risk?",
      options: YES_NO_OPTIONS,
    },
    {
      key: "exposureRisk",
      label: "Actual or potential exposure risk?",
      options: YES_NO_OPTIONS,
    },
    {
      key: "finalTriage",
      label: "Final triage",
      options: [
        { label: "Green", value: "green" },
        { label: "Yellow", value: "yellow" },
        { label: "Red", value: "red" },
      ],
    },
  ],
  rts: [
    {
      key: "gcs",
      label: "Glasgow Coma Scale",
      options: [
        { label: "13-15", value: "13_to_15" },
        { label: "9-12", value: "9_to_12" },
        { label: "6-8", value: "6_to_8" },
        { label: "4-5", value: "4_to_5" },
        { label: "3", value: "3" },
      ],
    },
    {
      key: "respiratoryRate",
      label: "Respiratory rate",
      options: [
        { label: "10-29", value: "10_to_29" },
        { label: ">29", value: "more_than_29" },
        { label: "6-9", value: "6_to_9" },
        { label: "1-5", value: "1_to_5" },
        { label: "0", value: "0" },
      ],
    },
    {
      key: "systolicBp",
      label: "Systolic BP",
      options: [
        { label: ">89", value: "more_than_89" },
        { label: "76-89", value: "76_to_89" },
        { label: "50-75", value: "50_to_75" },
        { label: "1-49", value: "1_to_49" },
        { label: "0", value: "0" },
      ],
    },
    {
      key: "finalTriage",
      label: "Final triage",
      options: FINAL_TRIAGE_COLOR_OPTIONS,
    },
  ],
  care_flight: [
    { key: "canWalk", label: "Can walk?", options: YES_NO_OPTIONS },
    {
      key: "canObeyCommands",
      label: "Can obey commands?",
      options: YES_NO_OPTIONS,
    },
    {
      key: "palpableRadialPulse",
      label: "Palpable radial pulse",
      options: PRESENT_ABSENT_OPTIONS,
    },
    {
      key: "breathingWithOpenAirway",
      label: "Breathing with open airway",
      options: PRESENT_ABSENT_OPTIONS,
    },
    {
      key: "finalTriage",
      label: "Final triage",
      options: FINAL_TRIAGE_COLOR_OPTIONS,
    },
  ],
  salt: [
    { key: "canWalk", label: "Can walk?", options: YES_NO_OPTIONS },
    { key: "canWave", label: "Can wave?", options: YES_NO_OPTIONS },
    { key: "breathing", label: "Breathing?", options: YES_NO_OPTIONS },
    {
      key: "respirations",
      label: "Respirations",
      options: PRESENT_ABSENT_OPTIONS,
    },
    START_AIRWAY_QUESTION,
    {
      key: "obeysCommandsOrPurposefulMovement",
      label: "Obeys commands or purposeful movement?",
      options: YES_NO_OPTIONS,
    },
    {
      key: "hasPeripheralPulse",
      label: "Has peripheral pulse?",
      options: YES_NO_OPTIONS,
    },
    {
      key: "respiratoryDistress",
      label: "In respiratory distress?",
      options: YES_NO_OPTIONS,
    },
    {
      key: "majorHemorrhageControlled",
      label: "Major hemorrhage controlled?",
      options: YES_NO_OPTIONS,
    },
    {
      key: "minorInjuriesOnly",
      label: "Minor injuries only?",
      options: YES_NO_OPTIONS,
    },
    {
      key: "likelyToSurviveGivenResources",
      label: "Likely to survive with current resources?",
      options: YES_NO_OPTIONS,
    },
    {
      key: "finalTriage",
      label: "Final triage",
      options: FINAL_TRIAGE_COLOR_OPTIONS,
    },
  ],
  ptt: [
    {
      key: "height",
      label: "Height",
      options: [
        { label: "40-80 cm", value: "40_to_80_cm" },
        { label: "80-100 cm", value: "80_to_100_cm" },
        { label: "100-140 cm", value: "100_to_140_cm" },
      ],
    },
    {
      key: "alertAndMovingAllLimbs",
      label: "Alert and moving all limbs?",
      options: YES_NO_OPTIONS,
    },
    {
      key: "spontaneousBreathing",
      label: "Spontaneous breathing?",
      options: YES_NO_OPTIONS,
    },
    START_AIRWAY_QUESTION,
    {
      key: "pttRespiratoryRate",
      label: "Respiratory rate",
      inputType: "numeric",
    },
    {
      key: "capillaryRefill",
      label: "Capillary refill",
      options: CAPILLARY_REFILL_OPTIONS,
    },
    {
      key: "pttPulseRate",
      label: "Pulse rate",
      inputType: "numeric",
    },
    {
      key: "finalTriage",
      label: "Final triage",
      options: FINAL_TRIAGE_COLOR_OPTIONS,
    },
  ],
  mitt: [
    {
      key: "catastrophicHemorrhage",
      label: "Catastrophic hemorrhage?",
      options: YES_NO_OPTIONS,
    },
    { key: "canWalk", label: "Can walk?", options: YES_NO_OPTIONS },
    {
      key: "spontaneousBreathing",
      label: "Spontaneous breathing?",
      options: YES_NO_OPTIONS,
    },
    {
      key: "respondsToVoice",
      label: "Responds to voice?",
      options: YES_NO_OPTIONS,
    },
    {
      key: "agedOverTwoYears",
      label: "Aged over 2 years?",
      options: YES_NO_OPTIONS,
    },
    {
      key: "respirations",
      label: "Respirations",
      options: [
        { label: "Absent", value: "absent" },
        { label: "Less than 12", value: "less_than_12" },
        { label: "More than 23", value: "more_than_23" },
        { label: "12-23", value: "12_to_23" },
      ],
    },
    {
      key: "heartRate",
      label: "Heart rate",
      options: [
        { label: "Absent", value: "absent" },
        { label: "More than 100", value: "more_than_100" },
        { label: "Less than 100", value: "less_than_100" },
        { label: "100", value: "100" },
      ],
    },
    {
      key: "finalTriage",
      label: "Final triage",
      options: FINAL_TRIAGE_COLOR_OPTIONS,
    },
  ],
  homebush: [
    { key: "canWalk", label: "Can walk?", options: YES_NO_OPTIONS },
    {
      key: "spontaneousBreathing",
      label: "Spontaneous breathing?",
      options: YES_NO_OPTIONS,
    },
    START_AIRWAY_QUESTION,
    {
      key: "respirations",
      label: "Respirations",
      options: START_RESPIRATION_OPTIONS,
    },
    {
      key: "capillaryRefill",
      label: "Capillary refill",
      options: CAPILLARY_REFILL_OPTIONS,
    },
    {
      key: "radialPulse",
      label: "Radial pulse",
      options: PRESENT_ABSENT_OPTIONS,
    },
    {
      key: "followsSimpleCommands",
      label: "Mental status",
      options: SIMPLE_COMMAND_OPTIONS,
    },
    {
      key: "finalTriage",
      label: "Final triage",
      options: FINAL_TRIAGE_WITH_WHITE_OPTIONS,
    },
  ],
  mptt: [
    {
      key: "catastrophicHemorrhage",
      label: "Catastrophic hemorrhage?",
      options: YES_NO_OPTIONS,
    },
    { key: "canWalk", label: "Can walk?", options: YES_NO_OPTIONS },
    {
      key: "spontaneousBreathing",
      label: "Spontaneous breathing?",
      options: YES_NO_OPTIONS,
    },
    {
      key: "respondsToVoice",
      label: "Responds to voice?",
      options: YES_NO_OPTIONS,
    },
    {
      key: "respirations",
      label: "Respirations",
      options: [
        { label: "Absent", value: "absent" },
        { label: "Less than 12", value: "less_than_12" },
        { label: "More than 23", value: "more_than_23" },
        { label: "12-23", value: "12_to_23" },
      ],
    },
    {
      key: "heartRate",
      label: "Heart rate",
      options: [
        { label: "Absent", value: "absent" },
        { label: "More than 100", value: "more_than_100" },
        { label: "Less than 100", value: "less_than_100" },
        { label: "100", value: "100" },
      ],
    },
    {
      key: "finalTriage",
      label: "Final triage",
      options: FINAL_TRIAGE_COLOR_OPTIONS,
    },
  ],
  mass: [
    {
      key: "lifeSavingInterventionPerformed",
      label: "Life-saving intervention already performed?",
      options: YES_NO_OPTIONS,
    },
    {
      key: "breathing",
      label: "With spontaneous breathing?",
      options: YES_NO_OPTIONS,
    },
    {
      key: "obeysCommands",
      label: "Obeys commands?",
      options: YES_NO_OPTIONS,
    },
    {
      key: "breathingNormally",
      label: "Breathing normally?",
      options: YES_NO_OPTIONS,
    },
    {
      key: "purposefulMovements",
      label: "With purposeful movements?",
      options: YES_NO_OPTIONS,
    },
    {
      key: "majorBleedingControlled",
      label: "Major bleeding is controlled?",
      options: YES_NO_OPTIONS,
    },
    {
      key: "radialPulse",
      label: "Radial pulse",
      options: PRESENT_ABSENT_OPTIONS,
    },
    {
      key: "minorInjuriesOnly",
      label: "Minor injuries only?",
      options: YES_NO_OPTIONS,
    },
    {
      key: "likelyToSurviveGivenResources",
      label: "Likely to survive with current resources?",
      options: YES_NO_OPTIONS,
    },
    {
      key: "finalTriage",
      label: "Final triage",
      options: FINAL_TRIAGE_COLOR_OPTIONS,
    },
  ],
  esi: [
    {
      key: "requiresImmediateLifeSavingIntervention",
      label: "Requires immediate life-saving intervention?",
      options: YES_NO_OPTIONS,
    },
    {
      key: "highRiskSituation",
      label: "High-risk situation?",
      options: YES_NO_OPTIONS,
    },
    {
      key: "painScore",
      label: "Pain score",
      inputType: "numeric",
    },
    {
      key: "resourcesNeeded",
      label: "Resources needed to stabilize patient",
      options: [
        { label: "None", value: "none" },
        { label: "One", value: "one" },
        { label: "Multiple", value: "multiple" },
      ],
    },
    {
      key: "finalTriage",
      label: "Final triage",
      options: ESI_TRIAGE_OPTIONS,
    },
  ],
  metts: [
    {
      key: "airway",
      label: "Airway",
      options: [
        { label: "Obstructed", value: "obstructed" },
        { label: "Unobstructed", value: "unobstructed" },
      ],
    },
    {
      key: "stridor",
      label: "Stridor",
      options: PRESENT_ABSENT_OPTIONS,
    },
    {
      key: "oxygenSaturation",
      label: "Oxygen saturation",
      options: [
        { label: "Less than 90%", value: "less_than_90" },
        { label: "90-95%", value: "90_to_95" },
        { label: "More than 95%", value: "more_than_95" },
      ],
    },
    {
      key: "oxygenSupport",
      label: "Oxygen support",
      options: PRESENT_ABSENT_OPTIONS,
    },
    {
      key: "respirations",
      label: "Respirations",
      options: [
        { label: "More than 30", value: "more_than_30" },
        { label: "26-29", value: "26_to_29" },
        { label: "8-25", value: "8_to_25" },
        { label: "Less than 8", value: "less_than_8" },
      ],
    },
    {
      key: "pulseRate",
      label: "Pulse rate",
      options: [
        { label: "Irregular more than 150", value: "irregular_more_than_150" },
        { label: "Regular more than 130", value: "regular_more_than_130" },
        { label: "121-130", value: "121_to_130" },
        { label: "111-120", value: "111_to_120" },
        { label: "50-110", value: "50_to_110" },
        { label: "40-49", value: "40_to_49" },
        { label: "Less than 40", value: "less_than_40" },
      ],
    },
    {
      key: "systolicBloodPressure",
      label: "Systolic blood pressure",
      options: [
        { label: "Less than 90 mmHg", value: "less_than_90" },
        { label: "More than 90 mmHg", value: "more_than_90" },
      ],
    },
    {
      key: "consciousness",
      label: "Consciousness",
      options: [
        { label: "Alert and conscious", value: "alert_conscious" },
        { label: "Disoriented", value: "disoriented" },
        { label: "Unconscious", value: "unconscious" },
      ],
    },
    {
      key: "ongoingSeizures",
      label: "Ongoing seizures",
      options: PRESENT_ABSENT_OPTIONS,
    },
    {
      key: "glasgowComaScale",
      label: "Glasgow Coma Scale",
      inputType: "numeric",
    },
    {
      key: "temperature",
      label: "Temperature",
      options: [
        { label: "More than 41 C", value: "more_than_41" },
        { label: "38.6-40.9 C", value: "38_6_to_40_9" },
        { label: "35-38.5 C", value: "35_to_38_5" },
        { label: "Less than 35 C", value: "less_than_35" },
      ],
    },
    {
      key: "finalTriage",
      label: "Final triage",
      options: METTS_TRIAGE_OPTIONS,
    },
  ],
};

const TRIAGE_STAGE_OPTIONS = [
  "Primary Triage",
  "Secondary Triage",
  "Tertiary Triage",
] as const;

type TriageStageOption = (typeof TRIAGE_STAGE_OPTIONS)[number];

const TRIAGE_STAGE_OPTIONS_BY_ROLE: Record<string, TriageStageOption[]> = {
  field_responder: ["Primary Triage"],
  responder: ["Primary Triage", "Secondary Triage"],
  sa_responder: ["Secondary Triage"],
  medical_personnel: ["Tertiary Triage"],
  documenter: ["Tertiary Triage"],
};

const TRIAGE_STAGE_OPTIONS_BY_REPORTING_CONTEXT: Record<
  ReportingContext,
  TriageStageOption[]
> = {
  scene: ["Primary Triage"],
  transport: ["Secondary Triage"],
  receiving_facility_ed: ["Tertiary Triage"],
  hospital_ward: ["Tertiary Triage"],
  evacuation_center: ["Secondary Triage"],
  command_admin: [...TRIAGE_STAGE_OPTIONS],
};

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

const TREATMENT_STRATEGY_OPTIONS = [
  "No (Scoop and Run)",
  "No (SCOOTER)",
  "Yes (Stay and Play)",
  "Partly (Play and Run)",
  "Unknown",
] as const;

const TRANSFERRED_OUT_OPTIONS = ["Yes", "No", "Unknown"] as const;
const ED_CARE_OPTIONS = ["Yes", "No", "Unknown"] as const;
const DEATH_STAGE_OPTIONS = [
  "Impact",
  "Pre-hospital",
  "In-hospital",
] as const;
const FINAL_DISPOSITION_OPTIONS = [
  "Alive",
  "Deceased",
  "Transferred",
  "Discharged",
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
  "admin",
  "administrator",
  "encoder",
] as const;

type StepName = (typeof ALL_STEPS)[number];

type AddCasualtyStep = StepName;

const STEP_PROGRESS_LABELS: Record<StepName, string> = {
  Safety: "SAFE",
  Intro: "INTRO",
  Info: "INFO",
  "General Information": "GENERAL",
  "Patient Information": "PATIENT",
  Personal: "INFO",
  Address: "ADDR",
  Incident: "INC",
  Triage: "TRIAGE",
  Status: "STATUS",
  Treatment: "CARE",
  Management: "MGMT",
  Disposition: "DISPO",
  Transport: "TRANS",
  "Hospital Care": "CARE",
  Remarks: "NOTES",
};

type ChoiceSheetName =
  | "sex"
  | "witnessPresent"
  | "witnessResponse"
  | "cprType"
  | "newborn"
  | "pregnant"
  | "fillPatientCareReport"
  | "fieldResponderVictimCode"
  | "patientIdentified"
  | "patientFor"
  | "conditionBeforeRelease"
  | "releaseMedicalContact"
  | "conditionBeforeTransfer"
  | "transferMedicalContact"
  | "usedEmsVehicle"
  | "emsVehicleType"
  | "transferPrecaution"
  | "releaseLiabilityAccepted"
  | "dispositionUponHospitalArrival"
  | "resuscitationRoomUsed"
  | "surgicalInterventionRequired"
  | "operatingRoomUsed"
  | "admittedToUnit"
  | "currentlyAdmittedInIcu"
  | "transferredToWard"
  | "inActiveCare"
  | "incident"
  | "evacuationCenter"
  | "healthcareFacility"
  | "disasterType"
  | "facilityLevel"
  | "triageSystem"
  | "triageStage"
  | "transportRequired"
  | "transportMode"
  | "emsUnitType"
  | "treatmentStrategy"
  | "transferredOutOfHospital"
  | "soughtEdCare"
  | "admittedAfterEd"
  | "dischargedAfterEd"
  | "xrayRequired"
  | "ultrasoundRequired"
  | "ctRequired"
  | "mechanicalVentilationRequired"
  | "alternativeIcuUsed"
  | "died"
  | "deathStage"
  | "reachedHospital"
  | "medicalContactBeforeDeath"
  | "finalDisposition"
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
  responderSafetyStatus: string;
  ppeUseTime: string;
  victimCodeMarked: string;

  witnessPresent: string;
  witnessOther: string;
  witnessResponse: string;
  cprType: string;

  victimCode: string;
  userCode: string;
  patientIdentified: string;
  idNumber: string;
  age: string;
  firstName: string;
  middleName: string;
  lastName: string;
  sex: string;
  dateOfBirth: string;
  newborn: string;
  pregnant: string;
  religion: string;
  contactNumber: string;

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
  triageSystemOther: string;
  triageAssessmentAnswers: Record<string, string>;

  transportRequired: string;
  patientFor: string;
  conditionBeforeRelease: string;
  releaseMedicalContact: string;
  conditionBeforeTransfer: string;
  transferMedicalContact: string;
  usedEmsVehicle: string;
  emsVehicleType: string;
  transferPrecaution: string;
  receivingFacilityText: string;
  vehicleMakeModelPlate: string;
  patientReceivedByPhysician: string;
  patientReceivedByNurse: string;
  releaseLiabilityAccepted: string;
  transportMode: string;
  emsUnitType: string;
  arrivedSceneTime: string;
  departedSceneTime: string;
  arrivedFacilityTime: string;
  transportNotes: string;

  treatmentStrategy: string;
  fillPatientCareReport: string;
  disasterPlanActivationTime: string;
  dispositionUponHospitalArrival: string;
  resuscitationRoomUsed: string;
  surgicalInterventionRequired: string;
  operatingRoomUsed: string;
  numberOfOperatingRooms: string;
  admittedToUnit: string;
  currentlyAdmittedInIcu: string;
  transferredToWard: string;
  inActiveCare: string;
  treatmentAreaName: string;
  stabilizationStartedTime: string;
  stabilizedTime: string;
  treatmentNotes: string;
  transferredOutOfHospital: string;
  soughtEdCare: string;
  admittedAfterEd: string;
  dischargedAfterEd: string;
  edAdmissionTime: string;
  edTransferOutTime: string;
  edResuscitationTime: string;
  hospitalAdmissionTime: string;
  hospitalDischargeTime: string;
  surgicalInterventionStartTime: string;
  surgicalInterventionEndTime: string;
  operatingRoomTime: string;
  xrayRequired: string;
  xrayTime: string;
  ultrasoundRequired: string;
  ultrasoundTime: string;
  ctRequired: string;
  ctTime: string;
  icuAdmissionTime: string;
  icuTransferOutTime: string;
  mechanicalVentilationRequired: string;
  ventilationStartTime: string;
  ventilationEndTime: string;
  alternativeIcuUsed: string;
  died: string;
  deathStage: string;
  deathTime: string;
  reachedHospital: string;
  medicalContactBeforeDeath: string;
  finalDisposition: string;

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
  responderSafetyStatus: "",
  ppeUseTime: "",
  victimCodeMarked: "",

  witnessPresent: "",
  witnessOther: "",
  witnessResponse: "",
  cprType: "",

  victimCode: "",
  userCode: "",
  patientIdentified: "",
  idNumber: "",
  age: "",
  firstName: "",
  middleName: "",
  lastName: "",
  sex: "",
  dateOfBirth: "",
  newborn: "",
  pregnant: "",
  religion: "",
  contactNumber: "",

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
  triageSystemOther: "",
  triageAssessmentAnswers: {},

  transportRequired: "",
  patientFor: "",
  conditionBeforeRelease: "",
  releaseMedicalContact: "",
  conditionBeforeTransfer: "",
  transferMedicalContact: "",
  usedEmsVehicle: "",
  emsVehicleType: "",
  transferPrecaution: "",
  receivingFacilityText: "",
  vehicleMakeModelPlate: "",
  patientReceivedByPhysician: "",
  patientReceivedByNurse: "",
  releaseLiabilityAccepted: "",
  transportMode: "",
  emsUnitType: "",
  arrivedSceneTime: "",
  departedSceneTime: "",
  arrivedFacilityTime: "",
  transportNotes: "",

  treatmentStrategy: "",
  fillPatientCareReport: "",
  disasterPlanActivationTime: "",
  dispositionUponHospitalArrival: "",
  resuscitationRoomUsed: "",
  surgicalInterventionRequired: "",
  operatingRoomUsed: "",
  numberOfOperatingRooms: "",
  admittedToUnit: "",
  currentlyAdmittedInIcu: "",
  transferredToWard: "",
  inActiveCare: "",
  treatmentAreaName: "",
  stabilizationStartedTime: "",
  stabilizedTime: "",
  treatmentNotes: "",
  transferredOutOfHospital: "",
  soughtEdCare: "",
  admittedAfterEd: "",
  dischargedAfterEd: "",
  edAdmissionTime: "",
  edTransferOutTime: "",
  edResuscitationTime: "",
  hospitalAdmissionTime: "",
  hospitalDischargeTime: "",
  surgicalInterventionStartTime: "",
  surgicalInterventionEndTime: "",
  operatingRoomTime: "",
  xrayRequired: "",
  xrayTime: "",
  ultrasoundRequired: "",
  ultrasoundTime: "",
  ctRequired: "",
  ctTime: "",
  icuAdmissionTime: "",
  icuTransferOutTime: "",
  mechanicalVentilationRequired: "",
  ventilationStartTime: "",
  ventilationEndTime: "",
  alternativeIcuUsed: "",
  died: "",
  deathStage: "",
  deathTime: "",
  reachedHospital: "",
  medicalContactBeforeDeath: "",
  finalDisposition: "",

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
type TreatmentRecord =
  NonNullable<CreateCasualtyPayload["treatmentRecord"]>;
type TreatmentStrategy = TreatmentRecord["treatmentStrategy"];
type CasualtyOutcome =
  NonNullable<CreateCasualtyPayload["casualtyOutcome"]>;
type DeathStage = NonNullable<CasualtyOutcome["deathStage"]>;
type FinalDisposition =
  NonNullable<CasualtyOutcome["finalDisposition"]>;

type SubmissionFeedback = {
  title: string;
  message: string;
  onCloseRoute?: string;
  resetOnClose?: boolean;
};

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

function parseMultiSelectValue(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatMultiSelectValue(values: string[]): string {
  return values.join(", ");
}

function generateUserCodeFromName(
  fullName: string | null | undefined,
): string {
  const normalizedName = fullName?.trim();

  if (!normalizedName) {
    return "";
  }

  return normalizedName
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function calculateAgeFromDateOfBirth(value: string): string {
  const dateOfBirth = getValidDateInput(value);

  if (!dateOfBirth) {
    return "";
  }

  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const birthdayHasPassed =
    today.getMonth() > dateOfBirth.getMonth() ||
    (
      today.getMonth() === dateOfBirth.getMonth() &&
      today.getDate() >= dateOfBirth.getDate()
    );

  if (!birthdayHasPassed) {
    age -= 1;
  }

  return age >= 0 ? String(age) : "";
}

function extractVictimCodeFromTriageNotes(
  notes: string | null | undefined,
): string {
  const match = /Victim code:\s*([^\r\n]+)/i.exec(notes ?? "");

  return match?.[1]?.trim() ?? "";
}

function formatLinkedCasualtyLabel(
  record: CasualtyRecord,
  victimCode: string,
): string {
  const fullName = [
    record.casualty.first_name,
    record.casualty.middle_name,
    record.casualty.last_name,
  ]
    .filter(
      (part): part is string =>
        typeof part === "string" && part.trim().length > 0,
    )
    .join(" ");
  const context =
    fullName || record.casualty.id_number || record.client_record_id;

  return context ? `${victimCode} - ${context}` : victimCode;
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
    case "stieve":
      return "stieve";
    case "nato":
      return "nato";
    case "mstart":
    case "m start":
      return "mstart";
    case "jumpstart":
    case "jump start":
      return "jumpstart";
    case "sieve":
      return "sieve";
    case "save":
      return "save";
    case "sort":
      return "sort";
    case "meta":
      return "meta";
    case "swift":
      return "swift";
    case "sieve/sort":
    case "sieve / sort":
      return "sieve_sort";
    case "smart":
      return "smart";
    case "rts":
      return "rts";
    case "care flight":
      return "care_flight";
    case "mass":
      return "mass";
    case "esi":
      return "esi";
    case "metts":
      return "metts";
    case "salt":
      return "salt";
    case "ptt":
      return "ptt";
    case "mitt":
      return "mitt";
    case "homebush":
      return "homebush";
    case "mptt":
      return "mptt";
    case "stm":
      return "stm";
    case "ed triage":
      return "ed_triage";
    case "other":
      return "other";
    case "start":
    default:
      return "start";
  }
}

function normalizeTriageStage(value: string): TriageStage {
  switch (value.trim().toLowerCase()) {
    case "tertiary triage":
    case "tertiary":
    case "facility arrival":
      return "facility_arrival";
    case "secondary triage":
    case "secondary":
    case "reassessment":
      return "reassessment";
    case "primary triage":
    case "primary":
    case "on-site":
    default:
      return "on_site";
  }
}

function triageColorToCategory(
  value: string | undefined,
): TriageCategory {
  switch (value) {
    case "red":
      return "immediate";
    case "yellow":
      return "delayed";
    case "green":
    case "white":
      return "minimal";
    case "black":
      return "expectant";
    default:
      return "unknown";
  }
}

function triageFinalAnswerToCategory(
  system: string,
  value: string | undefined,
): TriageCategory {
  const normalizedSystem = normalizeTriageSystem(system);

  if (normalizedSystem === "esi" || normalizedSystem === "metts") {
    return "unknown";
  }

  return triageColorToCategory(value);
}

function readAssessmentString(
  answers: Record<string, unknown>,
  key: string,
): string | null {
  const value = answers[key];

  return typeof value === "string" ? value : null;
}

function readAssessmentBoolean(
  answers: Record<string, unknown>,
  key: string,
): boolean | null {
  const value = answers[key];

  return typeof value === "boolean" ? value : null;
}

function readAssessmentNumber(
  answers: Record<string, unknown>,
  key: string,
): number | null {
  const value = answers[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function scoreSortValue(
  value: string | null,
  scores: Record<string, number>,
): number | null {
  return value ? scores[value] ?? null : null;
}

function calculateStartLikeTriage(
  answers: Record<string, unknown>,
): TriageCategory {
  if (readAssessmentBoolean(answers, "canWalk") === true) {
    return "minimal";
  }

  if (
    readAssessmentBoolean(answers, "spontaneousBreathing") === false ||
    readAssessmentString(answers, "respirations") === "absent"
  ) {
    return readAssessmentBoolean(
      answers,
      "breathingAfterAirwayManagement",
    ) === true
      ? "immediate"
      : "expectant";
  }

  const respirations = readAssessmentString(answers, "respirations");

  if (!respirations) {
    return "unknown";
  }

  if (respirations === "more_than_30") {
    return "immediate";
  }

  if (
    readAssessmentString(answers, "capillaryRefill") ===
      "more_than_2_seconds" ||
    readAssessmentString(answers, "radialPulse") === "absent" ||
    readAssessmentBoolean(answers, "followsSimpleCommands") === false
  ) {
    return "immediate";
  }

  return readAssessmentBoolean(answers, "followsSimpleCommands") === true
    ? "delayed"
    : "unknown";
}

function calculateStieveTriage(
  answers: Record<string, unknown>,
): TriageCategory {
  const specialPopulation = readAssessmentBoolean(
    answers,
    "specialPopulation",
  );

  if (specialPopulation === true) {
    return "immediate";
  }

  if (
    readAssessmentBoolean(answers, "canWalkOrNoVisibleInjuries") ===
      true
  ) {
    return specialPopulation === false ? "minimal" : "unknown";
  }

  if (
    readAssessmentBoolean(answers, "catastrophicHemorrhage") === true ||
    readAssessmentBoolean(answers, "suckingChestWound") === true
  ) {
    return "immediate";
  }

  if (readAssessmentString(answers, "respirations") === "absent") {
    const breathingAfterAirway = readAssessmentBoolean(
      answers,
      "breathingAfterAirwayManagement",
    );

    if (breathingAfterAirway === true) {
      return "immediate";
    }

    return breathingAfterAirway === false ? "expectant" : "unknown";
  }

  if (
    readAssessmentString(answers, "respirations") === "less_than_10" ||
    readAssessmentString(answers, "respirations") === "more_than_30"
  ) {
    return "immediate";
  }

  if (readAssessmentString(answers, "respirations") !== "10_to_29") {
    return "unknown";
  }

  if (
    readAssessmentString(answers, "pulse") === "absent" ||
    readAssessmentString(answers, "pulse") === "weak" ||
    readAssessmentString(answers, "capillaryRefill") ===
      "more_than_2_seconds" ||
    readAssessmentBoolean(answers, "followsSimpleCommands") === false
  ) {
    return "immediate";
  }

  const hasAdequatePerfusion =
    readAssessmentString(answers, "pulse") === "strong" ||
    readAssessmentString(answers, "capillaryRefill") ===
      "less_than_or_equal_to_2_seconds";

  if (!hasAdequatePerfusion) {
    return "unknown";
  }

  return readAssessmentBoolean(answers, "followsSimpleCommands") === true
    ? "delayed"
    : "unknown";
}

function calculateMstartTriage(
  answers: Record<string, unknown>,
): TriageCategory {
  if (readAssessmentBoolean(answers, "canWalk") === true) {
    return "minimal";
  }

  if (
    readAssessmentBoolean(answers, "spontaneousBreathing") === false ||
    readAssessmentString(answers, "respirations") === "absent"
  ) {
    return readAssessmentBoolean(
      answers,
      "breathingAfterAirwayManagement",
    ) === true
      ? "immediate"
      : "expectant";
  }

  if (readAssessmentString(answers, "respirations") === "more_than_30") {
    return "immediate";
  }

  if (
    readAssessmentString(answers, "radialPulse") === "absent" ||
    readAssessmentBoolean(answers, "followsSimpleCommands") === false
  ) {
    return "immediate";
  }

  return readAssessmentString(answers, "respirations")
    ? "delayed"
    : "unknown";
}

function calculateJumpstartTriage(
  answers: Record<string, unknown>,
): TriageCategory {
  if (readAssessmentBoolean(answers, "canWalk") === true) {
    return "minimal";
  }

  if (
    readAssessmentBoolean(answers, "spontaneousBreathing") === false ||
    readAssessmentString(answers, "respirations") === "absent"
  ) {
    if (
      readAssessmentBoolean(
        answers,
        "breathingAfterAirwayManagement",
      ) === true
    ) {
      return "immediate";
    }

    if (
      readAssessmentBoolean(
        answers,
        "palpablePulseAfterAirwayManagement",
      ) === false
    ) {
      return "expectant";
    }

    return readAssessmentBoolean(
      answers,
      "breathingAfterRescueBreaths",
    ) === true
      ? "immediate"
      : "expectant";
  }

  const respirations = readAssessmentString(answers, "respirations");

  if (
    respirations === "less_than_15" ||
    respirations === "more_than_45" ||
    readAssessmentString(answers, "radialPulse") === "absent" ||
    readAssessmentString(answers, "mentalStatus") === "painful" ||
    readAssessmentString(answers, "mentalStatus") === "unresponsive"
  ) {
    return "immediate";
  }

  return respirations ? "delayed" : "unknown";
}

function calculateSieveTriage(
  answers: Record<string, unknown>,
): TriageCategory {
  if (readAssessmentBoolean(answers, "canWalk") === true) {
    return readAssessmentString(answers, "injury") === "present"
      ? "delayed"
      : "minimal";
  }

  const respirations = readAssessmentString(answers, "respirations");

  if (respirations === "absent") {
    return readAssessmentBoolean(
      answers,
      "breathingAfterAirwayManagement",
    ) === true
      ? "immediate"
      : "expectant";
  }

  if (
    respirations === "less_than_10" ||
    respirations === "less_than_or_equal_to_10" ||
    respirations === "more_than_29" ||
    respirations === "more_than_or_equal_to_30"
  ) {
    return "immediate";
  }

  if (
    readAssessmentString(answers, "heartRate") === "more_than_120" ||
    readAssessmentString(answers, "capillaryRefill") ===
      "more_than_2_seconds"
  ) {
    return "immediate";
  }

  return respirations ? "delayed" : "unknown";
}

function calculateSortTriage(
  answers: Record<string, unknown>,
): TriageCategory {
  const gcsScore = scoreSortValue(readAssessmentString(answers, "gcs"), {
    "13_to_15": 4,
    "9_to_12": 3,
    "6_to_8": 2,
    "4_to_5": 1,
    "3": 0,
  });
  const respiratoryRateScore = scoreSortValue(
    readAssessmentString(answers, "respiratoryRate"),
    {
      "10_to_29": 4,
      "more_than_29": 3,
      "more_than_or_equal_to_30": 3,
      "6_to_9": 2,
      "1_to_5": 1,
      "0": 0,
    },
  );
  const systolicBpScore = scoreSortValue(
    readAssessmentString(answers, "systolicBp"),
    {
      "more_than_80": 4,
      "more_than_89": 4,
      "more_than_or_equal_to_90": 4,
      "76_to_80": 3,
      "76_to_89": 3,
      "50_to_75": 2,
      "1_to_49": 1,
      "0": 0,
    },
  );

  if (
    gcsScore === null ||
    respiratoryRateScore === null ||
    systolicBpScore === null
  ) {
    return "unknown";
  }

  const totalScore = gcsScore + respiratoryRateScore + systolicBpScore;

  if (totalScore === 0) {
    return "expectant";
  }

  if (totalScore <= 10) {
    return "immediate";
  }

  if (totalScore === 11) {
    return "delayed";
  }

  return "minimal";
}

function calculateSaveTriage(
  answers: Record<string, unknown>,
): TriageCategory {
  switch (readAssessmentString(answers, "saveCategory")) {
    case "immediate_intervention_to_live":
      return "immediate";
    case "brief_delay_tolerated":
      return "delayed";
    case "no_life_or_limb_intervention_needed":
      return "minimal";
    case "dead_unsalvageable":
      return "expectant";
    default:
      return "unknown";
  }
}

function calculateMetaTriage(
  answers: Record<string, unknown>,
): TriageCategory {
  if (
    readAssessmentBoolean(answers, "airwayRisk") === true ||
    readAssessmentBoolean(answers, "breathingRisk") === true ||
    readAssessmentBoolean(answers, "circulationRisk") === true
  ) {
    return "immediate";
  }

  if (
    readAssessmentBoolean(answers, "disabilityRisk") === true ||
    readAssessmentBoolean(answers, "exposureRisk") === true
  ) {
    return "delayed";
  }

  const answeredKeys = [
    "airwayRisk",
    "breathingRisk",
    "circulationRisk",
    "disabilityRisk",
    "exposureRisk",
  ];
  const allAnswered = answeredKeys.every(
    (key) => readAssessmentBoolean(answers, key) !== null,
  );

  return allAnswered ? "minimal" : "unknown";
}

function calculateCareFlightTriage(
  answers: Record<string, unknown>,
): TriageCategory {
  if (readAssessmentBoolean(answers, "canWalk") === true) {
    return "minimal";
  }

  if (
    readAssessmentBoolean(answers, "breathingWithOpenAirway") === false
  ) {
    return "expectant";
  }

  if (
    readAssessmentBoolean(answers, "canObeyCommands") === false ||
    readAssessmentString(answers, "palpableRadialPulse") === "absent"
  ) {
    return "immediate";
  }

  return readAssessmentBoolean(answers, "canObeyCommands") === true
    ? "delayed"
    : "unknown";
}

function calculateSaltTriage(
  answers: Record<string, unknown>,
): TriageCategory {
  if (
    readAssessmentBoolean(answers, "canWalk") === true ||
    readAssessmentBoolean(answers, "canWave") === true
  ) {
    return "minimal";
  }

  if (
    readAssessmentBoolean(answers, "breathing") === false ||
    readAssessmentString(answers, "respirations") === "absent"
  ) {
    return readAssessmentBoolean(
      answers,
      "breathingAfterAirwayManagement",
    ) === true
      ? "immediate"
      : "expectant";
  }

  const stable =
    readAssessmentBoolean(answers, "breathing") === true &&
    readAssessmentBoolean(
      answers,
      "obeysCommandsOrPurposefulMovement",
    ) === true &&
    readAssessmentBoolean(answers, "hasPeripheralPulse") === true &&
    readAssessmentBoolean(answers, "respiratoryDistress") === false &&
    readAssessmentBoolean(answers, "majorHemorrhageControlled") === true;

  if (
    !stable &&
    readAssessmentBoolean(answers, "likelyToSurviveGivenResources") ===
      false
  ) {
    return "expectant";
  }

  if (!stable) {
    return readAssessmentBoolean(
      answers,
      "likelyToSurviveGivenResources",
    ) === true
      ? "immediate"
      : "unknown";
  }

  if (readAssessmentBoolean(answers, "minorInjuriesOnly") === true) {
    return "minimal";
  }

  if (readAssessmentBoolean(answers, "minorInjuriesOnly") === false) {
    return "delayed";
  }

  return "unknown";
}

function getPttNormalRanges(
  height: string | null,
): {
  minRespiratoryRate: number;
  maxRespiratoryRate: number;
  minPulseRate: number;
  maxPulseRate: number;
} | null {
  switch (height) {
    case "40_to_80_cm":
      return {
        minRespiratoryRate: 20,
        maxRespiratoryRate: 50,
        minPulseRate: 90,
        maxPulseRate: 180,
      };
    case "80_to_100_cm":
      return {
        minRespiratoryRate: 15,
        maxRespiratoryRate: 40,
        minPulseRate: 80,
        maxPulseRate: 160,
      };
    case "100_to_140_cm":
      return {
        minRespiratoryRate: 10,
        maxRespiratoryRate: 30,
        minPulseRate: 70,
        maxPulseRate: 140,
      };
    default:
      return null;
  }
}

function calculatePttTriage(
  answers: Record<string, unknown>,
): TriageCategory {
  if (
    readAssessmentBoolean(answers, "spontaneousBreathing") === false &&
    readAssessmentBoolean(answers, "breathingAfterAirwayManagement") !==
      true
  ) {
    return "expectant";
  }

  if (
    readAssessmentBoolean(
      answers,
      "breathingAfterAirwayManagement",
    ) === true
  ) {
    return "immediate";
  }

  if (
    readAssessmentBoolean(answers, "alertAndMovingAllLimbs") === false
  ) {
    return "immediate";
  }

  const ranges = getPttNormalRanges(
    readAssessmentString(answers, "height"),
  );
  const respiratoryRate = readAssessmentNumber(
    answers,
    "pttRespiratoryRate",
  );
  const pulseRate = readAssessmentNumber(answers, "pttPulseRate");

  if (!ranges || respiratoryRate === null || pulseRate === null) {
    return "unknown";
  }

  if (
    respiratoryRate < ranges.minRespiratoryRate ||
    respiratoryRate > ranges.maxRespiratoryRate ||
    pulseRate < ranges.minPulseRate ||
    pulseRate > ranges.maxPulseRate ||
    readAssessmentString(answers, "capillaryRefill") ===
      "more_than_2_seconds"
  ) {
    return "immediate";
  }

  return readAssessmentBoolean(answers, "alertAndMovingAllLimbs") === true
    ? "minimal"
    : "delayed";
}

function calculateMittTriage(
  answers: Record<string, unknown>,
): TriageCategory {
  if (
    readAssessmentBoolean(answers, "catastrophicHemorrhage") === true
  ) {
    return "immediate";
  }

  if (readAssessmentBoolean(answers, "canWalk") === true) {
    return "minimal";
  }

  if (
    readAssessmentBoolean(answers, "spontaneousBreathing") === false ||
    readAssessmentString(answers, "respirations") === "absent"
  ) {
    return "expectant";
  }

  if (
    readAssessmentBoolean(answers, "respondsToVoice") === false ||
    readAssessmentString(answers, "respirations") === "less_than_12" ||
    readAssessmentString(answers, "respirations") === "more_than_23" ||
    readAssessmentString(answers, "heartRate") === "absent" ||
    readAssessmentString(answers, "heartRate") === "more_than_100"
  ) {
    return "immediate";
  }

  return readAssessmentString(answers, "respirations")
    ? "delayed"
    : "unknown";
}

function calculateMassTriage(
  answers: Record<string, unknown>,
): TriageCategory {
  if (
    readAssessmentBoolean(
      answers,
      "lifeSavingInterventionPerformed",
    ) === true
  ) {
    return "immediate";
  }

  if (readAssessmentBoolean(answers, "breathing") === false) {
    return "expectant";
  }

  const stable =
    readAssessmentBoolean(answers, "breathing") === true &&
    readAssessmentBoolean(answers, "obeysCommands") === true &&
    readAssessmentBoolean(answers, "breathingNormally") === true &&
    readAssessmentBoolean(answers, "purposefulMovements") === true &&
    readAssessmentBoolean(answers, "majorBleedingControlled") === true &&
    readAssessmentString(answers, "radialPulse") === "present";

  if (!stable) {
    return readAssessmentBoolean(
      answers,
      "likelyToSurviveGivenResources",
    ) === false
      ? "expectant"
      : readAssessmentBoolean(
            answers,
            "likelyToSurviveGivenResources",
          ) === true
        ? "immediate"
        : "unknown";
  }

  if (readAssessmentBoolean(answers, "minorInjuriesOnly") === true) {
    return "minimal";
  }

  if (readAssessmentBoolean(answers, "minorInjuriesOnly") === false) {
    return "delayed";
  }

  return "unknown";
}

function calculateUrgentNonUrgentTriage(
  answers: Record<string, unknown>,
): TriageCategory {
  const urgent = readAssessmentBoolean(answers, "urgent");

  if (urgent === true) {
    return "immediate";
  }

  if (urgent === false) {
    return "minimal";
  }

  return "unknown";
}

function calculateSmartTriage(
  answers: Record<string, unknown>,
): TriageCategory {
  if (readAssessmentBoolean(answers, "walking") === true) {
    return "minimal";
  }

  const breathing = readAssessmentBoolean(answers, "breathing");

  if (breathing === false) {
    return "expectant";
  }

  if (
    readAssessmentBoolean(
      answers,
      "obeysCommandsOrPurposefulMovement",
    ) === false ||
    readAssessmentBoolean(answers, "hasPeripheralPulse") === false
  ) {
    return "immediate";
  }

  return breathing === true ? "delayed" : "unknown";
}

function calculateEsiFinalTriage(
  answers: Record<string, unknown>,
): string {
  const immediateLifeSaving = readAssessmentBoolean(
    answers,
    "requiresImmediateLifeSavingIntervention",
  );

  /*
   * ESI decision point A:
   * Immediate life-saving intervention required
   */
  if (immediateLifeSaving === true) {
    return "esi_1";
  }

  /*
   * Do not continue until the first question is answered.
   */
  if (immediateLifeSaving === null) {
    return "";
  }

  const highRisk = readAssessmentBoolean(
    answers,
    "highRiskSituation",
  );

  const painScore = readAssessmentNumber(
    answers,
    "painScore",
  );

  /*
   * ESI decision point B:
   * High-risk / should not wait.
   *
   * Severe pain is also treated here as an ESI 2 indicator.
   */
  if (
    highRisk === true ||
    (painScore !== null && painScore >= 7)
  ) {
    return "esi_2";
  }

  /*
   * We need the high-risk question answered before
   * proceeding to resources.
   */
  if (highRisk === null) {
    return "";
  }

  const resourcesNeeded = readAssessmentString(
    answers,
    "resourcesNeeded",
  );

  /*
   * ESI decision point C
   */
  if (resourcesNeeded === "none") {
    return "esi_5";
  }

  if (resourcesNeeded === "one") {
    return "esi_4";
  }

  if (resourcesNeeded === "multiple") {
    /*
     * For now this becomes ESI 3.
     *
     * Your current form does not yet collect the danger-zone
     * vital signs shown in the ESI flowchart, so automatic
     * reconsideration for ESI 2 cannot be done here yet.
     */
    return "esi_3";
  }

  return "";
}

function calculateMobileTriageCategory(
  triageSystem: string,
  assessmentAnswers: Record<string, unknown> | undefined,
): TriageCategory {
  if (!assessmentAnswers) {
    return "unknown";
  }

  const { finalTriage: _ignoredFinalTriage, ...algorithmAnswers } =
    assessmentAnswers;

  switch (normalizeTriageSystem(triageSystem)) {
    case "start":
      return calculateStartLikeTriage(algorithmAnswers);
    case "stieve":
      return calculateStieveTriage(algorithmAnswers);
    case "mstart":
      return calculateMstartTriage(algorithmAnswers);
    case "jumpstart":
      return calculateJumpstartTriage(algorithmAnswers);
    case "nato":
      return calculateNatoTriage(algorithmAnswers);
    case "sieve":
    case "sieve_sort":
      return calculateSieveTriage(algorithmAnswers);
    case "care_flight":
      return calculateCareFlightTriage(algorithmAnswers);
    case "salt":
      return calculateSaltTriage(algorithmAnswers);
    case "ptt":
      return calculatePttTriage(algorithmAnswers);
    case "mitt":
    case "mptt":
      return calculateMittTriage(algorithmAnswers);
    case "homebush":
      return calculateStartLikeTriage(algorithmAnswers);
    case "sort":
    case "rts":
      return calculateSortTriage(algorithmAnswers);
    case "save":
      return calculateSaveTriage(algorithmAnswers);
    case "meta":
      return calculateMetaTriage(algorithmAnswers);
    case "mass":
      return calculateMassTriage(algorithmAnswers);
    case "urgent_non_urgent":
      return calculateUrgentNonUrgentTriage(algorithmAnswers);
    case "smart":
      return calculateSmartTriage(algorithmAnswers);
    case "esi":
    case "metts":
    case "ed_triage":
    case "stm":
    case "swift":
    case "other":
      return "unknown";
    default:
      return "unknown";
  }
}

function calculateNatoTriage(
  answers: Record<string, unknown>,
): TriageCategory {
  if (
    readAssessmentBoolean(answers, "canWalk") === true ||
    readAssessmentBoolean(answers, "minorSelfCare") === true
  ) {
    return "minimal";
  }

  if (
    readAssessmentBoolean(
      answers,
      "lifeSavingSurgeryHighSurvival",
    ) === true
  ) {
    return "immediate";
  }

  if (
    readAssessmentBoolean(answers, "delayedSurgeryPermitted") === true
  ) {
    return "delayed";
  }

  if (
    readAssessmentBoolean(
      answers,
      "lowSurvivalComplexTreatment",
    ) === true
  ) {
    return "expectant";
  }

  return "unknown";
}

function triageCategoryToFinalAnswer(
  category: TriageCategory,
): string {
  switch (category) {
    case "immediate":
      return "red";
    case "delayed":
      return "yellow";
    case "minimal":
      return "green";
    case "expectant":
      return "black";
    default:
      return "";
  }
}

function getCalculatedFinalTriageAnswer(
  triageSystem: string,
  assessmentAnswers: Record<string, unknown> | undefined,
): string {
  if (!assessmentAnswers) {
    return "";
  }

  const normalizedSystem = normalizeTriageSystem(
    triageSystem,
  );

  /*
   * ESI does not use the normal
   * red/yellow/green/black result.
   */
  if (normalizedSystem === "esi") {
    return calculateEsiFinalTriage(
      assessmentAnswers,
    );
  }

  return triageCategoryToFinalAnswer(
    calculateMobileTriageCategory(
      triageSystem,
      assessmentAnswers,
    ),
  );
}

function formatTriageSystem(value: string | null | undefined): string {
  switch (value) {
    case "urgent_non_urgent":
      return "Urgent/Non-urgent";
    case "stieve":
      return "STIEVE";
    case "nato":
      return "NATO";
    case "start":
      return "START";
    case "mstart":
      return "mSTART";
    case "jumpstart":
      return "JumpSTART";
    case "sieve":
      return "SIEVE";
    case "save":
      return "SAVE";
    case "sort":
      return "SORT";
    case "meta":
      return "META";
    case "swift":
      return "SwiFT";
    case "sieve_sort":
      return "SIEVE/SORT";
    case "smart":
      return "SMART";
    case "rts":
      return "RTS";
    case "care_flight":
      return "Care Flight";
    case "mass":
      return "MASS";
    case "esi":
      return "ESI";
    case "metts":
      return "METTS";
    case "salt":
      return "SALT";
    case "ptt":
      return "PTT";
    case "mitt":
      return "MITT";
    case "homebush":
      return "Homebush";
    case "mptt":
      return "MPTT";
    case "stm":
      return "STM";
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
      return "Tertiary Triage";
    case "reassessment":
      return "Secondary Triage";
    case "on_site":
      return "Primary Triage";
    default:
      return "";
  }
}

function getTriageStageOptionsForRole(
  role: string | null,
  reportingContext: ReportingContext | null,
  responderAssignment: ResponderAssignment | null = null,
): TriageStageOption[] {
  const isAdminOverride =
    role !== null &&
    REFERENCE_MANAGER_ROLES.includes(
      role as (typeof REFERENCE_MANAGER_ROLES)[number],
    );

  if (isAdminOverride) {
    return [...TRIAGE_STAGE_OPTIONS];
  }

  if (responderAssignment === "field_responder") {
    return ["Primary Triage"];
  }

  if (responderAssignment === "sa_responder") {
    return ["Secondary Triage"];
  }

  const roleOptions = role
    ? TRIAGE_STAGE_OPTIONS_BY_ROLE[role]
    : undefined;
  const contextOptions = reportingContext
    ? TRIAGE_STAGE_OPTIONS_BY_REPORTING_CONTEXT[reportingContext]
    : undefined;

  if (roleOptions && contextOptions) {
    const matchedOptions = contextOptions.filter((stage) =>
      roleOptions.includes(stage),
    );

    return matchedOptions.length > 0
      ? [...matchedOptions]
      : [...roleOptions];
  }

  if (roleOptions) {
    return [...roleOptions];
  }

  if (contextOptions) {
    return [...contextOptions];
  }

  return [...TRIAGE_STAGE_OPTIONS];
}

function isFieldResponderCaptureFlow(
  role: string | null,
  responderAssignment: ResponderAssignment | null,
): boolean {
  if (responderAssignment === "field_responder") {
    return true;
  }

  if (responderAssignment === "sa_responder") {
    return false;
  }

  return role === "field_responder";
}

function isSaResponderCaptureFlow(
  role: string | null,
  responderAssignment: ResponderAssignment | null,
): boolean {
  if (responderAssignment === "sa_responder") {
    return true;
  }

  if (responderAssignment === "field_responder") {
    return false;
  }

  return role === "sa_responder";
}

function isHealthcareDocumenterCaptureFlow(role: string | null): boolean {
  return role === "documenter" || role === "medical_personnel";
}

function isResponderAccountRole(role: string | null): boolean {
  return (
    role === "responder" ||
    role === "field_responder" ||
    role === "sa_responder"
  );
}

function getDefaultResponderAssignment(
  role: string | null,
): ResponderAssignment | null {
  if (role === "field_responder") {
    return "field_responder";
  }

  if (role === "sa_responder") {
    return "sa_responder";
  }

  return null;
}

function getTriageSystemOptionsForStage(
  triageStage: string,
): TriageSystemOption[] {
  switch (normalizeTriageStage(triageStage)) {
    case "on_site":
      return [...PRIMARY_TRIAGE_SYSTEM_OPTIONS];
    case "reassessment":
      return [...SECONDARY_TRIAGE_SYSTEM_OPTIONS];
    case "facility_arrival":
      return [...TERTIARY_TRIAGE_SYSTEM_OPTIONS];
    default:
      return [...TRIAGE_SYSTEM_OPTIONS];
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

function normalizeTreatmentStrategy(
  value: string,
): TreatmentStrategy {
  switch (value.trim().toLowerCase()) {
    case "no (scoop and run)":
    case "scoop and run":
      return "scoop_and_run";
    case "no (scooter)":
    case "scooter":
      return "scooter";
    case "yes (stay and play)":
    case "stay and play":
      return "stay_and_play";
    case "partly (play and run)":
    case "play and run":
      return "play_and_run";
    case "unknown":
    default:
      return "unknown";
  }
}

function normalizeTransferredOut(
  value: string,
): boolean | null {
  switch (value.trim().toLowerCase()) {
    case "yes":
      return true;
    case "no":
      return false;
    case "unknown":
    default:
      return null;
  }
}

function normalizeYesNoUnknown(value: string): boolean | null {
  return normalizeTransferredOut(value);
}

function normalizeDeathStage(value: string): DeathStage | null {
  switch (value.trim().toLowerCase()) {
    case "impact":
      return "impact";
    case "pre-hospital":
    case "prehospital":
      return "prehospital";
    case "in-hospital":
    case "in hospital":
      return "in_hospital";
    default:
      return null;
  }
}

function normalizeFinalDisposition(
  value: string,
): FinalDisposition | null {
  const normalized = normalizeEnumValue(value);
  const allowed: FinalDisposition[] = [
    "alive",
    "deceased",
    "transferred",
    "discharged",
    "unknown",
  ];

  return allowed.includes(normalized as FinalDisposition)
    ? (normalized as FinalDisposition)
    : null;
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

function formatTreatmentStrategy(
  value: string | null | undefined,
): string {
  switch (value) {
    case "scoop_and_run":
      return "No (Scoop and Run)";
    case "scooter":
      return "No (SCOOTER)";
    case "stay_and_play":
      return "Yes (Stay and Play)";
    case "play_and_run":
      return "Partly (Play and Run)";
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
  const hour24 = date.getHours();
  const hour12 = hour24 % 12 || 12;
  const hour = String(hour12).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const period = hour24 >= 12 ? "PM" : "AM";

  return `${month}/${day}/${year} ${hour}:${minute} ${period}`;
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
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?:\s*([AaPp][Mm]))?$/.exec(
      trimmed,
    );

  if (!match) {
    return trimmed;
  }

  const [, month, day, year, hour, minute, period] = match;
  let normalizedHour = Number(hour);

  if (period) {
    const upperPeriod = period.toUpperCase();

    if (normalizedHour < 1 || normalizedHour > 12) {
      return trimmed;
    }

    if (upperPeriod === "AM") {
      normalizedHour = normalizedHour === 12 ? 0 : normalizedHour;
    } else {
      normalizedHour = normalizedHour === 12 ? 12 : normalizedHour + 12;
    }
  }

  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    normalizedHour,
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

function formatResponderSafetyStatusForForm(
  value: string | null | undefined,
): string {
  if (value === "yes") {
    return "Yes";
  }

  if (value === "no") {
    return "No";
  }

  return "";
}

function normalizeResponderSafetyStatusForApi(value: string): "yes" | "no" {
  return value.toLowerCase() === "yes" ? "yes" : "no";
}

function getTriageFormSignature(form: FormState): string {
  if (!form.triageSystem.trim()) {
    return "";
  }

  return JSON.stringify({
    system: normalizeTriageSystem(form.triageSystem),
    stage: normalizeTriageStage(form.triageStage),
    time: parseDateTimeInput(form.triageTime) ?? "",
    location: form.triageLocation.trim(),
    notes: form.triageNotes.trim(),
    assessmentAnswers: buildTriageAssessmentAnswers(form) ?? {},
  });
}

function getAppendixQuestionsForSystem(
  system: string,
): AppendixQuestion[] {
  const normalizedSystem = normalizeTriageSystem(system);
  const appendixKey =
    normalizedSystem === "sieve_sort" ? "sieve" : normalizedSystem;

  return APPENDIX_TRIAGE_FIELDS[appendixKey] ?? [];
}

function coerceAppendixAnswer(
  key: string,
  value: string,
): string | number | boolean {
  if (
    key === "pttRespiratoryRate" ||
    key === "pttPulseRate" ||
    key === "painScore" ||
    key === "glasgowComaScale"
  ) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : value;
  }

  if (value === "yes") {
    return true;
  }

  if (value === "no") {
    return false;
  }

  if (key === "palpableRadialPulse") {
    return value;
  }

  if (key === "breathingWithOpenAirway") {
    return value === "present";
  }

  return value;
}

function buildTriageAssessmentAnswers(
  form: FormState,
): Record<string, unknown> | undefined {
  return buildTriageAssessmentAnswersFromRaw(
    form.triageSystem,
    form.triageAssessmentAnswers,
  );
}

function buildTriageAssessmentAnswersFromRaw(
  triageSystem: string,
  rawAnswers: Record<string, string>,
): Record<string, unknown> | undefined {
  const questions = getAppendixQuestionsForSystem(triageSystem);

  if (questions.length === 0) {
    return undefined;
  }

  const answers = questions.reduce<Record<string, unknown>>(
    (currentAnswers, question) => {
      if (question.key === "finalTriage") {
        return currentAnswers;
      }

      const answer = rawAnswers[question.key];

      if (answer) {
        currentAnswers[question.key] = coerceAppendixAnswer(
          question.key,
          answer,
        );
      }

      return currentAnswers;
    },
    {},
  );

  if (Object.keys(answers).length === 0) {
    return undefined;
  }

  const calculatedFinalTriage = getCalculatedFinalTriageAnswer(
    triageSystem,
    answers,
  );

  if (calculatedFinalTriage) {
    answers.finalTriage = calculatedFinalTriage;
  }

  return answers;
}

function syncCalculatedFinalTriageAnswer(
  triageSystem: string,
  rawAnswers: Record<string, string>,
): Record<string, string> {
  const nextAnswers = { ...rawAnswers };
  delete nextAnswers.finalTriage;

  const calculatedAnswers = buildTriageAssessmentAnswersFromRaw(
    triageSystem,
    nextAnswers,
  );
  const calculatedFinalTriage =
    typeof calculatedAnswers?.finalTriage === "string"
      ? calculatedAnswers.finalTriage
      : "";

  if (calculatedFinalTriage) {
    nextAnswers.finalTriage = calculatedFinalTriage;
  }

  return nextAnswers;
}

function getTransportFormSignature(form: FormState): string {
  if (!form.transportRequired.trim() && !form.patientFor.trim()) {
    return "";
  }

  return JSON.stringify({
    required: normalizeTransportRequired(form.transportRequired),
    patientFor: form.patientFor.trim(),
    conditionBeforeRelease: form.conditionBeforeRelease.trim(),
    releaseMedicalContact: form.releaseMedicalContact.trim(),
    conditionBeforeTransfer: form.conditionBeforeTransfer.trim(),
    transferMedicalContact: form.transferMedicalContact.trim(),
    transferPrecaution: form.transferPrecaution.trim(),
    receivingFacilityText: form.receivingFacilityText.trim(),
    usedEmsVehicle: form.usedEmsVehicle.trim(),
    emsVehicleType: form.emsVehicleType.trim(),
    vehicleMakeModelPlate: form.vehicleMakeModelPlate.trim(),
    patientReceivedByPhysician:
      form.patientReceivedByPhysician.trim(),
    patientReceivedByNurse: form.patientReceivedByNurse.trim(),
    releaseLiabilityAccepted:
      form.releaseLiabilityAccepted.trim(),
    mode: normalizeTransportMode(form.transportMode),
    emsUnitType: normalizeEmsUnitType(form.emsUnitType),
    arrivedScene: parseDateTimeInput(form.arrivedSceneTime) ?? "",
    departed: parseDateTimeInput(form.departedSceneTime) ?? "",
    arrived: parseDateTimeInput(form.arrivedFacilityTime) ?? "",
    receivingFacilityId: form.healthcareFacilityId.trim(),
    notes: form.transportNotes.trim(),
  });
}

function getTreatmentFormSignature(form: FormState): string {
  return JSON.stringify({
    strategy: normalizeTreatmentStrategy(form.treatmentStrategy),
    disasterPlanActivationTime:
      parseDateTimeInput(form.disasterPlanActivationTime) ?? "",
    dispositionUponHospitalArrival:
      form.dispositionUponHospitalArrival.trim(),
    resuscitationRoomUsed: normalizeYesNoUnknown(
      form.resuscitationRoomUsed,
    ),
    surgicalInterventionRequired: normalizeYesNoUnknown(
      form.surgicalInterventionRequired,
    ),
    operatingRoomUsed: normalizeYesNoUnknown(form.operatingRoomUsed),
    numberOfOperatingRooms:
      parseOptionalInteger(form.numberOfOperatingRooms) ?? "",
    admittedToUnit: form.admittedToUnit.trim(),
    currentlyAdmittedInIcu: normalizeYesNoUnknown(
      form.currentlyAdmittedInIcu,
    ),
    transferredToWard: normalizeYesNoUnknown(form.transferredToWard),
    inActiveCare: normalizeYesNoUnknown(form.inActiveCare),
    treatmentAreaName: form.treatmentAreaName.trim(),
    stabilizationStarted:
      parseDateTimeInput(form.stabilizationStartedTime) ?? "",
    stabilized: parseDateTimeInput(form.stabilizedTime) ?? "",
    notes: form.treatmentNotes.trim(),
    transferredOut:
      normalizeTransferredOut(form.transferredOutOfHospital),
    soughtEdCare: normalizeYesNoUnknown(form.soughtEdCare),
    admittedAfterEd: normalizeYesNoUnknown(form.admittedAfterEd),
    dischargedAfterEd: normalizeYesNoUnknown(form.dischargedAfterEd),
    edAdmissionTime: parseDateTimeInput(form.edAdmissionTime) ?? "",
    edTransferOutTime:
      parseDateTimeInput(form.edTransferOutTime) ?? "",
    edResuscitationTime:
      parseDateTimeInput(form.edResuscitationTime) ?? "",
    hospitalAdmissionTime:
      parseDateTimeInput(form.hospitalAdmissionTime) ?? "",
    hospitalDischargeTime:
      parseDateTimeInput(form.hospitalDischargeTime) ?? "",
    surgicalInterventionStart:
      parseDateTimeInput(form.surgicalInterventionStartTime) ?? "",
    surgicalInterventionEnd:
      parseDateTimeInput(form.surgicalInterventionEndTime) ?? "",
    operatingRoomTime: parseDateTimeInput(form.operatingRoomTime) ?? "",
    xrayRequired: normalizeYesNoUnknown(form.xrayRequired),
    xrayTime: parseDateTimeInput(form.xrayTime) ?? "",
    ultrasoundRequired: normalizeYesNoUnknown(form.ultrasoundRequired),
    ultrasoundTime: parseDateTimeInput(form.ultrasoundTime) ?? "",
    ctRequired: normalizeYesNoUnknown(form.ctRequired),
    ctTime: parseDateTimeInput(form.ctTime) ?? "",
    icuAdmissionTime: parseDateTimeInput(form.icuAdmissionTime) ?? "",
    icuTransferOutTime:
      parseDateTimeInput(form.icuTransferOutTime) ?? "",
    mechanicalVentilationRequired: normalizeYesNoUnknown(
      form.mechanicalVentilationRequired,
    ),
    ventilationStartTime:
      parseDateTimeInput(form.ventilationStartTime) ?? "",
    ventilationEndTime: parseDateTimeInput(form.ventilationEndTime) ?? "",
    alternativeIcuUsed: normalizeYesNoUnknown(form.alternativeIcuUsed),
    died: normalizeYesNoUnknown(form.died),
    deathStage: normalizeDeathStage(form.deathStage),
    deathTime: parseDateTimeInput(form.deathTime) ?? "",
    reachedHospital: normalizeYesNoUnknown(form.reachedHospital),
    medicalContactBeforeDeath: normalizeYesNoUnknown(
      form.medicalContactBeforeDeath,
    ),
    finalDisposition: normalizeFinalDisposition(form.finalDisposition),
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

function formatCasualtyIdDate(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);

  return `${month}${day}${year}`;
}

function normalizeCasualtyUserCode(userCode: string): string {
  return userCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "") || "USR";
}

function formatCasualtySequence(sequence: number): string {
  return String(Math.max(1, sequence)).padStart(3, "0");
}

function generateCasualtyIdNumber(
  userCode: string,
  sequence: number,
  date = new Date(),
): string {
  return `CAS:${formatCasualtyIdDate(date)}:${normalizeCasualtyUserCode(
    userCode,
  )}${formatCasualtySequence(sequence)}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getCasualtyIdSequence(
  idNumber: string | null | undefined,
  dateCode = formatCasualtyIdDate(),
  userCode = "",
): number {
  const normalizedUserCode = normalizeCasualtyUserCode(userCode);
  const match = new RegExp(
    `^CAS:${escapeRegExp(dateCode)}:${escapeRegExp(
      normalizedUserCode,
    )}(\\d{3,})$`,
    "i",
  ).exec(idNumber ?? "");

  if (!match) {
    return 0;
  }

  const sequence = Number(match[1]);

  return Number.isFinite(sequence) ? sequence : 0;
}

function isGeneratedCasualtyIdNumber(
  idNumber: string | null | undefined,
): boolean {
  return (
    !idNumber ||
    /^CAS:\d{6}:[A-Z0-9]+?\d{3,}$/i.test(idNumber) ||
    /^CAS-\d{8}-/i.test(idNumber) ||
    /^CAS-SYNC-/i.test(idNumber)
  );
}

function buildUnitCode(
  municipality?: string | null,
  barangay?: string | null,
): string {
  const source = [municipality, barangay]
    .filter(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0,
    )
    .join(" ");
  const normalized = source
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 8);

  return normalized || "UNIT";
}

function generateCasualtyUnitIdNumber(
  municipality?: string | null,
  barangay?: string | null,
): string {
  const unitCode = buildUnitCode(municipality, barangay);
  const sequence = String(Math.floor(Math.random() * 999) + 1).padStart(
    3,
    "0",
  );

  return `CAS-${unitCode}-${sequence}`;
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
    responderSafetyStatus: "",
    ppeUseTime: "",
    victimCodeMarked: "",

    witnessPresent: "",
    witnessOther: "",
    witnessResponse: "",
    cprType: "",

    victimCode: "",
    userCode: "",
    patientIdentified:
      record.casualty.identification_status === "unidentified"
        ? "No"
        : record.casualty.first_name || record.casualty.last_name
          ? "Yes"
          : "",
    idNumber: valueOrEmpty(record.casualty.id_number),
    age: valueOrEmpty(record.casualty.estimated_age),
    firstName: valueOrEmpty(record.casualty.first_name),
    middleName: valueOrEmpty(record.casualty.middle_name),
    lastName: valueOrEmpty(record.casualty.last_name),
    sex: valueOrEmpty(record.casualty.sex),
    dateOfBirth: valueOrEmpty(record.casualty.date_of_birth),
    newborn: "",
    pregnant: "",
    religion: "",
    contactNumber: valueOrEmpty(record.casualty.contact_number),

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
    triageSystemOther: "",
    triageAssessmentAnswers: Object.fromEntries(
      Object.entries(latestTriage?.assessment_answers ?? {}).map(
        ([key, value]) => [
          key,
          typeof value === "boolean"
            ? value
              ? "yes"
              : "no"
            : String(value),
        ],
      ),
    ),

    transportRequired: formatTransportRequired(
      latestTransport?.transport_required,
    ),
    patientFor:
      latestTransport?.transport_required === "yes"
        ? "Referral or Transfer to Health Facility"
        : latestTransport?.transport_required === "no"
          ? "Release"
          : "",
    conditionBeforeRelease: "",
    releaseMedicalContact: "",
    conditionBeforeTransfer: "",
    transferMedicalContact: "",
    usedEmsVehicle: "",
    emsVehicleType: "",
    transferPrecaution: "",
    receivingFacilityText: "",
    vehicleMakeModelPlate: "",
    patientReceivedByPhysician: "",
    patientReceivedByNurse: "",
    releaseLiabilityAccepted: "",
    transportMode: formatTransportMode(latestTransport?.transport_mode),
    emsUnitType: formatEmsUnitType(latestTransport?.ems_unit_type),
    arrivedSceneTime: latestTransport?.arrived_scene_at
      ? formatDateTimeForInput(new Date(latestTransport.arrived_scene_at))
      : "",
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

    treatmentStrategy: "",
    fillPatientCareReport: "",
    disasterPlanActivationTime: "",
    dispositionUponHospitalArrival: "",
    resuscitationRoomUsed: "",
    surgicalInterventionRequired: "",
    operatingRoomUsed: "",
    numberOfOperatingRooms: "",
    admittedToUnit: "",
    currentlyAdmittedInIcu: "",
    transferredToWard: "",
    inActiveCare: "",
    treatmentAreaName: "",
    stabilizationStartedTime: "",
    stabilizedTime: "",
    treatmentNotes: "",
    transferredOutOfHospital: "",
    soughtEdCare: "",
    admittedAfterEd: "",
    dischargedAfterEd: "",
    edAdmissionTime: "",
    edTransferOutTime: "",
    edResuscitationTime: "",
    hospitalAdmissionTime: "",
    hospitalDischargeTime: "",
    surgicalInterventionStartTime: "",
    surgicalInterventionEndTime: "",
    operatingRoomTime: "",
    xrayRequired: "",
    xrayTime: "",
    ultrasoundRequired: "",
    ultrasoundTime: "",
    ctRequired: "",
    ctTime: "",
    icuAdmissionTime: "",
    icuTransferOutTime: "",
    mechanicalVentilationRequired: "",
    ventilationStartTime: "",
    ventilationEndTime: "",
    alternativeIcuUsed: "",
    died: record.current_status === "deceased" ? "Yes" : "Unknown",
    deathStage: "",
    deathTime: "",
    reachedHospital: "Unknown",
    medicalContactBeforeDeath: "Unknown",
    finalDisposition:
      record.current_status === "deceased" ? "Deceased" : "Unknown",

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

function appendSectionNote(
  baseValue: string,
  title: string,
  rows: Array<[string, string | undefined]>,
): string {
  const filledRows = rows.filter(
    ([, value]) => typeof value === "string" && value.trim().length > 0,
  );

  if (filledRows.length === 0) {
    return baseValue;
  }

  const section = [
    `[${title}]`,
    ...filledRows.map(([label, value]) => `${label}: ${value?.trim()}`),
  ].join("\n");

  return [baseValue.trim(), section].filter(Boolean).join("\n\n");
}

function buildSaResponderRemarks(form: FormState): string {
  return appendSectionNote(buildResponderSafetyRemarks(form), "SA Responder Details", [
    ["Victim code", form.victimCode],
    ["Patient identified", form.patientIdentified],
    ["Witness present", form.witnessPresent],
    ["Witness other", form.witnessOther],
    ["Witness response", form.witnessResponse],
    ["CPR type", form.cprType],
    ["Newborn", form.newborn],
    ["Pregnant", form.pregnant],
    ["Religion", form.religion],
  ]);
}

function buildResponderSafetyRemarks(form: FormState): string {
  return appendSectionNote(form.remarks, "Responder Safety", [
    ["Are you safe", form.responderSafetyStatus],
    ["Time of PPE Use", form.ppeUseTime],
  ]);
}

function buildFieldResponderTriageNotes(form: FormState): string {
  return appendSectionNote(form.triageNotes, "Field Responder Codes", [
    ["Victim code", form.victimCode],
    ["User code", form.userCode],
  ]);
}

function buildSaResponderTreatmentNotes(form: FormState): string {
  return appendSectionNote(form.treatmentNotes, "Patient Care Report", [
    ["Fill in Patient Care Report", form.fillPatientCareReport],
    ["Stabilized time", form.stabilizedTime],
  ]);
}

function buildSaResponderTransportNotes(form: FormState): string {
  const releaseText =
    form.patientFor === "Release" &&
    form.releaseLiabilityAccepted === "Yes"
      ? RELEASE_OF_LIABILITY_TEXT
      : "";

  return appendSectionNote(form.transportNotes, "SA Transport / Release", [
    ["Patient for", form.patientFor],
    ["Condition before release", form.conditionBeforeRelease],
    ["Medical contact if dead", form.releaseMedicalContact],
    ["Condition before transfer", form.conditionBeforeTransfer],
    ["Medical contact if dead before transfer", form.transferMedicalContact],
    ["Precaution", form.transferPrecaution],
    ["Receiving facility", form.receivingFacilityText],
    ["Used EMS vehicle", form.usedEmsVehicle],
    ["Type of EMS vehicle", form.emsVehicleType],
    ["Vehicle make/model/plate", form.vehicleMakeModelPlate],
    ["Patient received by physician", form.patientReceivedByPhysician],
    ["Patient received by nurse", form.patientReceivedByNurse],
    ["Release of liability accepted", form.releaseLiabilityAccepted],
    ["Release of liability text", releaseText],
  ]);
}

function buildHealthcareDocumenterRemarks(form: FormState): string {
  return appendSectionNote(form.remarks, "Healthcare Facility Documenter", [
    ["Disaster plan activation time", form.disasterPlanActivationTime],
    ["Disposition upon hospital arrival", form.dispositionUponHospitalArrival],
    ["Other triage system", form.triageSystemOther],
  ]);
}

function buildHealthcareDocumenterTriageNotes(form: FormState): string {
  return appendSectionNote(form.triageNotes, "Healthcare Facility Triage", [
    ["Other triage system", form.triageSystemOther],
    ["Admitted to hospital", form.admittedAfterEd],
    ["Admission time", form.hospitalAdmissionTime],
    ["Discharged from hospital", form.dischargedAfterEd],
    ["Discharge time", form.hospitalDischargeTime],
  ]);
}

function buildHealthcareDocumenterTreatmentDetails(
  form: FormState,
): Record<string, unknown> {
  const disasterPlanActivationTime =
    parseDateTimeInput(form.disasterPlanActivationTime) ??
    (form.disasterPlanActivationTime.trim() || null);

  return {
    disasterPlanActivationTime,
    dispositionUponHospitalArrival:
      form.dispositionUponHospitalArrival || null,
    resuscitationRoomUsed: normalizeYesNoUnknown(
      form.resuscitationRoomUsed,
    ),
    surgicalInterventionRequired: normalizeYesNoUnknown(
      form.surgicalInterventionRequired,
    ),
    operatingRoomUsed: normalizeYesNoUnknown(form.operatingRoomUsed),
    numberOfOperatingRooms:
      parseOptionalInteger(form.numberOfOperatingRooms) ?? null,
    admittedToUnit: form.admittedToUnit || null,
    currentlyAdmittedInIcu: normalizeYesNoUnknown(
      form.currentlyAdmittedInIcu,
    ),
    transferredToWard: normalizeYesNoUnknown(form.transferredToWard),
    inActiveCare: normalizeYesNoUnknown(form.inActiveCare),
  };
}

function buildHealthcareDocumenterTreatmentNotes(form: FormState): string {
  return appendSectionNote(form.treatmentNotes, "Management", [
    ["Resuscitation room used", form.resuscitationRoomUsed],
    ["Surgical intervention", form.surgicalInterventionRequired],
    ["Operating room used", form.operatingRoomUsed],
    ["Number of operating rooms", form.numberOfOperatingRooms],
    ["Admitted to unit", form.admittedToUnit],
    ["Currently admitted in ICU", form.currentlyAdmittedInIcu],
    ["Transferred to ward", form.transferredToWard],
    ["In active care", form.inActiveCare],
  ]);
}

type CurrentTimeFieldProps = FieldProps & {
  buttonLabel: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onUseCurrent: () => void;
  disabled?: boolean;
};

function CurrentTimeField({
  buttonLabel,
  icon = "time-outline",
  onUseCurrent,
  disabled = false,
  ...fieldProps
}: CurrentTimeFieldProps) {
  return (
    <View style={styles.currentTimeRow}>
      <View style={styles.currentTimeField}>
        <FormField {...fieldProps} editable={!disabled && fieldProps.editable !== false} />
      </View>

      <Pressable
        onPress={onUseCurrent}
        disabled={disabled}
        style={({ pressed }) => [
          styles.locationButton,
          styles.currentTimeButton,
          disabled && styles.disabledButton,
          pressed && styles.pressed,
        ]}
      >
        <Ionicons
          name={icon}
          size={16}
          color={COLORS.maroon}
        />
        <Text
          style={[
            styles.locationButtonText,
            styles.currentTimeButtonText,
          ]}
        >
          {buttonLabel}
        </Text>
      </Pressable>
    </View>
  );
}

type SelectFieldProps = {
  label: string;
  value: string;
  placeholder: string;
  icon?: keyof typeof Ionicons.glyphMap;
  inputStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  iconColor?: string;
  onPress: () => void;
};

function SelectField({
  label,
  value,
  placeholder,
  icon = "chevron-down-outline",
  inputStyle,
  textStyle,
  iconColor = COLORS.secondaryText,
  onPress,
}: SelectFieldProps) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>

      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.selectInput,
          inputStyle,
          pressed && styles.pressed,
        ]}
      >
        <Text
          style={[
            styles.selectText,
            textStyle,
            !value && styles.placeholderText,
          ]}
        >
          {value || placeholder}
        </Text>

        <Ionicons
          name={icon}
          size={18}
          color={iconColor}
        />
      </Pressable>
    </View>
  );
}

function SectionLabel({ title }: { title: string }) {
  return (
    <View style={styles.sectionLabelRow}>
      <View style={styles.sectionLabelRule} />
      <Text style={styles.sectionLabelText}>{title}</Text>
      <View style={styles.sectionLabelRule} />
    </View>
  );
}

function getTriageColorButtonStyle(value: string) {
  switch (value) {
    case "green":
      return styles.finalTriageGreen;
    case "yellow":
      return styles.finalTriageYellow;
    case "orange":
      return styles.finalTriageOrange;
    case "red":
      return styles.finalTriageRed;
    case "black":
      return styles.finalTriageBlack;
    case "blue":
      return styles.finalTriageBlue;
    case "white":
      return styles.finalTriageWhite;
    default:
      return null;
  }
}

function getTriageColorTextStyle(value: string) {
  return value === "yellow" || value === "orange" || value === "white"
    ? styles.finalTriageYellowText
    : styles.finalTriageLightText;
}

function getTriageAssessmentIconColor(value: string) {
  return value === "yellow" || value === "orange" || value === "white"
    ? "#2B2100"
    : COLORS.white;
}

type ChoiceOption = {
  key?: string;
  label: string;
  selected: boolean;
  onSelect: () => void;
  keepOpen?: boolean;
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
                  if (!option.keepOpen) {
                    onClose();
                  }
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
  const [pickerMode, setPickerMode] = useState<"calendar" | "year">(
    "calendar",
  );
  const [yearPageStart, setYearPageStart] = useState(() => {
    const selectedYear = parseDateInput(value).getFullYear();

    return selectedYear - (selectedYear % 12);
  });

  useEffect(() => {
    if (visible) {
      const selectedDate = parseDateInput(value);

      setVisibleMonth(selectedDate);
      setPickerMode("calendar");
      setYearPageStart(
        selectedDate.getFullYear() - (selectedDate.getFullYear() % 12),
      );
    }
  }, [value, visible]);

  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const selectedDate = parseDateInput(value);
  const yearOptions = Array.from(
    { length: 12 },
    (_, index) => yearPageStart + index,
  );

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
              onPress={() => {
                if (pickerMode === "year") {
                  setYearPageStart((current) => current - 12);
                  return;
                }

                moveMonth(-1);
              }}
              style={styles.dateArrowButton}
            >
              <Ionicons
                name="chevron-back"
                size={20}
                color={COLORS.maroon}
              />
            </Pressable>

            <Pressable
              onPress={() =>
                setPickerMode((current) =>
                  current === "year" ? "calendar" : "year",
                )
              }
              style={({ pressed }) => [
                styles.dateTitleButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.dateTitle}>
                {pickerMode === "year"
                  ? `${yearPageStart} - ${yearPageStart + 11}`
                  : `${MONTH_NAMES[month]} ${year}`}
              </Text>
              <Text style={styles.dateTitleHint}>
                {pickerMode === "year"
                  ? "Select birth year"
                  : "Tap to change year"}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                if (pickerMode === "year") {
                  setYearPageStart((current) => current + 12);
                  return;
                }

                moveMonth(1);
              }}
              style={styles.dateArrowButton}
            >
              <Ionicons
                name="chevron-forward"
                size={20}
                color={COLORS.maroon}
              />
            </Pressable>
          </View>

          {pickerMode === "year" ? (
            <View style={styles.yearGrid}>
              {yearOptions.map((yearOption) => {
                const selected = yearOption === year;

                return (
                  <Pressable
                    key={yearOption}
                    onPress={() => {
                      setVisibleMonth(
                        new Date(yearOption, month, 1),
                      );
                      setPickerMode("calendar");
                    }}
                    style={({ pressed }) => [
                      styles.yearCell,
                      selected && styles.yearCellSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.yearText,
                        selected && styles.yearTextSelected,
                      ]}
                    >
                      {yearOption}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <>
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
            </>
          )}

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
  const { editId, incidentId, incidentName, focusStep } =
    useLocalSearchParams<{
    editId?: string;
    incidentId?: string;
    incidentName?: string;
    focusStep?: string;
  }>();

  const casualtyId = Array.isArray(editId) ? editId[0] : editId;
  const requestedFocusStep = Array.isArray(focusStep)
    ? focusStep[0]
    : focusStep;
  const presetIncidentId = Array.isArray(incidentId)
    ? incidentId[0]
    : incidentId;
  const presetIncidentName = Array.isArray(incidentName)
    ? incidentName[0]
    : incidentName;
  const isEditing = Boolean(casualtyId);
  const [currentStep, setCurrentStep] = useState(0);
  const [form, setForm] = useState<FormState>(() => ({
    ...initialForm,
    idNumber: "",
    incidentId: isEditing ? "" : presetIncidentId ?? "",
    incidentName: isEditing ? "" : presetIncidentName ?? "",
    triageSystem: isEditing ? "" : "START",
    triageStage: isEditing ? "" : "Primary Triage",
    triageTime: "",
    transportRequired: isEditing ? "" : "Unknown",
    transportMode: isEditing ? "" : "Unknown",
    emsUnitType: isEditing ? "" : "Unknown",
    treatmentStrategy: isEditing ? "" : "Unknown",
    transferredOutOfHospital: isEditing ? "" : "Unknown",
    soughtEdCare: isEditing ? "" : "Unknown",
    admittedAfterEd: isEditing ? "" : "Unknown",
    dischargedAfterEd: isEditing ? "" : "Unknown",
    xrayRequired: isEditing ? "" : "Unknown",
    ultrasoundRequired: isEditing ? "" : "Unknown",
    ctRequired: isEditing ? "" : "Unknown",
    mechanicalVentilationRequired: isEditing ? "" : "Unknown",
    alternativeIcuUsed: isEditing ? "" : "Unknown",
    died: isEditing ? "" : "Unknown",
    reachedHospital: isEditing ? "" : "Unknown",
    medicalContactBeforeDeath: isEditing ? "" : "Unknown",
    finalDisposition: isEditing ? "" : "Unknown",
  }));
  const [isLoadingRecord, setIsLoadingRecord] =
    useState(isEditing);
  const [initialTriageSignature, setInitialTriageSignature] =
    useState("");
  const [initialTransportSignature, setInitialTransportSignature] =
    useState("");
  const [initialTreatmentSignature, setInitialTreatmentSignature] =
    useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasAppliedFocusStep, setHasAppliedFocusStep] =
    useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeChoiceSheet, setActiveChoiceSheet] =
    useState<ChoiceSheetName | null>(null);
  const [choiceSearchQuery, setChoiceSearchQuery] = useState("");
  const [
    isTriageAssessmentVisible,
    setIsTriageAssessmentVisible,
  ] = useState(false);
  const [isDatePickerVisible, setIsDatePickerVisible] =
    useState(false);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoadingIncidents, setIsLoadingIncidents] =
    useState(false);
  const [incidentError, setIncidentError] =
    useState<string | null>(null);
  const [fieldResponderRecords, setFieldResponderRecords] = useState<
    CasualtyRecord[]
  >([]);
  const [
    selectedFieldResponderRecordId,
    setSelectedFieldResponderRecordId,
  ] = useState<string | null>(null);
  const [
    isLoadingFieldResponderRecords,
    setIsLoadingFieldResponderRecords,
  ] = useState(false);
  const [
    fieldResponderRecordsError,
    setFieldResponderRecordsError,
  ] = useState<string | null>(null);
  const [newIncidentName, setNewIncidentName] = useState("");
  const [newIncidentType, setNewIncidentType] = useState("");
  const [isCreatingIncident, setIsCreatingIncident] =
    useState(false);
  const [isIncidentQuickCreateExpanded, setIsIncidentQuickCreateExpanded] =
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
  const [
    isEvacuationQuickCreateExpanded,
    setIsEvacuationQuickCreateExpanded,
  ] = useState(false);
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
  const [
    isHealthcareQuickCreateExpanded,
    setIsHealthcareQuickCreateExpanded,
  ] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(
    null,
  );
  const [currentUserFullName, setCurrentUserFullName] =
    useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<
    UserRole | null
  >(null);
  const [currentReportingContext, setCurrentReportingContext] =
    useState<ReportingContext | null>(null);
  const [
    currentAssignedMunicipality,
    setCurrentAssignedMunicipality,
  ] = useState<string | null>(null);
  const [currentAssignedBarangay, setCurrentAssignedBarangay] =
    useState<string | null>(null);
  const [
    currentResponderAssignment,
    setCurrentResponderAssignment,
  ] = useState<ResponderAssignment | null>(null);
  const [
    responderSafetyResponse,
    setResponderSafetyResponse,
  ] = useState<ResponderSafetyResponseRecord | null>(null);
  const [
    isLoadingResponderSafetyResponse,
    setIsLoadingResponderSafetyResponse,
  ] = useState(false);
  const [
    responderSafetyResponseError,
    setResponderSafetyResponseError,
  ] = useState<string | null>(null);
  const [nextCasualtySequence, setNextCasualtySequence] =
    useState(1);
  const [isLoadingUserContext, setIsLoadingUserContext] =
    useState(true);
  const [selectedPhoto, setSelectedPhoto] =
    useState<SelectedPhoto | null>(null);
  const [isCapturingLocation, setIsCapturingLocation] =
    useState(false);
  const [submissionFeedback, setSubmissionFeedback] =
    useState<SubmissionFeedback | null>(null);

  const [isExitConfirmVisible, setIsExitConfirmVisible,] = useState(false);

  const isFieldResponderFlow = isFieldResponderCaptureFlow(
    currentUserRole,
    currentResponderAssignment,
  );
  const isSaResponderFlow = isSaResponderCaptureFlow(
    currentUserRole,
    currentResponderAssignment,
  );
  const isHealthcareDocumenterFlow =
    isHealthcareDocumenterCaptureFlow(currentUserRole);
  const isResponderEditFlow =
    isEditing && (isFieldResponderFlow || isSaResponderFlow);
  const activeSteps: AddCasualtyStep[] = isFieldResponderFlow
    ? isEditing
      ? ["Triage", "Status", "Transport"]
      : [...FIELD_RESPONDER_STEPS]
    : isSaResponderFlow
      ? [...SA_RESPONDER_STEPS]
      : isHealthcareDocumenterFlow
        ? [...HEALTHCARE_DOCUMENTER_STEPS]
        : [...DEFAULT_STEPS];
  const stepName: AddCasualtyStep =
    activeSteps[currentStep] ?? activeSteps[0];
  const isResponderEditLockedStep =
    isResponderEditFlow && stepName !== "Transport";
  const isResponderTransportFocusedEdit =
    isResponderEditFlow &&
    requestedFocusStep?.toLowerCase() === "transport";
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
  const needsResponderFunctionSelection =
    !isEditing &&
    isResponderAccountRole(currentUserRole) &&
    !currentResponderAssignment &&
    !getDefaultResponderAssignment(currentUserRole);
  const responderFunctionLabel = isFieldResponderFlow
    ? "Field Responder"
    : isSaResponderFlow
      ? "Stabilization Area Responder"
      : null;
  const showVictimNumberStickyHeader =
  (
    isSaResponderFlow &&
    stepName === "Triage"
  ) ||
  (
    isFieldResponderFlow &&
    (stepName === "Triage" || stepName === "Status")
  );
  const stickyVictimNumber = form.victimCode.trim() || "No victim code entered";
  const generatedUserCode = generateUserCodeFromName(currentUserFullName);
  const hasSavedResponderSafetyResponse =
    responderSafetyResponse !== null &&
    responderSafetyResponse.incident_id === form.incidentId;

  function getAllowedTriageSystemOptions(
    triageStage: string,
  ): TriageSystemOption[] {
    const normalizedStage = normalizeTriageStage(triageStage);

    if (isFieldResponderFlow && normalizedStage === "on_site") {
      return [...FIELD_RESPONDER_TRIAGE_SYSTEM_OPTIONS];
    }

    if (isSaResponderFlow && normalizedStage === "reassessment") {
      return [...SA_RESPONDER_TRIAGE_SYSTEM_OPTIONS];
    }

    return getTriageSystemOptionsForStage(triageStage);
  }

  const fieldResponderVictimCodeOptions = useMemo(() => {
    return fieldResponderRecords
      .map((record) => {
        const victimCode =
          extractVictimCodeFromTriageNotes(
            record.latest_triage_assessment?.notes,
          ) || extractVictimCodeFromTriageNotes(record.remarks);

        if (!victimCode) {
          return null;
        }

        return {
          record,
          victimCode,
          label: formatLinkedCasualtyLabel(record, victimCode),
        };
      })
      .filter(
        (
          option,
        ): option is {
          record: CasualtyRecord;
          victimCode: string;
          label: string;
        } => option !== null,
      );
  }, [fieldResponderRecords]);

  const personPayload = useMemo<CreateCasualtyPayload["person"]>(
    () => ({
      idNumber: form.idNumber,
      identificationStatus:
        form.patientIdentified === "No"
          ? "unidentified"
          : form.patientIdentified === "Yes" ||
              form.firstName.trim() ||
              form.lastName.trim()
          ? "identified"
          : "unidentified",
      firstName: form.firstName,
      middleName: form.middleName,
      lastName: form.lastName,
      dateOfBirth: normalizeDate(form.dateOfBirth),
      estimatedAge: parseOptionalInteger(form.age),
      sex: form.sex,
      contactNumber: form.contactNumber,
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
      remarks: isSaResponderFlow
        ? buildSaResponderRemarks(form)
        : isHealthcareDocumenterFlow
          ? buildHealthcareDocumenterRemarks(form)
          : isFieldResponderFlow
            ? buildResponderSafetyRemarks(form)
            : form.remarks,
      latitude: parseOptionalNumber(form.latitude),
      longitude: parseOptionalNumber(form.longitude),
    }),
    [
      form,
      isFieldResponderFlow,
      isHealthcareDocumenterFlow,
      isSaResponderFlow,
    ],
  );

  const triageAssessmentPayload = useMemo<
    CreateCasualtyPayload["triageAssessment"]
  >(() => {
    if (!form.triageSystem.trim()) {
      return undefined;
    }

    if (
      isEditing &&
      getTriageFormSignature(form) === initialTriageSignature
    ) {
      return undefined;
    }

    const assessmentAnswers = buildTriageAssessmentAnswers(form);

    return {
      triageSystem: normalizeTriageSystem(form.triageSystem),
      triageCategory: calculateMobileTriageCategory(
        form.triageSystem,
        assessmentAnswers,
      ),
      triageStage: normalizeTriageStage(form.triageStage),
      triagedAt: parseDateTimeInput(form.triageTime),
      location: form.triageLocation || form.currentLocation,
      notes: isHealthcareDocumenterFlow
        ? buildHealthcareDocumenterTriageNotes(form)
        : isFieldResponderFlow
          ? buildFieldResponderTriageNotes(form)
          : form.triageNotes,
      assessmentAnswers,
    };
  }, [
    form,
    initialTriageSignature,
    isEditing,
    isFieldResponderFlow,
    isHealthcareDocumenterFlow,
  ]);

  const transportRecordPayload = useMemo<
    CreateCasualtyPayload["transportRecord"]
  >(() => {
    if (!form.transportRequired.trim() && !form.patientFor.trim()) {
      return undefined;
    }

    if (
      isEditing &&
      getTransportFormSignature(form) === initialTransportSignature
    ) {
      return undefined;
    }

    return {
      transportRequired: isSaResponderFlow
        ? form.patientFor === "Referral or Transfer to Health Facility"
          ? "yes"
          : form.patientFor === "Release"
            ? "no"
            : "unknown"
        : normalizeTransportRequired(form.transportRequired),
      transportMode:
        isSaResponderFlow && form.usedEmsVehicle === "Yes"
          ? "ems"
          : normalizeTransportMode(form.transportMode),
      emsUnitType:
        isSaResponderFlow && form.usedEmsVehicle === "Yes"
          ? normalizeEmsUnitType(form.emsVehicleType)
          : normalizeEmsUnitType(form.emsUnitType),
      arrivedSceneAt: isSaResponderFlow
        ? undefined
        : parseDateTimeInput(form.arrivedSceneTime),
      departedSceneAt: parseDateTimeInput(form.departedSceneTime),
      arrivedFacilityAt: parseDateTimeInput(form.arrivedFacilityTime),
      receivingFacilityId: form.healthcareFacilityId || undefined,
      notes: isSaResponderFlow
        ? buildSaResponderTransportNotes(form)
        : form.transportNotes,
    };
  }, [form, initialTransportSignature, isEditing, isSaResponderFlow]);

  const treatmentRecordPayload = useMemo<
    CreateCasualtyPayload["treatmentRecord"]
  >(() => {
    if (!form.treatmentStrategy.trim() && !isHealthcareDocumenterFlow) {
      return undefined;
    }

    if (
      isEditing &&
      getTreatmentFormSignature(form) === initialTreatmentSignature
    ) {
      return undefined;
    }

    return {
      treatmentStrategy: normalizeTreatmentStrategy(
        form.treatmentStrategy,
      ),
      treatmentAreaName: isSaResponderFlow
        ? undefined
        : form.treatmentAreaName || undefined,
      stabilizationStartedAt: isSaResponderFlow
        ? undefined
        : parseDateTimeInput(form.stabilizationStartedTime),
      stabilizedAt: parseDateTimeInput(form.stabilizedTime),
      treatmentDetails: isHealthcareDocumenterFlow
        ? buildHealthcareDocumenterTreatmentDetails(form)
        : undefined,
      notes: isSaResponderFlow
        ? buildSaResponderTreatmentNotes(form)
        : isHealthcareDocumenterFlow
          ? buildHealthcareDocumenterTreatmentNotes(form)
        : form.treatmentNotes,
    };
  }, [
    form,
    initialTreatmentSignature,
    isEditing,
    isHealthcareDocumenterFlow,
    isSaResponderFlow,
  ]);

  const facilityEncounterPayload = useMemo<
    CreateCasualtyPayload["facilityEncounter"]
  >(() => {
    if (!form.healthcareFacilityId) {
      return undefined;
    }

    if (
      isEditing &&
      getTreatmentFormSignature(form) === initialTreatmentSignature
    ) {
      return undefined;
    }

    const referredOrTransferred = normalizeTransferredOut(
      form.transferredOutOfHospital,
    );
    const soughtEdCare = normalizeYesNoUnknown(form.soughtEdCare);
    const admittedToHospital = normalizeYesNoUnknown(
      form.admittedAfterEd,
    );
    const dischargedHome = normalizeYesNoUnknown(
      form.dischargedAfterEd,
    );
    const resuscitationRoomUsed = normalizeYesNoUnknown(
      form.resuscitationRoomUsed,
    );
    const surgicalInterventionRequired = normalizeYesNoUnknown(
      form.surgicalInterventionRequired,
    );
    const operatingRoomUsed = normalizeYesNoUnknown(
      form.operatingRoomUsed,
    );
    const xrayRequired = normalizeYesNoUnknown(form.xrayRequired);
    const ultrasoundRequired = normalizeYesNoUnknown(
      form.ultrasoundRequired,
    );
    const ctRequired = normalizeYesNoUnknown(form.ctRequired);
    const isIcuAdmission = form.admittedToUnit === "ICU";
    const mechanicalVentilationRequired = normalizeYesNoUnknown(
      form.mechanicalVentilationRequired,
    );
    const transferredToWard = normalizeYesNoUnknown(
      form.transferredToWard,
    );
    const inActiveCare = normalizeYesNoUnknown(form.inActiveCare);
    const hasFacilityCare =
      Boolean(form.healthcareFacilityId) ||
      Boolean(form.arrivedFacilityTime.trim());

    return {
      facilityId: form.healthcareFacilityId,
      arrivedAt: parseDateTimeInput(form.arrivedFacilityTime),
      referredOrTransferred,
      soughtEdCare: soughtEdCare ?? (hasFacilityCare ? true : null),
      admittedToHospital,
      dischargedHome,
      edAdmittedAt: parseDateTimeInput(form.edAdmissionTime),
      edDepartedAt: parseDateTimeInput(form.edTransferOutTime),
      edResuscitationStartedAt:
        resuscitationRoomUsed === true
          ? parseDateTimeInput(form.edResuscitationTime)
          : undefined,
      hospitalAdmittedAt: parseDateTimeInput(
        form.hospitalAdmissionTime,
      ),
      hospitalDischargedAt: parseDateTimeInput(
        form.hospitalDischargeTime,
      ),
      surgicalInterventionStartedAt:
        surgicalInterventionRequired === true
          ? parseDateTimeInput(form.surgicalInterventionStartTime)
          : undefined,
      surgicalInterventionEndedAt:
        surgicalInterventionRequired === true
          ? parseDateTimeInput(form.surgicalInterventionEndTime)
          : undefined,
      operatingRoomStartedAt:
        surgicalInterventionRequired === true &&
        operatingRoomUsed === true
          ? parseDateTimeInput(form.operatingRoomTime)
          : undefined,
      xrayRequired,
      xrayPerformedAt:
        xrayRequired === true
          ? parseDateTimeInput(form.xrayTime)
          : undefined,
      ultrasoundRequired,
      ultrasoundPerformedAt:
        ultrasoundRequired === true
          ? parseDateTimeInput(form.ultrasoundTime)
          : undefined,
      ctRequired,
      ctPerformedAt:
        ctRequired === true
          ? parseDateTimeInput(form.ctTime)
          : undefined,
      icuAdmittedAt: isIcuAdmission
        ? parseDateTimeInput(form.icuAdmissionTime)
        : undefined,
      icuDischargedAt:
        isIcuAdmission && transferredToWard === true
          ? parseDateTimeInput(form.icuTransferOutTime)
          : undefined,
      mechanicalVentilationRequired: isIcuAdmission
        ? mechanicalVentilationRequired
        : null,
      ventilationStartedAt:
        isIcuAdmission && mechanicalVentilationRequired === true
          ? parseDateTimeInput(form.ventilationStartTime)
          : undefined,
      ventilationEndedAt:
        isIcuAdmission && mechanicalVentilationRequired === true
          ? parseDateTimeInput(form.ventilationEndTime)
          : undefined,
      alternativeIcuUsed: isIcuAdmission
        ? normalizeYesNoUnknown(form.alternativeIcuUsed)
        : null,
      disposition:
        form.dispositionUponHospitalArrival === "Transferred"
          ? "transferred"
          : form.dispositionUponHospitalArrival === "Deceased"
            ? "deceased"
            : dischargedHome === true
              ? "discharged_home"
              : admittedToHospital === true
                ? "hospital_admission"
                : inActiveCare === true ||
                    form.dispositionUponHospitalArrival === "Active Care"
                  ? "active_care"
                  : "unknown",
    };
  }, [form, initialTreatmentSignature, isEditing]);

  const casualtyOutcomePayload = useMemo<
    CreateCasualtyPayload["casualtyOutcome"]
  >(() => {
    if (
      isSaResponderFlow &&
      form.patientFor === "Referral or Transfer to Health Facility" &&
      form.conditionBeforeTransfer
    ) {
      const diedBeforeTransfer = form.conditionBeforeTransfer === "Dead";

      return {
        died: diedBeforeTransfer,
        deathStage: diedBeforeTransfer ? "prehospital" : null,
        medicalContactBeforeDeath: diedBeforeTransfer
          ? form.transferMedicalContact
            ? form.transferMedicalContact === "With medical contact"
            : null
          : null,
        finalDisposition: diedBeforeTransfer ? "deceased" : "transferred",
      };
    }

    if (
      isSaResponderFlow &&
      form.patientFor === "Release" &&
      form.conditionBeforeRelease
    ) {
      const diedOnRelease = form.conditionBeforeRelease === "Dead";

      return {
        died: diedOnRelease,
        deathStage: diedOnRelease ? "prehospital" : null,
        medicalContactBeforeDeath: diedOnRelease
          ? form.releaseMedicalContact
            ? form.releaseMedicalContact === "With medical contact"
            : null
          : null,
        finalDisposition: diedOnRelease ? "deceased" : "alive",
      };
    }

    const died = normalizeYesNoUnknown(form.died);

    if (died !== true) {
      return died === null ? undefined : { died };
    }

    const deathStage = normalizeDeathStage(form.deathStage);
    const selectedFinalDisposition = normalizeFinalDisposition(
      form.finalDisposition,
    );
    const finalDisposition =
      selectedFinalDisposition &&
      selectedFinalDisposition !== "unknown"
        ? selectedFinalDisposition
        : "deceased";
    const reachedHospital = normalizeYesNoUnknown(
      form.reachedHospital,
    );
    const medicalContactBeforeDeath = normalizeYesNoUnknown(
      form.medicalContactBeforeDeath,
    );
    const deathAt = parseDateTimeInput(form.deathTime);
    const hasOutcome =
      died === true ||
      deathStage !== null ||
      finalDisposition !== null ||
      reachedHospital !== null ||
      medicalContactBeforeDeath !== null ||
      Boolean(deathAt);

    if (!hasOutcome) {
      return undefined;
    }

    return {
      died,
      deathStage,
      deathAt,
      reachedHospital,
      medicalContactBeforeDeath,
      finalDisposition,
    };
  }, [form, isSaResponderFlow]);

  const updatePayload = useMemo<UpdateCasualtyPayload>(
    () => {
      if (isResponderTransportFocusedEdit) {
        return {
          transportRecord: transportRecordPayload,
        };
      }

      return {
        incidentId: form.incidentId || undefined,
        person: personPayload,
        incidentDetails: incidentDetailsPayload,
        triageAssessment: triageAssessmentPayload,
        transportRecord: transportRecordPayload,
        treatmentRecord: treatmentRecordPayload,
        facilityEncounter: facilityEncounterPayload,
        casualtyOutcome: casualtyOutcomePayload,
      };
    },
    [
      casualtyOutcomePayload,
      facilityEncounterPayload,
      form.incidentId,
      incidentDetailsPayload,
      isResponderTransportFocusedEdit,
      personPayload,
      treatmentRecordPayload,
      triageAssessmentPayload,
      transportRecordPayload,
    ],
  );

  useFocusEffect(
    useCallback(() => {
    let isMounted = true;

    async function loadCurrentUser() {
      setIsLoadingUserContext(true);
      const user = await getCurrentUser();
      const responderAssignment = await getResponderAssignment();

      if (isMounted) {
        setCurrentUserId(user?.id ?? null);
        setCurrentUserFullName(user?.full_name ?? null);
        setCurrentUserRole(user?.role ?? null);
        setCurrentReportingContext(user?.reporting_context ?? null);
        setCurrentAssignedMunicipality(
          user?.assigned_municipality ?? null,
        );
        setCurrentAssignedBarangay(user?.assigned_barangay ?? null);
        setCurrentResponderAssignment(responderAssignment);
        setIsLoadingUserContext(false);
      }
    }

    void loadCurrentUser();

    return () => {
      isMounted = false;
    };
    }, []),
  );

  useEffect(() => {
    setCurrentStep((step) =>
      Math.min(step, Math.max(activeSteps.length - 1, 0)),
    );
  }, [activeSteps.length]);

  useEffect(() => {
    if (
      !isEditing ||
      hasAppliedFocusStep ||
      isLoadingRecord ||
      isLoadingUserContext ||
      !requestedFocusStep
    ) {
      return;
    }

    const focusStepIndex = activeSteps.findIndex(
      (step) =>
        step.toLowerCase() === requestedFocusStep.toLowerCase(),
    );

    if (focusStepIndex >= 0) {
      setCurrentStep(focusStepIndex);
    }

    setHasAppliedFocusStep(true);
  }, [
    activeSteps,
    hasAppliedFocusStep,
    isEditing,
    isLoadingRecord,
    isLoadingUserContext,
    requestedFocusStep,
  ]);

  useEffect(() => {
    if (isEditing || !isHealthcareDocumenterFlow) {
      return;
    }

    setForm((current) => ({
      ...current,
      triageStage: "Tertiary Triage",
      triageSystem:
        TERTIARY_TRIAGE_SYSTEM_OPTIONS.includes(
          current.triageSystem as (typeof TERTIARY_TRIAGE_SYSTEM_OPTIONS)[number],
        )
          ? current.triageSystem
          : "ESI",
      admittedAfterEd:
        current.admittedAfterEd === "Unknown" ? "" : current.admittedAfterEd,
      dischargedAfterEd:
        current.dischargedAfterEd === "Unknown"
          ? ""
          : current.dischargedAfterEd,
      xrayRequired:
        current.xrayRequired === "Unknown" ? "" : current.xrayRequired,
      ultrasoundRequired:
        current.ultrasoundRequired === "Unknown"
          ? ""
          : current.ultrasoundRequired,
      ctRequired: current.ctRequired === "Unknown" ? "" : current.ctRequired,
      mechanicalVentilationRequired:
        current.mechanicalVentilationRequired === "Unknown"
          ? ""
          : current.mechanicalVentilationRequired,
      alternativeIcuUsed:
        current.alternativeIcuUsed === "Unknown"
          ? ""
          : current.alternativeIcuUsed,
    }));
  }, [isEditing, isHealthcareDocumenterFlow]);

  useEffect(() => {
    if (isEditing || isSaResponderFlow) {
      return;
    }

    let isMounted = true;

    async function loadNextCasualtySequence() {
      const dateCode = formatCasualtyIdDate();
      const userCode = normalizeCasualtyUserCode(generatedUserCode);
      const queuedRecords = await getQueuedCasualtySubmissions();
      let highestSequence = queuedRecords.reduce((highest, item) => {
        return Math.max(
          highest,
          getCasualtyIdSequence(
            item.payload.person.idNumber,
            dateCode,
            userCode,
          ),
        );
      }, 0);

      if (currentUserId) {
        try {
          const serverNextSequence = await getNextCasualtyIdSequence(
            userCode,
            dateCode,
          );
          highestSequence = Math.max(
            highestSequence,
            serverNextSequence - 1,
          );
        } catch (error) {
          console.warn("Unable to count synced casualty IDs:", error);
        }
      }

      if (isMounted) {
        setNextCasualtySequence(highestSequence + 1);
      }
    }

    void loadNextCasualtySequence();

    return () => {
      isMounted = false;
    };
  }, [currentUserId, generatedUserCode, isEditing, isSaResponderFlow]);

  useEffect(() => {
    if (isEditing) {
      return;
    }

    setForm((current) => ({
      ...current,
      userCode:
        current.userCode || generatedUserCode,
      idNumber:
        current.idNumber &&
        !isGeneratedCasualtyIdNumber(current.idNumber) &&
        !(isSaResponderFlow && current.idNumber.startsWith("CAS-UNIT-"))
          ? current.idNumber
          : isSaResponderFlow
            ? generateCasualtyUnitIdNumber(
                currentAssignedMunicipality,
                currentAssignedBarangay,
              )
            : generateCasualtyIdNumber(
                generatedUserCode,
                nextCasualtySequence,
              ),
    }));
  }, [
    currentAssignedBarangay,
    currentAssignedMunicipality,
    generatedUserCode,
    isEditing,
    isSaResponderFlow,
    nextCasualtySequence,
  ]);

  useEffect(() => {
    if (isEditing) {
      return;
    }

    const allowedStages =
      getTriageStageOptionsForRole(
        currentUserRole,
        currentReportingContext,
        currentResponderAssignment,
      );

    setForm((current) => {
      const triageStage = allowedStages.includes(
        current.triageStage as TriageStageOption,
      )
        ? current.triageStage
        : allowedStages[0] ?? "Primary Triage";
      const allowedSystems = getAllowedTriageSystemOptions(triageStage);
      const currentSystemIsAllowed = allowedSystems.includes(
        current.triageSystem as TriageSystemOption,
      );

      if (
        triageStage === current.triageStage &&
        currentSystemIsAllowed
      ) {
        return current;
      }

      return {
        ...current,
        triageStage,
        triageSystem: currentSystemIsAllowed
          ? current.triageSystem
          : allowedSystems[0] ?? "",
        triageAssessmentAnswers: currentSystemIsAllowed
          ? current.triageAssessmentAnswers
          : {},
      };
    });
  }, [
    currentReportingContext,
    currentResponderAssignment,
    currentUserRole,
    isEditing,
  ]);

  useEffect(() => {
    if (isEditing || !presetIncidentId || form.incidentName.trim()) {
      return;
    }

    const matchedIncident = incidents.find(
      (incident) => incident.id === presetIncidentId,
    );

    if (!matchedIncident) {
      return;
    }

    setForm((current) => ({
      ...current,
      incidentId: matchedIncident.id,
      incidentName: matchedIncident.incident_name,
    }));
  }, [form.incidentName, incidents, isEditing, presetIncidentId]);

  useEffect(() => {
    if (
      isEditing ||
      !isFieldResponderFlow ||
      form.incidentId ||
      incidents.length !== 1
    ) {
      return;
    }

    const [onlyIncident] = incidents;

    setForm((current) => ({
      ...current,
      incidentId: onlyIncident.id,
      incidentName: onlyIncident.incident_name,
    }));
  }, [form.incidentId, incidents, isEditing, isFieldResponderFlow]);

  useEffect(() => {
    let isMounted = true;

    async function loadIncidentOptions() {
      const user = await getCurrentUser();

      if (!user) {
        if (isMounted) {
          setIncidents([]);
          setIncidentError(null);
          setIsLoadingIncidents(false);
        }
        return;
      }

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

    async function loadResponderSafetyResponse() {
      if (
        isEditing ||
        (!isFieldResponderFlow && !isSaResponderFlow) ||
        !currentUserId ||
        !form.incidentId
      ) {
        if (isMounted) {
          setResponderSafetyResponse(null);
          setResponderSafetyResponseError(null);
          setIsLoadingResponderSafetyResponse(false);
        }
        return;
      }

      try {
        setIsLoadingResponderSafetyResponse(true);
        setResponderSafetyResponseError(null);

        const response = await getResponderSafetyResponse(form.incidentId);

        if (isMounted) {
          setResponderSafetyResponse(response);

          if (response) {
            setForm((current) => ({
              ...current,
              responderSafetyStatus: formatResponderSafetyStatusForForm(
                response.safety_status,
              ),
              ppeUseTime: response.ppe_used_at
                ? formatDateTimeForInput(new Date(response.ppe_used_at))
                : current.ppeUseTime,
            }));
          } else {
            setForm((current) => ({
              ...current,
              responderSafetyStatus: "",
              ppeUseTime: "",
            }));
          }
        }
      } catch (error) {
        console.error("Failed to load responder safety response:", error);

        if (isMounted) {
          setResponderSafetyResponse(null);
          setResponderSafetyResponseError(
            error instanceof Error
              ? error.message
              : "Unable to load responder safety response.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingResponderSafetyResponse(false);
        }
      }
    }

    void loadResponderSafetyResponse();

    return () => {
      isMounted = false;
    };
  }, [
    currentUserId,
    form.incidentId,
    isEditing,
    isFieldResponderFlow,
    isSaResponderFlow,
  ]);

  useEffect(() => {
    let isMounted = true;

    async function loadEvacuationCenterOptions() {
      const user = await getCurrentUser();

      if (!user || !form.incidentId) {
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

    async function loadFieldResponderRecordOptions() {
      if (
        isEditing ||
        !isSaResponderFlow ||
        !currentUserId ||
        !form.incidentId
      ) {
        if (isMounted) {
          setFieldResponderRecords([]);
          setFieldResponderRecordsError(null);
          setIsLoadingFieldResponderRecords(false);
        }
        return;
      }

      try {
        setIsLoadingFieldResponderRecords(true);
        setFieldResponderRecordsError(null);

        const data = await getCasualties({
          incidentId: form.incidentId,
          fieldResponderLinks: true,
        });

        if (isMounted) {
          setFieldResponderRecords(data);
        }
      } catch (error) {
        console.error("Failed to load Field Responder records:", error);

        if (isMounted) {
          setFieldResponderRecordsError(
            error instanceof Error
              ? error.message
              : "Unable to load Field Responder victim codes.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingFieldResponderRecords(false);
        }
      }
    }

    void loadFieldResponderRecordOptions();

    return () => {
      isMounted = false;
    };
  }, [currentUserId, form.incidentId, isEditing, isSaResponderFlow]);

  useEffect(() => {
    let isMounted = true;

    async function loadHealthcareFacilityOptions() {
      const user = await getCurrentUser();

      if (!user) {
        if (isMounted) {
          setHealthcareFacilities([]);
          setHealthcareFacilityError(null);
          setIsLoadingHealthcareFacilities(false);
        }
        return;
      }

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
          setInitialTreatmentSignature(
            getTreatmentFormSignature(mappedForm),
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
    setForm((current) => {
      if (isResponderEditLockedStep) {
        const currentValue = current[key];

        if (
          typeof currentValue === "string" &&
          currentValue.trim().length > 0
        ) {
          return current;
        }
      }

      if (key === "triageSystem") {
        return {
          ...current,
          [key]: value,
          triageSystemOther: value === "Other" ? current.triageSystemOther : "",
          triageAssessmentAnswers: {},
        };
      }

      if (key === "triageStage") {
        const nextStage = String(value);
        const allowedSystems = getAllowedTriageSystemOptions(nextStage);
        const currentSystemIsAllowed = allowedSystems.includes(
          current.triageSystem as TriageSystemOption,
        );

        return {
          ...current,
          [key]: value,
          triageSystem: currentSystemIsAllowed
            ? current.triageSystem
            : allowedSystems[0] ?? "",
          triageSystemOther:
            currentSystemIsAllowed && current.triageSystem === "Other"
              ? current.triageSystemOther
              : "",
          triageAssessmentAnswers: currentSystemIsAllowed
            ? current.triageAssessmentAnswers
            : {},
        };
      }

      if (key === "dateOfBirth") {
        const calculatedAge = calculateAgeFromDateOfBirth(String(value));

        return {
          ...current,
          [key]: value,
          age: calculatedAge || current.age,
        };
      }

      if (key === "patientIdentified" && value === "No") {
        return {
          ...current,
          [key]: value,
          firstName: "",
          middleName: "",
          lastName: "",
          sex: "",
          dateOfBirth: "",
          newborn: "",
          pregnant: "",
          religion: "",
          contactNumber: "",
        };
      }

      if (key === "patientFor") {
        const nextPatientFor = String(value);

        return {
          ...current,
          [key]: value,
          conditionBeforeRelease:
            nextPatientFor === "Release"
              ? current.conditionBeforeRelease
              : "",
          releaseMedicalContact:
            nextPatientFor === "Release" ? current.releaseMedicalContact : "",
          releaseLiabilityAccepted:
            nextPatientFor === "Release"
              ? current.releaseLiabilityAccepted
              : "",
          conditionBeforeTransfer:
            nextPatientFor === "Referral or Transfer to Health Facility"
              ? current.conditionBeforeTransfer
              : "",
          transferMedicalContact:
            nextPatientFor === "Referral or Transfer to Health Facility"
              ? current.transferMedicalContact
              : "",
          transferPrecaution:
            nextPatientFor === "Referral or Transfer to Health Facility"
              ? current.transferPrecaution
              : "",
          receivingFacilityText:
            nextPatientFor === "Referral or Transfer to Health Facility"
              ? current.receivingFacilityText
              : "",
          usedEmsVehicle:
            nextPatientFor === "Referral or Transfer to Health Facility"
              ? current.usedEmsVehicle
              : "",
          emsVehicleType:
            nextPatientFor === "Referral or Transfer to Health Facility"
              ? current.emsVehicleType
              : "",
          vehicleMakeModelPlate:
            nextPatientFor === "Referral or Transfer to Health Facility"
              ? current.vehicleMakeModelPlate
              : "",
          patientReceivedByPhysician:
            nextPatientFor === "Referral or Transfer to Health Facility"
              ? current.patientReceivedByPhysician
              : "",
          patientReceivedByNurse:
            nextPatientFor === "Referral or Transfer to Health Facility"
              ? current.patientReceivedByNurse
              : "",
        };
      }

      if (key === "conditionBeforeRelease" && value !== "Dead") {
        return {
          ...current,
          [key]: value,
          releaseMedicalContact: "",
        };
      }

      if (key === "conditionBeforeTransfer" && value !== "Dead") {
        return {
          ...current,
          [key]: value,
          transferMedicalContact: "",
        };
      }

      if (key === "usedEmsVehicle" && value !== "Yes") {
        return {
          ...current,
          [key]: value,
          emsVehicleType: "",
        };
      }

      if (key === "admittedAfterEd" && value !== "Yes") {
        return {
          ...current,
          [key]: value,
          hospitalAdmissionTime: "",
          admittedToUnit: "",
          icuAdmissionTime: "",
          mechanicalVentilationRequired: "",
          ventilationStartTime: "",
          ventilationEndTime: "",
          alternativeIcuUsed: "",
          currentlyAdmittedInIcu: "",
          transferredToWard: "",
          icuTransferOutTime: "",
        };
      }

      if (key === "dischargedAfterEd" && value !== "Yes") {
        return {
          ...current,
          [key]: value,
          hospitalDischargeTime: "",
        };
      }

      if (key === "resuscitationRoomUsed" && value !== "Yes") {
        return {
          ...current,
          [key]: value,
          edResuscitationTime: "",
        };
      }

      if (key === "surgicalInterventionRequired" && value !== "Yes") {
        return {
          ...current,
          [key]: value,
          surgicalInterventionStartTime: "",
          surgicalInterventionEndTime: "",
          operatingRoomUsed: "",
          operatingRoomTime: "",
        };
      }

      if (key === "operatingRoomUsed" && value !== "Yes") {
        return {
          ...current,
          [key]: value,
          operatingRoomTime: "",
        };
      }

      if (key === "xrayRequired" && value !== "Yes") {
        return {
          ...current,
          [key]: value,
          xrayTime: "",
        };
      }

      if (key === "ultrasoundRequired" && value !== "Yes") {
        return {
          ...current,
          [key]: value,
          ultrasoundTime: "",
        };
      }

      if (key === "ctRequired" && value !== "Yes") {
        return {
          ...current,
          [key]: value,
          ctTime: "",
        };
      }

      if (key === "admittedToUnit" && value !== "ICU") {
        return {
          ...current,
          [key]: value,
          icuAdmissionTime: "",
          mechanicalVentilationRequired: "",
          ventilationStartTime: "",
          ventilationEndTime: "",
          alternativeIcuUsed: "",
          currentlyAdmittedInIcu: "",
          transferredToWard: "",
          icuTransferOutTime: "",
        };
      }

      if (key === "mechanicalVentilationRequired" && value !== "Yes") {
        return {
          ...current,
          [key]: value,
          ventilationStartTime: "",
          ventilationEndTime: "",
        };
      }

      if (key === "transferredToWard" && value !== "Yes") {
        return {
          ...current,
          [key]: value,
          icuTransferOutTime: "",
        };
      }

      return {
        ...current,
        [key]: value,
      };
    });
  }

  function updateTriageAssessmentAnswer(
    key: string,
    value: string,
  ) {
    if (key === "finalTriage") {
      return;
    }

    setForm((current) => {
      const nextAnswers = { ...current.triageAssessmentAnswers };

      if (value) {
        nextAnswers[key] = value;
      } else {
        delete nextAnswers[key];
      }

      return {
        ...current,
        triageAssessmentAnswers: syncCalculatedFinalTriageAnswer(
          current.triageSystem,
          nextAnswers,
        ),
      };
    });
  }

  function getDefaultTriageStageForCurrentFlow(): TriageStageOption {
    if (isHealthcareDocumenterFlow) {
      return "Tertiary Triage";
    }

    if (isSaResponderFlow) {
      return "Secondary Triage";
    }

    return "Primary Triage";
  }

  function getDefaultTriageSystemForCurrentFlow(): string {
    const defaultStage = getDefaultTriageStageForCurrentFlow();
    return getAllowedTriageSystemOptions(defaultStage)[0] ?? "START";
  }

  function buildFreshCreateForm(
    current: FormState,
    sequence = nextCasualtySequence,
  ): FormState {
    return {
      ...initialForm,
      responderSafetyStatus:
        hasSavedResponderSafetyResponse
          ? formatResponderSafetyStatusForForm(
              responderSafetyResponse.safety_status,
            )
          : "",
      ppeUseTime:
        hasSavedResponderSafetyResponse && responderSafetyResponse.ppe_used_at
          ? formatDateTimeForInput(
              new Date(responderSafetyResponse.ppe_used_at),
            )
          : "",
      idNumber: isSaResponderFlow
        ? generateCasualtyUnitIdNumber(
            currentAssignedMunicipality,
            currentAssignedBarangay,
          )
        : generateCasualtyIdNumber(generatedUserCode, sequence),
      userCode: generatedUserCode,
      incidentId: (current.incidentId || presetIncidentId) ?? "",
      incidentName: (current.incidentName || presetIncidentName) ?? "",
      triageStage: getDefaultTriageStageForCurrentFlow(),
      triageSystem: getDefaultTriageSystemForCurrentFlow(),
      triageTime: "",
      transportRequired: "Unknown",
      transportMode: "Unknown",
      emsUnitType: "Unknown",
      treatmentStrategy: "Unknown",
      transferredOutOfHospital: "Unknown",
      soughtEdCare: "Unknown",
      admittedAfterEd: isHealthcareDocumenterFlow ? "" : "Unknown",
      dischargedAfterEd: isHealthcareDocumenterFlow ? "" : "Unknown",
      xrayRequired: isHealthcareDocumenterFlow ? "" : "Unknown",
      ultrasoundRequired: isHealthcareDocumenterFlow ? "" : "Unknown",
      ctRequired: isHealthcareDocumenterFlow ? "" : "Unknown",
      mechanicalVentilationRequired: isHealthcareDocumenterFlow
        ? ""
        : "Unknown",
      alternativeIcuUsed: isHealthcareDocumenterFlow ? "" : "Unknown",
      died: "Unknown",
      reachedHospital: "Unknown",
      medicalContactBeforeDeath: "Unknown",
      finalDisposition: "Unknown",
    };
  }

  function resetForNextCasualty() {
    const nextSequence = nextCasualtySequence + 1;
    setNextCasualtySequence(nextSequence);
    setCurrentStep(0);
    setSelectedPhoto(null);
    setSelectedFieldResponderRecordId(null);
    setActiveChoiceSheet(null);
    setChoiceSearchQuery("");
    setIsTriageAssessmentVisible(false);
    setIsDatePickerVisible(false);
    setForm((current) => buildFreshCreateForm(current, nextSequence));
  }

  function closeSubmissionFeedback() {
    const feedback = submissionFeedback;

    setSubmissionFeedback(null);

    if (feedback?.onCloseRoute) {
      router.replace(feedback.onCloseRoute as never);
      return;
    }

    if (feedback?.resetOnClose !== false) {
      resetForNextCasualty();
    }
  }

  function openChoiceSheet(sheetName: ChoiceSheetName) {
    setChoiceSearchQuery("");
    setActiveChoiceSheet(sheetName);
  }

  function applyFieldResponderRecord(
    record: CasualtyRecord,
    victimCode: string,
  ) {
    const mappedForm = mapRecordToForm(record);
    const secondarySystems =
      getAllowedTriageSystemOptions("Secondary Triage");
    const currentTriageSystemIsSecondary = secondarySystems.includes(
      form.triageSystem as TriageSystemOption,
    );

    setSelectedFieldResponderRecordId(record.id);
    setForm((current) => ({
      ...current,
      victimCode,
      patientIdentified:
        current.patientIdentified || mappedForm.patientIdentified,
      idNumber: mappedForm.idNumber,
      age: mappedForm.age,
      firstName: mappedForm.firstName,
      middleName: mappedForm.middleName,
      lastName: mappedForm.lastName,
      sex: mappedForm.sex,
      dateOfBirth: mappedForm.dateOfBirth,
      contactNumber: mappedForm.contactNumber,
      houseStreet: mappedForm.houseStreet,
      barangay: mappedForm.barangay,
      municipality: mappedForm.municipality,
      province: mappedForm.province,
      region: mappedForm.region,
      incidentId: mappedForm.incidentId,
      incidentName: mappedForm.incidentName,
      currentLocation:
        current.currentLocation || mappedForm.currentLocation,
      evacuationCenterId: mappedForm.evacuationCenterId,
      evacuationCenter: mappedForm.evacuationCenter,
      latitude: current.latitude || mappedForm.latitude,
      longitude: current.longitude || mappedForm.longitude,
      casualtyStatus:
        current.casualtyStatus || mappedForm.casualtyStatus,
      severity: current.severity || mappedForm.severity,
      healthcareFacilityId:
        current.healthcareFacilityId || mappedForm.healthcareFacilityId,
      healthcareFacility:
        current.healthcareFacility || mappedForm.healthcareFacility,
      hospitalName: current.hospitalName || mappedForm.hospitalName,
      visibleInjury:
        current.visibleInjury || mappedForm.visibleInjury,
      medicalCondition:
        current.medicalCondition || mappedForm.medicalCondition,
      assistanceNeeded:
        current.assistanceNeeded || mappedForm.assistanceNeeded,
      assistanceProvided:
        current.assistanceProvided || mappedForm.assistanceProvided,
      remarks: mappedForm.remarks,
      triageStage: "Secondary Triage",
      triageSystem: currentTriageSystemIsSecondary
        ? current.triageSystem
        : secondarySystems[0] ?? "",
      triageAssessmentAnswers: currentTriageSystemIsSecondary
        ? current.triageAssessmentAnswers
      : {},
    }));
  }

  function resolveSelectedFieldResponderRecordId(): string | null {
    if (
      selectedFieldResponderRecordId &&
      fieldResponderRecords.some(
        (record) => record.id === selectedFieldResponderRecordId,
      )
    ) {
      return selectedFieldResponderRecordId;
    }

    const selectedVictimCode = form.victimCode.trim().toLowerCase();

    if (!selectedVictimCode) {
      return null;
    }

    const matchingOptions = fieldResponderVictimCodeOptions.filter(
      (option) =>
        option.victimCode.trim().toLowerCase() === selectedVictimCode,
    );

    return matchingOptions.length === 1
      ? matchingOptions[0].record.id
      : null;
  }

  function openTriageAssessment() {
    if (!form.triageSystem.trim()) {
      Alert.alert(
        "Triage system required",
        "Select a triage system before opening the assessment.",
      );
      return;
    }

    if (getAppendixQuestionsForSystem(form.triageSystem).length === 0) {
      Alert.alert(
        "Assessment unavailable",
        "No assessment questions are configured for this triage system yet.",
      );
      return;
    }

    setIsTriageAssessmentVisible(true);
  }

  function isActiveChoiceSheetSearchable(): boolean {
    return (
      activeChoiceSheet === "incident" ||
      activeChoiceSheet === "fieldResponderVictimCode" ||
      activeChoiceSheet === "evacuationCenter" ||
      activeChoiceSheet === "healthcareFacility" ||
      activeChoiceSheet === "disasterType"
    );
  }

  function validateOptionalDateTime(
    value: string,
    title: string,
    label: string,
  ): boolean {
    if (!value.trim()) {
      return true;
    }

    if (getValidDateTimeInput(value)) {
      return true;
    }

    Alert.alert(title, `Enter ${label} using mm/dd/yyyy hh:mm.`);
    return false;
  }

  function hasTriageAssessmentAnswer(): boolean {
    return getAppendixQuestionsForSystem(form.triageSystem).some(
      (question) =>
        question.key !== "finalTriage" &&
        Boolean(form.triageAssessmentAnswers[question.key]),
    );
  }

  function validateMinimumTriageAssessmentAnswer(): boolean {
    const questions = getAppendixQuestionsForSystem(form.triageSystem);

    if (questions.length === 0) {
      return true;
    }

    if (hasTriageAssessmentAnswer()) {
      return true;
    }

    Alert.alert(
      "Assessment answer required",
      "Answer at least one triage assessment item before continuing.",
    );
    return false;
  }

  function validatePartialCurrentStep(): boolean {
    switch (stepName) {
      case "Safety":
        if (
          (isFieldResponderFlow || isSaResponderFlow) &&
          !form.incidentId &&
          currentUserId
        ) {
          Alert.alert(
            "Incident required",
            "Select the active incident before submitting this casualty.",
          );
          openChoiceSheet("incident");
          return false;
        }

        if (hasSavedResponderSafetyResponse) {
          return true;
        }

        if (isLoadingResponderSafetyResponse) {
          Alert.alert(
            "Responder safety loading",
            "Please wait while the app checks if you already answered responder safety for this incident.",
          );
          return false;
        }

        if (!form.responderSafetyStatus.trim()) {
          Alert.alert(
            "Safety response required",
            "Answer Are you safe? before continuing.",
          );
          return false;
        }

        if (!form.ppeUseTime.trim()) {
          Alert.alert(
            "PPE time required",
            "Enter the Time of PPE Use before continuing.",
          );
          return false;
        }

        return validateOptionalDateTime(
          form.ppeUseTime,
          "Invalid PPE time",
          "Time of PPE Use",
        );

      case "Intro":
      case "General Information":
      case "Incident":
        if (!form.incidentId && currentUserId) {
          Alert.alert(
            "Incident required",
            "Select the incident before submitting this casualty.",
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

        return (
          validateOptionalDateTime(
            form.arrivedFacilityTime,
            "Invalid arrival time",
            "arrival time",
          ) &&
          validateOptionalDateTime(
            form.disasterPlanActivationTime,
            "Invalid activation time",
            "disaster plan activation time",
          )
        );

      case "Info":
      case "Patient Information":
      case "Personal":
        if (isSaResponderFlow && !form.victimCode.trim()) {
          Alert.alert(
            "Victim code required",
            "Enter the victim code before continuing.",
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

      case "Triage":
        return (
          validateMinimumTriageAssessmentAnswer() &&
          validateOptionalDateTime(
            form.triageTime,
            "Invalid triage time",
            "triage time",
          ) &&
          validateOptionalDateTime(
            form.hospitalAdmissionTime,
            "Invalid admission time",
            "admission time",
          ) &&
          validateOptionalDateTime(
            form.hospitalDischargeTime,
            "Invalid discharge time",
            "discharge time",
          )
        );

      case "Management": {
        if (
          form.numberOfOperatingRooms.trim() &&
          parseOptionalInteger(form.numberOfOperatingRooms) === undefined
        ) {
          Alert.alert(
            "Invalid operating room count",
            "Enter the number of operating rooms as a whole number.",
          );
          return false;
        }

        const dateFields: Array<[string, string, string]> = [
          [
            form.edResuscitationTime,
            "Invalid resuscitation time",
            "resuscitation room use time",
          ],
          [
            form.surgicalInterventionStartTime,
            "Invalid surgery time",
            "surgical intervention time",
          ],
          [
            form.operatingRoomTime,
            "Invalid operating room time",
            "operating room use time",
          ],
          [form.xrayTime, "Invalid X-ray time", "X-ray use time"],
          [
            form.ultrasoundTime,
            "Invalid ultrasound time",
            "ultrasound use time",
          ],
          [form.ctTime, "Invalid CT scan time", "CT scan use time"],
          [
            form.icuAdmissionTime,
            "Invalid ICU admission time",
            "ICU admission time",
          ],
          [
            form.ventilationStartTime,
            "Invalid ventilation time",
            "mechanical ventilation use time",
          ],
          [
            form.ventilationEndTime,
            "Invalid ventilation time",
            "mechanical ventilation discontinuation time",
          ],
        ];

        return dateFields.every(([value, title, label]) =>
          validateOptionalDateTime(value, title, label),
        );
      }

      case "Disposition":
        return (
          validateOptionalDateTime(
            form.icuTransferOutTime,
            "Invalid ward transfer time",
            "transfer time",
          ) &&
          validateOptionalDateTime(
            form.hospitalDischargeTime,
            "Invalid discharge time",
            "discharge time",
          )
        );

      case "Transport": {
        if (
          isSaResponderFlow &&
          form.conditionBeforeTransfer === "Dead" &&
          !form.transferMedicalContact.trim()
        ) {
          Alert.alert(
            "Medical contact required",
            "Select whether the dead patient had medical contact.",
          );
          return false;
        }

        if (
          isSaResponderFlow &&
          form.conditionBeforeRelease === "Dead" &&
          !form.releaseMedicalContact.trim()
        ) {
          Alert.alert(
            "Medical contact required",
            "Select whether the dead patient had medical contact.",
          );
          return false;
        }

        if (
          isSaResponderFlow &&
          form.usedEmsVehicle === "Yes" &&
          !form.emsVehicleType.trim()
        ) {
          Alert.alert(
            "EMS vehicle type required",
            "Select BLS or ALS for the EMS vehicle.",
          );
          return false;
        }

        const arrivedSceneAt = form.arrivedSceneTime.trim()
          ? getValidDateTimeInput(form.arrivedSceneTime)
          : null;
        const departedSceneAt = form.departedSceneTime.trim()
          ? getValidDateTimeInput(form.departedSceneTime)
          : null;
        const arrivedFacilityAt = form.arrivedFacilityTime.trim()
          ? getValidDateTimeInput(form.arrivedFacilityTime)
          : null;

        if (form.arrivedSceneTime.trim() && !arrivedSceneAt) {
          Alert.alert(
            "Invalid EMS scene arrival time",
            "Enter EMS scene arrival time using mm/dd/yyyy hh:mm.",
          );
          return false;
        }

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
          arrivedSceneAt &&
          departedSceneAt &&
          departedSceneAt < arrivedSceneAt
        ) {
          Alert.alert(
            "Invalid transport times",
            "Departed scene time cannot be before EMS scene arrival time.",
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

      case "Treatment":
      case "Status":
        return (
          validateOptionalDateTime(
            form.stabilizationStartedTime,
            "Invalid care start time",
            "stabilization start time",
          ) &&
          validateOptionalDateTime(
            form.stabilizedTime,
            "Invalid stabilized time",
            "stabilized time",
          )
        );

      case "Hospital Care":
        return validateHospitalCareDatesOnly();

      case "Address":
      case "Remarks":
      default:
        return true;
    }
  }

  function validateHospitalCareDatesOnly(): boolean {
    const dateFields: Array<[string, string, string]> = [
      [
        form.stabilizationStartedTime,
        "Invalid care start time",
        "stabilization start time",
      ],
      [form.stabilizedTime, "Invalid stabilized time", "stabilized time"],
      [
        form.arrivedFacilityTime,
        "Invalid arrival time",
        "facility arrival time",
      ],
      [
        form.edResuscitationTime,
        "Invalid resuscitation time",
        "ED resuscitation room time",
      ],
      [
        form.edAdmissionTime,
        "Invalid ED admission time",
        "ED admission time",
      ],
      [
        form.edTransferOutTime,
        "Invalid ED transfer out time",
        "ED transfer out time",
      ],
      [
        form.hospitalAdmissionTime,
        "Invalid hospital admission time",
        "hospital admission time",
      ],
      [
        form.hospitalDischargeTime,
        "Invalid hospital discharge time",
        "hospital discharge time",
      ],
      [
        form.surgicalInterventionStartTime,
        "Invalid surgery start time",
        "surgery start time",
      ],
      [
        form.surgicalInterventionEndTime,
        "Invalid surgery end time",
        "surgery end time",
      ],
      [
        form.operatingRoomTime,
        "Invalid operating room time",
        "operating room time",
      ],
      [form.xrayTime, "Invalid X-ray time", "X-ray time"],
      [
        form.ultrasoundTime,
        "Invalid ultrasound time",
        "ultrasound time",
      ],
      [form.ctTime, "Invalid CT scan time", "CT scan time"],
      [
        form.icuAdmissionTime,
        "Invalid ICU admission time",
        "ICU admission time",
      ],
      [
        form.icuTransferOutTime,
        "Invalid ICU transfer out time",
        "ICU transfer out time",
      ],
      [
        form.ventilationStartTime,
        "Invalid ventilation start time",
        "ventilation start time",
      ],
      [
        form.ventilationEndTime,
        "Invalid ventilation end time",
        "ventilation end time",
      ],
      [form.deathTime, "Invalid death time", "death time"],
    ];

    return dateFields.every(([value, title, label]) =>
      validateOptionalDateTime(value, title, label),
    );
  }

  function validateCurrentStep(): boolean {
    if (
      isFieldResponderFlow ||
      isSaResponderFlow ||
      isHealthcareDocumenterFlow
    ) {
      return validatePartialCurrentStep();
    }

    switch (stepName) {
      case "Safety":
        if (!form.responderSafetyStatus.trim()) {
          Alert.alert(
            "Safety response required",
            "Answer Are you safe? before continuing.",
          );
          return false;
        }

        if (!form.ppeUseTime.trim()) {
          Alert.alert(
            "PPE time required",
            "Enter the Time of PPE Use before continuing.",
          );
          return false;
        }

        if (!getValidDateTimeInput(form.ppeUseTime)) {
          Alert.alert(
            "Invalid PPE time",
            "Enter Time of PPE Use using mm/dd/yyyy hh:mm.",
          );
          return false;
        }

        return true;

      case "Intro":
        if (!form.incidentId && currentUserId) {
          Alert.alert(
            "Incident required",
            "Select the incident before encoding victim details.",
          );
          return false;
        }

        if (!form.incidentName.trim()) {
          Alert.alert(
            "Incident name required",
            "Select or enter the incident name before continuing.",
          );
          return false;
        }

        if (!form.witnessPresent.trim()) {
          Alert.alert(
            "Witness required",
            "Select who was present as witness.",
          );
          return false;
        }

        if (
          parseMultiSelectValue(form.witnessPresent).includes("Others") &&
          !form.witnessOther.trim()
        ) {
          Alert.alert(
            "Witness details required",
            "Enter the other witness type.",
          );
          return false;
        }

        if (!form.witnessResponse.trim()) {
          Alert.alert(
            "Witness response required",
            "Select the witness response.",
          );
          return false;
        }

        if (form.witnessResponse === "CPR" && !form.cprType.trim()) {
          Alert.alert(
            "CPR type required",
            "Select compression only or compression with ventilation.",
          );
          return false;
        }

        return true;

      case "Info":
        if (isSaResponderFlow && !form.victimCode.trim()) {
          Alert.alert(
            "Victim code required",
            "Enter the victim code before continuing.",
          );
          return false;
        }

        if (isSaResponderFlow && form.patientIdentified === "No") {
          return true;
        }

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

        return true;

      case "General Information":
        if (!form.incidentId && currentUserId) {
          Alert.alert(
            "Incident required",
            "Select the active incident before documenting hospital care.",
          );
          return false;
        }

        if (!form.healthcareFacilityId) {
          Alert.alert(
            "Receiving facility required",
            "Select the receiving facility name.",
          );
          return false;
        }

        if (!form.arrivedFacilityTime.trim()) {
          Alert.alert(
            "Arrival time required",
            "Enter the patient's hospital arrival time.",
          );
          return false;
        }

        if (!getValidDateTimeInput(form.arrivedFacilityTime)) {
          Alert.alert(
            "Invalid arrival time",
            "Enter arrival time using mm/dd/yyyy hh:mm.",
          );
          return false;
        }

        if (
          form.disasterPlanActivationTime.trim() &&
          !getValidDateTimeInput(form.disasterPlanActivationTime)
        ) {
          Alert.alert(
            "Invalid activation time",
            "Enter disaster plan activation time using mm/dd/yyyy hh:mm.",
          );
          return false;
        }

        if (!form.dispositionUponHospitalArrival.trim()) {
          Alert.alert(
            "Arrival disposition required",
            "Select the disposition upon hospital arrival.",
          );
          return false;
        }

        return true;

      case "Patient Information":
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
            "Select the patient sex before continuing.",
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
        if (!form.incidentId && (currentUserId || isEditing)) {
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

        if (
          form.triageSystem === "Other" &&
          !form.triageSystemOther.trim()
        ) {
          Alert.alert(
            "Other triage system required",
            "Specify the triage system used.",
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

        if (!isFieldResponderFlow && !form.triageTime.trim()) {
          Alert.alert(
            "Triage time required",
            "Enter the time this triage assessment was performed.",
          );
          return false;
        }

        if (
          !isFieldResponderFlow &&
          !getValidDateTimeInput(form.triageTime)
        ) {
          Alert.alert(
            "Invalid triage time",
            "Enter triage time using mm/dd/yyyy hh:mm.",
          );
          return false;
        }

        if (isHealthcareDocumenterFlow) {
          if (!form.admittedAfterEd.trim()) {
            Alert.alert(
              "Admission status required",
              "Select whether the patient was admitted to hospital.",
            );
            return false;
          }

          if (
            form.admittedAfterEd === "Yes" &&
            !form.hospitalAdmissionTime.trim()
          ) {
            Alert.alert(
              "Admission time required",
              "Enter the hospital admission time.",
            );
            return false;
          }

          if (
            form.hospitalAdmissionTime.trim() &&
            !getValidDateTimeInput(form.hospitalAdmissionTime)
          ) {
            Alert.alert(
              "Invalid admission time",
              "Enter admission time using mm/dd/yyyy hh:mm.",
            );
            return false;
          }

          if (
            form.admittedAfterEd === "No" &&
            !form.dischargedAfterEd.trim()
          ) {
            Alert.alert(
              "Discharge status required",
              "Select whether the patient was discharged from hospital.",
            );
            return false;
          }

          if (
            form.admittedAfterEd === "No" &&
            form.dischargedAfterEd === "Yes" &&
            !form.hospitalDischargeTime.trim()
          ) {
            Alert.alert(
              "Discharge time required",
              "Enter the hospital discharge time.",
            );
            return false;
          }

          if (
            form.hospitalDischargeTime.trim() &&
            !getValidDateTimeInput(form.hospitalDischargeTime)
          ) {
            Alert.alert(
              "Invalid discharge time",
              "Enter discharge time using mm/dd/yyyy hh:mm.",
            );
            return false;
          }
        }

        if (!validateMinimumTriageAssessmentAnswer()) {
          return false;
        }

        return true;

      case "Management": {
        const dateFields: Array<[string, string]> = [
          [form.edResuscitationTime, "resuscitation room use time"],
          [
            form.surgicalInterventionStartTime,
            "surgical intervention time",
          ],
          [form.operatingRoomTime, "operating room use time"],
          [form.xrayTime, "X-ray use time"],
          [form.ultrasoundTime, "ultrasound use time"],
          [form.ctTime, "CT scan use time"],
          [form.icuAdmissionTime, "ICU admission time"],
          [form.ventilationStartTime, "mechanical ventilation use time"],
          [
            form.ventilationEndTime,
            "mechanical ventilation discontinuation time",
          ],
        ];

        if (!form.resuscitationRoomUsed.trim()) {
          Alert.alert(
            "Resuscitation room use required",
            "Select whether a resuscitation room was used.",
          );
          return false;
        }

        if (
          form.resuscitationRoomUsed === "Yes" &&
          !form.edResuscitationTime.trim()
        ) {
          Alert.alert(
            "Resuscitation time required",
            "Enter the time of resuscitation room use.",
          );
          return false;
        }

        if (!form.surgicalInterventionRequired.trim()) {
          Alert.alert(
            "Surgical intervention required",
            "Select whether surgical intervention was performed.",
          );
          return false;
        }

        if (form.surgicalInterventionRequired === "Yes") {
          if (!form.surgicalInterventionStartTime.trim()) {
            Alert.alert(
              "Surgery time required",
              "Enter the time of surgical intervention.",
            );
            return false;
          }

          if (!form.operatingRoomUsed.trim()) {
            Alert.alert(
              "Operating room status required",
              "Select whether an operating room was used.",
            );
            return false;
          }

          if (
            form.operatingRoomUsed === "Yes" &&
            !form.operatingRoomTime.trim()
          ) {
            Alert.alert(
              "Operating room time required",
              "Enter the time of operating room use.",
            );
            return false;
          }
        }

        if (
          form.numberOfOperatingRooms.trim() &&
          parseOptionalInteger(form.numberOfOperatingRooms) === undefined
        ) {
          Alert.alert(
            "Invalid operating room count",
            "Enter the number of operating rooms as a whole number.",
          );
          return false;
        }

        for (const sheetName of [
          "xrayRequired",
          "ultrasoundRequired",
          "ctRequired",
        ] as const) {
          if (!form[sheetName].trim()) {
            Alert.alert(
              "Imaging status required",
              "Select Yes or No for all imaging use questions.",
            );
            return false;
          }
        }

        if (form.xrayRequired === "Yes" && !form.xrayTime.trim()) {
          Alert.alert(
            "X-ray time required",
            "Enter the time of X-ray use.",
          );
          return false;
        }

        if (
          form.ultrasoundRequired === "Yes" &&
          !form.ultrasoundTime.trim()
        ) {
          Alert.alert(
            "Ultrasound time required",
            "Enter the time of ultrasound use.",
          );
          return false;
        }

        if (form.ctRequired === "Yes" && !form.ctTime.trim()) {
          Alert.alert(
            "CT scan time required",
            "Enter the time of CT scan use.",
          );
          return false;
        }

        if (!form.admittedToUnit.trim()) {
          Alert.alert(
            "Admitted unit required",
            "Select where the patient was admitted.",
          );
          return false;
        }

        if (form.admittedToUnit === "ICU") {
          if (!form.icuAdmissionTime.trim()) {
            Alert.alert(
              "ICU admission time required",
              "Enter the ICU admission time.",
            );
            return false;
          }

          if (!form.mechanicalVentilationRequired.trim()) {
            Alert.alert(
              "Ventilation status required",
              "Select whether mechanical ventilation was used.",
            );
            return false;
          }

          if (
            form.mechanicalVentilationRequired === "Yes" &&
            !form.ventilationStartTime.trim()
          ) {
            Alert.alert(
              "Ventilation time required",
              "Enter the time of mechanical ventilation use.",
            );
            return false;
          }

          if (!form.alternativeIcuUsed.trim()) {
            Alert.alert(
              "Alternative ICU status required",
              "Select whether alternative ICU admission was used.",
            );
            return false;
          }
        }

        for (const [value, label] of dateFields) {
          if (value.trim() && !getValidDateTimeInput(value)) {
            Alert.alert(
              "Invalid time",
              `Enter ${label} using mm/dd/yyyy hh:mm.`,
            );
            return false;
          }
        }

        return true;
      }

      case "Disposition":
        if (form.admittedToUnit === "ICU") {
          if (!form.currentlyAdmittedInIcu.trim()) {
            Alert.alert(
              "ICU status required",
              "Select whether the patient is currently admitted in ICU.",
            );
            return false;
          }

          if (!form.transferredToWard.trim()) {
            Alert.alert(
              "Ward transfer status required",
              "Select whether the patient was transferred to ward.",
            );
            return false;
          }

          if (
            form.transferredToWard === "Yes" &&
            !form.icuTransferOutTime.trim()
          ) {
            Alert.alert(
              "Ward transfer time required",
              "Enter the time of transfer to ward.",
            );
            return false;
          }

          if (
            form.icuTransferOutTime.trim() &&
            !getValidDateTimeInput(form.icuTransferOutTime)
          ) {
            Alert.alert(
              "Invalid ward transfer time",
              "Enter transfer time using mm/dd/yyyy hh:mm.",
            );
            return false;
          }
        } else {
          if (!form.inActiveCare.trim()) {
            Alert.alert(
              "Active care status required",
              "Select whether the patient is in active care.",
            );
            return false;
          }
        }

        if (!form.dischargedAfterEd.trim()) {
          Alert.alert(
            "Discharge status required",
            "Select whether the patient was discharged from hospital.",
          );
          return false;
        }

        if (
          form.dischargedAfterEd === "Yes" &&
          !form.hospitalDischargeTime.trim()
        ) {
          Alert.alert(
            "Discharge time required",
            "Enter the time of hospital discharge.",
          );
          return false;
        }

        if (
          form.hospitalDischargeTime.trim() &&
          !getValidDateTimeInput(form.hospitalDischargeTime)
        ) {
          Alert.alert(
            "Invalid discharge time",
            "Enter discharge time using mm/dd/yyyy hh:mm.",
          );
          return false;
        }

        return true;

      case "Transport": {
        if (isSaResponderFlow) {
          if (!form.patientFor.trim()) {
            Alert.alert(
              "Patient disposition required",
              "Select Pending Departure, Release, or Referral/Transfer to Health Facility.",
            );
            return false;
          }

          if (
            form.patientFor === "Referral or Transfer to Health Facility"
          ) {
            if (!form.conditionBeforeTransfer.trim()) {
              Alert.alert(
                "Condition required",
                "Select whether the patient was alive or dead before transfer.",
              );
              return false;
            }

            if (
              form.conditionBeforeTransfer === "Dead" &&
              !form.transferMedicalContact.trim()
            ) {
              Alert.alert(
                "Medical contact required",
                "Select whether the dead patient had medical contact.",
              );
              return false;
            }

            if (!form.transferPrecaution.trim()) {
              Alert.alert(
                "Precaution required",
                "Select the transfer precaution.",
              );
              return false;
            }

            if (!form.receivingFacilityText.trim()) {
              Alert.alert(
                "Receiving facility required",
                "Enter the receiving facility.",
              );
              return false;
            }

            if (
              form.usedEmsVehicle === "Yes" &&
              !form.emsVehicleType.trim()
            ) {
              Alert.alert(
                "EMS vehicle type required",
                "Select BLS or ALS for the EMS vehicle.",
              );
              return false;
            }
          }

          if (form.patientFor === "Release") {
            if (!form.conditionBeforeRelease.trim()) {
              Alert.alert(
                "Condition before release required",
                "Select whether the patient was alive or dead before release.",
              );
              return false;
            }

            if (
              form.conditionBeforeRelease === "Dead" &&
              !form.releaseMedicalContact.trim()
            ) {
              Alert.alert(
                "Medical contact required",
                "Select whether the dead patient had medical contact.",
              );
              return false;
            }

            if (form.releaseLiabilityAccepted !== "Yes") {
            Alert.alert(
              "Release of liability required",
              "Confirm release of liability before submitting a released patient.",
            );
            return false;
            }
          }

          if (
            !validateOptionalDateTime(
              form.departedSceneTime,
              "Invalid departure time",
              "departed scene time",
            )
          ) {
            return false;
          }

          if (
            form.patientFor === "Referral or Transfer to Health Facility" &&
            !validateOptionalDateTime(
              form.arrivedFacilityTime,
              "Invalid facility arrival time",
              "arrived facility time",
            )
          ) {
            return false;
          }

          return true;
        }

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

        if (
          transportMode === "ems" &&
          !form.arrivedSceneTime.trim()
        ) {
          Alert.alert(
            "EMS scene arrival required",
            "Enter the time the EMS vehicle arrived on scene.",
          );
          return false;
        }

        const arrivedSceneAt = form.arrivedSceneTime.trim()
          ? getValidDateTimeInput(form.arrivedSceneTime)
          : null;
        const departedSceneAt = form.departedSceneTime.trim()
          ? getValidDateTimeInput(form.departedSceneTime)
          : null;
        const arrivedFacilityAt = form.arrivedFacilityTime.trim()
          ? getValidDateTimeInput(form.arrivedFacilityTime)
          : null;

        if (form.arrivedSceneTime.trim() && !arrivedSceneAt) {
          Alert.alert(
            "Invalid EMS scene arrival time",
            "Enter EMS scene arrival time using mm/dd/yyyy hh:mm.",
          );
          return false;
        }

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
          arrivedSceneAt &&
          departedSceneAt &&
          departedSceneAt < arrivedSceneAt
        ) {
          Alert.alert(
            "Invalid transport times",
            "Departed scene time cannot be before EMS scene arrival time.",
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

      case "Treatment": {
        if (!form.treatmentStrategy.trim()) {
          Alert.alert(
            "Treatment required",
            "Select the treatment type.",
          );
          return false;
        }

        const statusStabilizedAt = form.stabilizedTime.trim()
          ? getValidDateTimeInput(form.stabilizedTime)
          : null;

        if (form.stabilizedTime.trim() && !statusStabilizedAt) {
          Alert.alert(
            "Invalid stabilized time",
            "Enter stabilized time using mm/dd/yyyy hh:mm.",
          );
          return false;
        }

        if (!form.fillPatientCareReport.trim()) {
          Alert.alert(
            "PCR selection required",
            "Select whether to fill in the Patient Care Report.",
          );
          return false;
        }

        return true;
      }

      case "Status": {
        if (!form.casualtyStatus.trim()) {
          Alert.alert(
            "Casualty status required",
            "Select the casualty status before continuing.",
          );
          return false;
        }

        if (!form.treatmentStrategy.trim()) {
          Alert.alert(
            "On-site care required",
            "Select the on-site stabilization or treatment type.",
          );
          return false;
        }

        const statusTreatmentStrategy = normalizeTreatmentStrategy(
          form.treatmentStrategy,
        );
        const statusStabilizationStartedAt =
          form.stabilizationStartedTime.trim()
            ? getValidDateTimeInput(form.stabilizationStartedTime)
            : null;
        const statusStabilizedAt = form.stabilizedTime.trim()
          ? getValidDateTimeInput(form.stabilizedTime)
          : null;

        if (
          form.stabilizationStartedTime.trim() &&
          !statusStabilizationStartedAt
        ) {
          Alert.alert(
            "Invalid care start time",
            "Enter stabilization start time using mm/dd/yyyy hh:mm.",
          );
          return false;
        }

        if (form.stabilizedTime.trim() && !statusStabilizedAt) {
          Alert.alert(
            "Invalid stabilized time",
            "Enter stabilized time using mm/dd/yyyy hh:mm.",
          );
          return false;
        }

        if (
          ["stay_and_play", "play_and_run"].includes(
            statusTreatmentStrategy,
          ) &&
          !statusStabilizedAt
        ) {
          Alert.alert(
            "Stabilized time required",
            "Enter the time this casualty was stabilized in the treatment area.",
          );
          return false;
        }

        if (
          statusStabilizationStartedAt &&
          statusStabilizedAt &&
          statusStabilizedAt < statusStabilizationStartedAt
        ) {
          Alert.alert(
            "Invalid care times",
            "Stabilized time cannot be before the stabilization start time.",
          );
          return false;
        }

        return true;
      }

      case "Hospital Care": {
        if (
          form.healthcareFacilityId &&
          !form.transferredOutOfHospital.trim()
        ) {
          Alert.alert(
            "Transfer status required",
            "Select whether this casualty was transferred out of the hospital, or choose Unknown.",
          );
          return false;
        }

        const hasEdDetails =
          normalizeYesNoUnknown(form.soughtEdCare) === true ||
          normalizeYesNoUnknown(form.admittedAfterEd) === true ||
          normalizeYesNoUnknown(form.dischargedAfterEd) === true ||
          form.edAdmissionTime.trim() ||
          form.edTransferOutTime.trim() ||
          form.edResuscitationTime.trim();
        const hasHospitalResourceDetails =
          form.hospitalAdmissionTime.trim() ||
          form.hospitalDischargeTime.trim() ||
          form.surgicalInterventionStartTime.trim() ||
          form.surgicalInterventionEndTime.trim() ||
          form.operatingRoomTime.trim() ||
          normalizeYesNoUnknown(form.xrayRequired) === true ||
          form.xrayTime.trim() ||
          normalizeYesNoUnknown(form.ultrasoundRequired) === true ||
          form.ultrasoundTime.trim() ||
          normalizeYesNoUnknown(form.ctRequired) === true ||
          form.ctTime.trim() ||
          form.icuAdmissionTime.trim() ||
          form.icuTransferOutTime.trim() ||
          normalizeYesNoUnknown(form.mechanicalVentilationRequired) ===
            true ||
          form.ventilationStartTime.trim() ||
          form.ventilationEndTime.trim() ||
          normalizeYesNoUnknown(form.alternativeIcuUsed) === true;

        if (
          (hasEdDetails || hasHospitalResourceDetails) &&
          !form.healthcareFacilityId
        ) {
          Alert.alert(
            "Healthcare facility required",
            "Select the receiving healthcare facility before recording ED or hospital resource use.",
          );
          return false;
        }

        const treatmentStrategy = normalizeTreatmentStrategy(
          form.treatmentStrategy,
        );
        const stabilizationStartedAt =
          form.stabilizationStartedTime.trim()
            ? getValidDateTimeInput(form.stabilizationStartedTime)
            : null;
        const stabilizedAt = form.stabilizedTime.trim()
          ? getValidDateTimeInput(form.stabilizedTime)
          : null;
        const arrivedFacilityAt = form.arrivedFacilityTime.trim()
          ? getValidDateTimeInput(form.arrivedFacilityTime)
          : null;
        const edResuscitationAt = form.edResuscitationTime.trim()
          ? getValidDateTimeInput(form.edResuscitationTime)
          : null;
        const edAdmissionAt = form.edAdmissionTime.trim()
          ? getValidDateTimeInput(form.edAdmissionTime)
          : null;
        const edTransferOutAt = form.edTransferOutTime.trim()
          ? getValidDateTimeInput(form.edTransferOutTime)
          : null;
        const hospitalAdmissionAt = form.hospitalAdmissionTime.trim()
          ? getValidDateTimeInput(form.hospitalAdmissionTime)
          : null;
        const hospitalDischargeAt = form.hospitalDischargeTime.trim()
          ? getValidDateTimeInput(form.hospitalDischargeTime)
          : null;
        const surgicalStartAt =
          form.surgicalInterventionStartTime.trim()
            ? getValidDateTimeInput(
                form.surgicalInterventionStartTime,
              )
            : null;
        const surgicalEndAt = form.surgicalInterventionEndTime.trim()
          ? getValidDateTimeInput(form.surgicalInterventionEndTime)
          : null;
        const operatingRoomAt = form.operatingRoomTime.trim()
          ? getValidDateTimeInput(form.operatingRoomTime)
          : null;
        const xrayAt = form.xrayTime.trim()
          ? getValidDateTimeInput(form.xrayTime)
          : null;
        const ultrasoundAt = form.ultrasoundTime.trim()
          ? getValidDateTimeInput(form.ultrasoundTime)
          : null;
        const ctAt = form.ctTime.trim()
          ? getValidDateTimeInput(form.ctTime)
          : null;
        const icuAdmissionAt = form.icuAdmissionTime.trim()
          ? getValidDateTimeInput(form.icuAdmissionTime)
          : null;
        const icuTransferOutAt = form.icuTransferOutTime.trim()
          ? getValidDateTimeInput(form.icuTransferOutTime)
          : null;
        const ventilationStartAt = form.ventilationStartTime.trim()
          ? getValidDateTimeInput(form.ventilationStartTime)
          : null;
        const ventilationEndAt = form.ventilationEndTime.trim()
          ? getValidDateTimeInput(form.ventilationEndTime)
          : null;
        const isDiedYes = normalizeYesNoUnknown(form.died) === true;
        const deathAt = form.deathTime.trim()
          ? getValidDateTimeInput(form.deathTime)
          : null;

        if (
          normalizeStatus(form.casualtyStatus) === "deceased" &&
          !isDiedYes
        ) {
          Alert.alert(
            "Death status required",
            "Set Died to Yes when the casualty status is Deceased.",
          );
          return false;
        }

        if (
          form.stabilizationStartedTime.trim() &&
          !stabilizationStartedAt
        ) {
          Alert.alert(
            "Invalid care start time",
            "Enter stabilization start time using mm/dd/yyyy hh:mm.",
          );
          return false;
        }

        if (form.stabilizedTime.trim() && !stabilizedAt) {
          Alert.alert(
            "Invalid stabilized time",
            "Enter stabilized time using mm/dd/yyyy hh:mm.",
          );
          return false;
        }

        if (
          form.edResuscitationTime.trim() &&
          !edResuscitationAt
        ) {
          Alert.alert(
            "Invalid resuscitation time",
            "Enter ED resuscitation room time using mm/dd/yyyy hh:mm.",
          );
          return false;
        }

        const hospitalDateChecks: Array<[string, Date | null, string]> = [
          [
            form.edAdmissionTime,
            edAdmissionAt,
            "Invalid ED admission time",
          ],
          [
            form.edTransferOutTime,
            edTransferOutAt,
            "Invalid ED transfer out time",
          ],
          [
            form.hospitalAdmissionTime,
            hospitalAdmissionAt,
            "Invalid hospital admission time",
          ],
          [
            form.hospitalDischargeTime,
            hospitalDischargeAt,
            "Invalid hospital discharge time",
          ],
          [
            form.surgicalInterventionStartTime,
            surgicalStartAt,
            "Invalid surgery start time",
          ],
          [
            form.surgicalInterventionEndTime,
            surgicalEndAt,
            "Invalid surgery end time",
          ],
          [
            form.operatingRoomTime,
            operatingRoomAt,
            "Invalid operating room time",
          ],
          [form.xrayTime, xrayAt, "Invalid X-ray time"],
          [form.ultrasoundTime, ultrasoundAt, "Invalid ultrasound time"],
          [form.ctTime, ctAt, "Invalid CT scan time"],
          [
            form.icuAdmissionTime,
            icuAdmissionAt,
            "Invalid ICU admission time",
          ],
          [
            form.icuTransferOutTime,
            icuTransferOutAt,
            "Invalid ICU transfer out time",
          ],
          [
            form.ventilationStartTime,
            ventilationStartAt,
            "Invalid ventilation start time",
          ],
          [
            form.ventilationEndTime,
            ventilationEndAt,
            "Invalid ventilation end time",
          ],
        ];

        for (const [rawValue, parsedValue, title] of hospitalDateChecks) {
          if (rawValue.trim() && !parsedValue) {
            Alert.alert(
              title,
              "Enter the time using mm/dd/yyyy hh:mm.",
            );
            return false;
          }
        }

        if (
          ["stay_and_play", "play_and_run"].includes(
            treatmentStrategy,
          ) &&
          !stabilizedAt
        ) {
          Alert.alert(
            "Stabilized time required",
            "Enter the time this casualty was stabilized in the treatment area.",
          );
          return false;
        }

        if (
          stabilizationStartedAt &&
          stabilizedAt &&
          stabilizedAt < stabilizationStartedAt
        ) {
          Alert.alert(
            "Invalid care times",
            "Stabilized time cannot be before the stabilization start time.",
          );
          return false;
        }

        if (
          arrivedFacilityAt &&
          edAdmissionAt &&
          edAdmissionAt < arrivedFacilityAt
        ) {
          Alert.alert(
            "Invalid ED time",
            "ED admission time cannot be before facility arrival time.",
          );
          return false;
        }

        if (
          arrivedFacilityAt &&
          edTransferOutAt &&
          edTransferOutAt < arrivedFacilityAt
        ) {
          Alert.alert(
            "Invalid ED time",
            "ED transfer out time cannot be before facility arrival time.",
          );
          return false;
        }

        if (
          edAdmissionAt &&
          edTransferOutAt &&
          edTransferOutAt < edAdmissionAt
        ) {
          Alert.alert(
            "Invalid ED stay",
            "ED transfer out time cannot be before ED admission time.",
          );
          return false;
        }

        if (
          arrivedFacilityAt &&
          edResuscitationAt &&
          edResuscitationAt < arrivedFacilityAt
        ) {
          Alert.alert(
            "Invalid ED time",
            "ED resuscitation room time cannot be before facility arrival time.",
          );
          return false;
        }

        if (surgicalStartAt && surgicalEndAt && surgicalEndAt < surgicalStartAt) {
          Alert.alert(
            "Invalid surgery times",
            "Surgery end time cannot be before surgery start time.",
          );
          return false;
        }

        if (
          hospitalAdmissionAt &&
          hospitalDischargeAt &&
          hospitalDischargeAt < hospitalAdmissionAt
        ) {
          Alert.alert(
            "Invalid hospital stay",
            "Hospital discharge time cannot be before hospital admission time.",
          );
          return false;
        }

        if (
          icuAdmissionAt &&
          icuTransferOutAt &&
          icuTransferOutAt < icuAdmissionAt
        ) {
          Alert.alert(
            "Invalid ICU stay",
            "ICU transfer out time cannot be before ICU admission time.",
          );
          return false;
        }

        if (
          ventilationStartAt &&
          ventilationEndAt &&
          ventilationEndAt < ventilationStartAt
        ) {
          Alert.alert(
            "Invalid ventilation days",
            "Ventilation end time cannot be before ventilation start time.",
          );
          return false;
        }

        if (
          isDiedYes &&
          !normalizeDeathStage(form.deathStage)
        ) {
          Alert.alert(
            "Death stage required",
            "Select Impact, Pre-hospital, or In-hospital for deceased casualties.",
          );
          return false;
        }

        if (isDiedYes && form.deathTime.trim() && !deathAt) {
          Alert.alert(
            "Invalid death time",
            "Enter death time using mm/dd/yyyy hh:mm.",
          );
          return false;
        }

        const facilityTimeChecks: Array<[Date | null, string]> = [
          [
            hospitalAdmissionAt,
            "Hospital admission time cannot be before facility arrival time.",
          ],
          [
            surgicalStartAt,
            "Surgery start time cannot be before facility arrival time.",
          ],
          [
            operatingRoomAt,
            "Operating room time cannot be before facility arrival time.",
          ],
          [xrayAt, "X-ray time cannot be before facility arrival time."],
          [
            ultrasoundAt,
            "Ultrasound time cannot be before facility arrival time.",
          ],
          [ctAt, "CT scan time cannot be before facility arrival time."],
          [
            icuAdmissionAt,
            "ICU admission time cannot be before facility arrival time.",
          ],
        ];

        for (const [eventTime, message] of facilityTimeChecks) {
          if (arrivedFacilityAt && eventTime && eventTime < arrivedFacilityAt) {
            Alert.alert("Invalid hospital time", message);
            return false;
          }
        }

        return true;
      }

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
        "Enter both the incident name and hazard type.",
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
      case "witnessPresent":
        return "Witness Present";
      case "witnessResponse":
        return "Witness Response";
      case "cprType":
        return "CPR Type";
      case "newborn":
        return "Newborn?";
      case "pregnant":
        return "Pregnant?";
      case "fillPatientCareReport":
        return "Patient Care Report";
      case "fieldResponderVictimCode":
        return "Select Victim Code";
      case "patientIdentified":
        return "Patient Identified?";
      case "patientFor":
        return "Patient For";
      case "conditionBeforeRelease":
        return "Condition Before Release";
      case "releaseMedicalContact":
        return "Medical Contact";
      case "conditionBeforeTransfer":
        return "Condition Before Transfer";
      case "transferMedicalContact":
        return "Medical Contact";
      case "usedEmsVehicle":
        return "Used EMS Vehicle?";
      case "emsVehicleType":
        return "Type of EMS Vehicle";
      case "transferPrecaution":
        return "Transfer Precaution";
      case "releaseLiabilityAccepted":
        return "Release of Liability";
      case "dispositionUponHospitalArrival":
        return "Disposition Upon Hospital Arrival";
      case "resuscitationRoomUsed":
        return "Resuscitation Room Used";
      case "surgicalInterventionRequired":
        return "Surgical Intervention";
      case "operatingRoomUsed":
        return "Operating Room Used";
      case "admittedToUnit":
        return "Admitted to Unit";
      case "currentlyAdmittedInIcu":
        return "Currently Admitted in ICU";
      case "transferredToWard":
        return "Transferred to Ward";
      case "inActiveCare":
        return "In Active Care";
      case "incident":
        return "Select Incident Name";
      case "evacuationCenter":
        return "Select Evacuation Center";
      case "healthcareFacility":
        return "Select Healthcare Facility";
      case "disasterType":
        return "Select Type of Hazard";
      case "facilityLevel":
        return "Select Facility Level";
      case "triageSystem":
        return "Select Triage System";
      case "triageStage":
        return "Select Triage Stage";
      case "transportRequired":
        return "Select Transport Status";
      case "transportMode":
        return "Select Transport Mode";
      case "emsUnitType":
        return "Select EMS Unit Type";
      case "treatmentStrategy":
        return "Select On-site Care";
      case "transferredOutOfHospital":
        return "Transferred Out of Hospital";
      case "soughtEdCare":
        return "ED / Similar Facility Care";
      case "admittedAfterEd":
        return "ED Admission";
      case "dischargedAfterEd":
        return "ED Discharge";
      case "xrayRequired":
        return "Plain X-ray Required";
      case "ultrasoundRequired":
        return "Ultrasound Required";
      case "ctRequired":
        return "CT Scan Required";
      case "mechanicalVentilationRequired":
        return "Mechanical Ventilation";
      case "alternativeIcuUsed":
        return "Alternative ICU Use";
      case "died":
        return "Death Status";
      case "deathStage":
        return "Death Stage";
      case "reachedHospital":
        return "Reached Hospital";
      case "medicalContactBeforeDeath":
        return "Medical Contact Before Death";
      case "finalDisposition":
        return "Final Disposition";
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

      case "witnessPresent":
        return WITNESS_PRESENT_OPTIONS.map((option) => {
          const selectedWitnesses = parseMultiSelectValue(
            form.witnessPresent,
          );
          const selected = selectedWitnesses.includes(option);

          return {
            label: option,
            selected,
            keepOpen: true,
            onSelect: () => {
              const nextWitnesses = selected
                ? selectedWitnesses.filter(
                    (witness) => witness !== option,
                  )
                : [...selectedWitnesses, option];

              updateField(
                "witnessPresent",
                formatMultiSelectValue(nextWitnesses),
              );
            },
          };
        });

      case "witnessResponse":
        return WITNESS_RESPONSE_OPTIONS.map((option) => ({
          label: option,
          selected: form.witnessResponse === option,
          onSelect: () => updateField("witnessResponse", option),
        }));

      case "cprType":
        return CPR_TYPE_OPTIONS.map((option) => ({
          label: option,
          selected: form.cprType === option,
          onSelect: () => updateField("cprType", option),
        }));

      case "newborn":
        return YES_NO_OPTIONS_TEXT.map((option) => ({
          label: option,
          selected: form.newborn === option,
          onSelect: () => updateField("newborn", option),
        }));

      case "pregnant":
        return YES_NO_OPTIONS_TEXT.map((option) => ({
          label: option,
          selected: form.pregnant === option,
          onSelect: () => updateField("pregnant", option),
        }));

      case "fillPatientCareReport":
        return YES_NO_OPTIONS_TEXT.map((option) => ({
          label: option,
          selected: form.fillPatientCareReport === option,
          onSelect: () => updateField("fillPatientCareReport", option),
        }));

      case "fieldResponderVictimCode":
        return fieldResponderVictimCodeOptions.map((option) => ({
          key: option.record.id,
          label: option.label,
          selected: selectedFieldResponderRecordId === option.record.id,
          onSelect: () =>
            applyFieldResponderRecord(option.record, option.victimCode),
        }));

      case "patientIdentified":
        return YES_NO_OPTIONS_TEXT.map((option) => ({
          label: option,
          selected: form.patientIdentified === option,
          onSelect: () => updateField("patientIdentified", option),
        }));

      case "patientFor":
        return PATIENT_FOR_OPTIONS.map((option) => ({
          label: option,
          selected: form.patientFor === option,
          onSelect: () => updateField("patientFor", option),
        }));

      case "conditionBeforeRelease":
        return RELEASE_CONDITION_OPTIONS.map((option) => ({
          label: option,
          selected: form.conditionBeforeRelease === option,
          onSelect: () => updateField("conditionBeforeRelease", option),
        }));

      case "releaseMedicalContact":
        return RELEASE_MEDICAL_CONTACT_OPTIONS.map((option) => ({
          label: option,
          selected: form.releaseMedicalContact === option,
          onSelect: () => updateField("releaseMedicalContact", option),
        }));

      case "conditionBeforeTransfer":
        return RELEASE_CONDITION_OPTIONS.map((option) => ({
          label: option,
          selected: form.conditionBeforeTransfer === option,
          onSelect: () => updateField("conditionBeforeTransfer", option),
        }));

      case "transferMedicalContact":
        return RELEASE_MEDICAL_CONTACT_OPTIONS.map((option) => ({
          label: option,
          selected: form.transferMedicalContact === option,
          onSelect: () => updateField("transferMedicalContact", option),
        }));

      case "usedEmsVehicle":
        return YES_NO_OPTIONS_TEXT.map((option) => ({
          label: option,
          selected: form.usedEmsVehicle === option,
          onSelect: () => updateField("usedEmsVehicle", option),
        }));

      case "emsVehicleType":
        return EMS_VEHICLE_TYPE_OPTIONS.map((option) => ({
          label: option,
          selected: form.emsVehicleType === option,
          onSelect: () => updateField("emsVehicleType", option),
        }));

      case "transferPrecaution":
        return PRECAUTION_OPTIONS.map((option) => ({
          label: option,
          selected: form.transferPrecaution === option,
          onSelect: () => updateField("transferPrecaution", option),
        }));

      case "releaseLiabilityAccepted":
        return YES_NO_OPTIONS_TEXT.map((option) => ({
          label: option,
          selected: form.releaseLiabilityAccepted === option,
          onSelect: () =>
            updateField("releaseLiabilityAccepted", option),
        }));

      case "dispositionUponHospitalArrival":
        return HOSPITAL_ARRIVAL_DISPOSITION_OPTIONS.map((option) => ({
          label: option,
          selected: form.dispositionUponHospitalArrival === option,
          onSelect: () =>
            updateField("dispositionUponHospitalArrival", option),
        }));

      case "resuscitationRoomUsed":
        return YES_NO_OPTIONS_TEXT.map((option) => ({
          label: option,
          selected: form.resuscitationRoomUsed === option,
          onSelect: () => updateField("resuscitationRoomUsed", option),
        }));

      case "surgicalInterventionRequired":
        return YES_NO_OPTIONS_TEXT.map((option) => ({
          label: option,
          selected: form.surgicalInterventionRequired === option,
          onSelect: () =>
            updateField("surgicalInterventionRequired", option),
        }));

      case "operatingRoomUsed":
        return YES_NO_OPTIONS_TEXT.map((option) => ({
          label: option,
          selected: form.operatingRoomUsed === option,
          onSelect: () => updateField("operatingRoomUsed", option),
        }));

      case "admittedToUnit":
        return ADMITTED_UNIT_OPTIONS.map((option) => ({
          label: option,
          selected: form.admittedToUnit === option,
          onSelect: () => updateField("admittedToUnit", option),
        }));

      case "currentlyAdmittedInIcu":
        return YES_NO_OPTIONS_TEXT.map((option) => ({
          label: option,
          selected: form.currentlyAdmittedInIcu === option,
          onSelect: () =>
            updateField("currentlyAdmittedInIcu", option),
        }));

      case "transferredToWard":
        return YES_NO_OPTIONS_TEXT.map((option) => ({
          label: option,
          selected: form.transferredToWard === option,
          onSelect: () => updateField("transferredToWard", option),
        }));

      case "inActiveCare":
        return YES_NO_OPTIONS_TEXT.map((option) => ({
          label: option,
          selected: form.inActiveCare === option,
          onSelect: () => updateField("inActiveCare", option),
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
            setSelectedFieldResponderRecordId(null);
            setResponderSafetyResponse(null);
            updateField("incidentId", incident.id);
            updateField("incidentName", incident.incident_name);
            updateField("responderSafetyStatus", "");
            updateField("ppeUseTime", "");
            updateField("victimCode", "");
            updateField("patientIdentified", "");
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
        const activeHealthcareFacilities =
          healthcareFacilities.filter(
            (facility) => facility.is_active,
          );

        const facilityOptions =
          activeHealthcareFacilities.length > 0
            ? activeHealthcareFacilities
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
            updateField(
              "healthcareFacilityId",
              facility.id,
            );

            updateField(
              "healthcareFacility",
              formatHealthcareFacilityLabel(facility),
            );

            updateField(
              "hospitalName",
              facility.facility_name,
            );

            updateField(
              "receivingFacilityText",
              facility.facility_name,
            );
          },
        }));
      }

      case "disasterType":
        return HAZARD_TYPE_OPTIONS.map((option) => ({
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
        return getAllowedTriageSystemOptions(form.triageStage).map((option) => ({
          label: option,
          selected:
            form.triageSystem.toLowerCase() ===
            option.toLowerCase(),
          onSelect: () => {
            updateField("triageSystem", option);

            if (getAppendixQuestionsForSystem(option).length > 0) {
              setTimeout(() => {
                setIsTriageAssessmentVisible(true);
              }, 180);
            }
          },
        }));

      case "triageStage":
        return getTriageStageOptionsForRole(
          currentUserRole,
          currentReportingContext,
          currentResponderAssignment,
        ).map((option) => ({
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

      case "treatmentStrategy":
        return TREATMENT_STRATEGY_OPTIONS.map((option) => ({
          label: option,
          selected:
            form.treatmentStrategy.toLowerCase() ===
            option.toLowerCase(),
          onSelect: () => updateField("treatmentStrategy", option),
        }));

      case "transferredOutOfHospital":
        return TRANSFERRED_OUT_OPTIONS.map((option) => ({
          label: option,
          selected:
            form.transferredOutOfHospital.toLowerCase() ===
            option.toLowerCase(),
          onSelect: () =>
            updateField("transferredOutOfHospital", option),
        }));

      case "soughtEdCare":
        return ED_CARE_OPTIONS.map((option) => ({
          label: option,
          selected:
            form.soughtEdCare.toLowerCase() === option.toLowerCase(),
          onSelect: () => updateField("soughtEdCare", option),
        }));

      case "admittedAfterEd":
        return (isHealthcareDocumenterFlow
          ? YES_NO_OPTIONS_TEXT
          : ED_CARE_OPTIONS
        ).map((option) => ({
          label: option,
          selected:
            form.admittedAfterEd.toLowerCase() ===
            option.toLowerCase(),
          onSelect: () => updateField("admittedAfterEd", option),
        }));

      case "dischargedAfterEd":
        return (isHealthcareDocumenterFlow
          ? YES_NO_OPTIONS_TEXT
          : ED_CARE_OPTIONS
        ).map((option) => ({
          label: option,
          selected:
            form.dischargedAfterEd.toLowerCase() ===
            option.toLowerCase(),
          onSelect: () => updateField("dischargedAfterEd", option),
        }));

      case "xrayRequired":
        return (isHealthcareDocumenterFlow
          ? YES_NO_OPTIONS_TEXT
          : ED_CARE_OPTIONS
        ).map((option) => ({
          label: option,
          selected:
            form.xrayRequired.toLowerCase() === option.toLowerCase(),
          onSelect: () => updateField("xrayRequired", option),
        }));

      case "ultrasoundRequired":
        return (isHealthcareDocumenterFlow
          ? YES_NO_OPTIONS_TEXT
          : ED_CARE_OPTIONS
        ).map((option) => ({
          label: option,
          selected:
            form.ultrasoundRequired.toLowerCase() ===
            option.toLowerCase(),
          onSelect: () => updateField("ultrasoundRequired", option),
        }));

      case "ctRequired":
        return (isHealthcareDocumenterFlow
          ? YES_NO_OPTIONS_TEXT
          : ED_CARE_OPTIONS
        ).map((option) => ({
          label: option,
          selected:
            form.ctRequired.toLowerCase() === option.toLowerCase(),
          onSelect: () => updateField("ctRequired", option),
        }));

      case "mechanicalVentilationRequired":
        return (isHealthcareDocumenterFlow
          ? YES_NO_OPTIONS_TEXT
          : ED_CARE_OPTIONS
        ).map((option) => ({
          label: option,
          selected:
            form.mechanicalVentilationRequired.toLowerCase() ===
            option.toLowerCase(),
          onSelect: () =>
            updateField("mechanicalVentilationRequired", option),
        }));

      case "alternativeIcuUsed":
        return (isHealthcareDocumenterFlow
          ? YES_NO_OPTIONS_TEXT
          : ED_CARE_OPTIONS
        ).map((option) => ({
          label: option,
          selected:
            form.alternativeIcuUsed.toLowerCase() ===
            option.toLowerCase(),
          onSelect: () => updateField("alternativeIcuUsed", option),
        }));

      case "died":
        return ED_CARE_OPTIONS.map((option) => ({
          label: option,
          selected: form.died.toLowerCase() === option.toLowerCase(),
          onSelect: () => updateField("died", option),
        }));

      case "deathStage":
        return DEATH_STAGE_OPTIONS.map((option) => ({
          label: option,
          selected:
            form.deathStage.toLowerCase() === option.toLowerCase(),
          onSelect: () => updateField("deathStage", option),
        }));

      case "reachedHospital":
        return ED_CARE_OPTIONS.map((option) => ({
          label: option,
          selected:
            form.reachedHospital.toLowerCase() ===
            option.toLowerCase(),
          onSelect: () => updateField("reachedHospital", option),
        }));

      case "medicalContactBeforeDeath":
        return ED_CARE_OPTIONS.map((option) => ({
          label: option,
          selected:
            form.medicalContactBeforeDeath.toLowerCase() ===
            option.toLowerCase(),
          onSelect: () =>
            updateField("medicalContactBeforeDeath", option),
        }));

      case "finalDisposition":
        return FINAL_DISPOSITION_OPTIONS.map((option) => ({
          label: option,
          selected:
            form.finalDisposition.toLowerCase() ===
            option.toLowerCase(),
          onSelect: () => updateField("finalDisposition", option),
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

  async function ensureResponderSafetyResponseSaved() {
    if (
      isEditing ||
      (!isFieldResponderFlow && !isSaResponderFlow) ||
      hasSavedResponderSafetyResponse
    ) {
      return;
    }

    if (!currentUserId || !form.incidentId) {
      return;
    }

    const ppeUsedAt = parseDateTimeInput(form.ppeUseTime);

    if (!ppeUsedAt) {
      throw new Error("Time of PPE Use is required.");
    }

    const response = await saveResponderSafetyResponse(form.incidentId, {
      safetyStatus: normalizeResponderSafetyStatusForApi(
        form.responderSafetyStatus,
      ),
      ppeUsedAt,
      responderFunction: currentResponderAssignment,
    });

    setResponderSafetyResponse(response);
  }

  async function handleSubmit() {
    const shouldResetPendingDepartureForm =
      !isEditing &&
      isSaResponderFlow &&
      form.patientFor === "Pending Departure";

    if (
      !isEditing &&
      isFieldResponderFlow &&
      form.victimCodeMarked !== "Yes"
    ) {
      Alert.alert(
        "Victim code marking required",
        "Confirm that you marked the victim with the victim code and your user code before submitting.",
      );
      const statusStepIndex = activeSteps.indexOf("Status");
      setCurrentStep(statusStepIndex >= 0 ? statusStepIndex : 0);
      return;
    }

    if (!isEditing || !casualtyId) {
      const clientRecordId = generateUuid();
      const queuedPayload: QueuedCasualtyPayload = {
        clientRecordId,
        incidentId: form.incidentId || undefined,
        offlineIncidentName: form.incidentName || undefined,
        person: personPayload,
        incidentDetails: incidentDetailsPayload,
        triageAssessment: triageAssessmentPayload,
        transportRecord: transportRecordPayload,
        treatmentRecord: treatmentRecordPayload,
        facilityEncounter: facilityEncounterPayload,
        casualtyOutcome: casualtyOutcomePayload,
      };

      if (!currentUserId) {
        try {
          setIsSubmitting(true);

          await queueCasualtySubmission(queuedPayload);

          if (shouldResetPendingDepartureForm) {
            resetForNextCasualty();
          }

          setSubmissionFeedback({
            title: "Saved on this device",
            message:
              "The casualty record was saved locally. Log in from Profile later to sync records to DCMS.",
            resetOnClose: shouldResetPendingDepartureForm ? false : undefined,
          });
        } catch (error) {
          Alert.alert(
            "Unable to save offline",
            error instanceof Error
              ? error.message
              : "Please try saving the record again.",
          );
        } finally {
          setIsSubmitting(false);
        }

        return;
      }

      if (!form.incidentId) {
        Alert.alert(
          "Select a disaster incident",
          "Choose or create a disaster incident before submitting this casualty.",
        );
        const incidentStepIndex = activeSteps.indexOf("Incident");
        setCurrentStep(incidentStepIndex >= 0 ? incidentStepIndex : 0);

        if (incidentStepIndex < 0) {
          openChoiceSheet("incident");
        }

        return;
      }

      try {
        setIsSubmitting(true);

        await ensureResponderSafetyResponseSaved();

        const payload: CreateCasualtyPayload = {
          clientRecordId,
          incidentId: form.incidentId,
          person: personPayload,
          incidentDetails: incidentDetailsPayload,
          triageAssessment: triageAssessmentPayload,
          transportRecord: transportRecordPayload,
          treatmentRecord: treatmentRecordPayload,
          facilityEncounter: facilityEncounterPayload,
          casualtyOutcome: casualtyOutcomePayload,
        };

        const response = await createCasualty(payload);

        const createdRecordId =
          response.data.casualtyIncident.id;

        const photoUploadError =
          await uploadSelectedPhoto(createdRecordId);

        if (shouldResetPendingDepartureForm) {
          resetForNextCasualty();
        }

        setSubmissionFeedback({
          title: "Casualty submitted",
          message: photoUploadError
            ? `The casualty record was saved, but the photo upload failed: ${photoUploadError}`
            : "The casualty record has been saved successfully.",
          resetOnClose: shouldResetPendingDepartureForm ? false : undefined,
        });
      } catch (error) {
        console.error("Failed to submit casualty:", error);

        if (isNetworkSubmissionError(error)) {
          await queueCasualtySubmission(queuedPayload);

          if (shouldResetPendingDepartureForm) {
            resetForNextCasualty();
          }

          setSubmissionFeedback({
            title: "Saved offline",
            message:
              "The casualty record was saved on this device and will sync when the connection is available.",
            resetOnClose: shouldResetPendingDepartureForm ? false : undefined,
          });
          return;
        }

        if (isAuthenticationTokenError(error)) {
          await queueCasualtySubmission(queuedPayload);

          if (shouldResetPendingDepartureForm) {
            resetForNextCasualty();
          }

          Alert.alert(
            "Session expired",
            "The casualty record was saved on this device. Please log in again from Profile, then sync queued records.",
            [
              {
                text: "OK",
                onPress: () => router.replace("/profile"),
              },
            ],
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

      const response = await updateCasualty(casualtyId, updatePayload);
      const photoUploadError = await uploadSelectedPhoto(casualtyId);
      const responseMessage =
        response.message ||
        "The casualty record has been saved successfully.";
      const returnedForReview = responseMessage
        .toLowerCase()
        .includes("returned for admin review");

      setSubmissionFeedback({
        title: returnedForReview
          ? "Returned for admin review"
          : "Casualty updated",
        message: photoUploadError
          ? `The casualty record was saved, but the photo upload failed: ${photoUploadError}`
          : responseMessage,
        onCloseRoute: `/casualty/${encodeURIComponent(casualtyId)}`,
        resetOnClose: false,
      });
    } catch (error) {
      console.error("Failed to update casualty:", error);

      if (isAuthenticationTokenError(error)) {
        Alert.alert(
          "Session expired",
          "Please log in again from Profile, then try saving the casualty update again.",
          [
            {
              text: "OK",
              onPress: () => router.replace("/profile"),
            },
          ],
        );
        return;
      }

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
    if (!isResponderEditLockedStep && !validateCurrentStep()) {
      return;
    }

    if (currentStep < activeSteps.length - 1) {
      setCurrentStep((step) => step + 1);
      return;
    }

    void handleSubmit();
  }

  function goPreviousStep() {
  if (currentStep > 0) {
    setCurrentStep((step) => step - 1);
  }
}

function confirmExitAddCasualty() {
  setIsExitConfirmVisible(true);
}

  function renderResponderSafetyStep() {
    const safetyControlsDisabled =
      hasSavedResponderSafetyResponse ||
      isLoadingResponderSafetyResponse;

    return (
      <>
        {isFieldResponderFlow || isSaResponderFlow ? (
          <>
            <SectionLabel title="Incident" />

            <SelectField
              label="INCIDENT NAME"
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
          </>
        ) : null}

        <SectionLabel title="Responder safety" />

        {hasSavedResponderSafetyResponse ? (
          <View style={styles.inlineSuccess}>
            <Ionicons
              name="checkmark-circle-outline"
              size={18}
              color={COLORS.green}
            />
            <Text style={styles.inlineSuccessText}>
              Responder safety was already recorded for this incident.
              This answer is locked to avoid duplicate entries.
            </Text>
          </View>
        ) : null}

        {responderSafetyResponseError ? (
          <View style={styles.inlineWarning}>
            <Ionicons
              name="alert-circle-outline"
              size={18}
              color={COLORS.maroon}
            />
            <Text style={styles.inlineWarningText}>
              {responderSafetyResponseError}
            </Text>
          </View>
        ) : null}

        <View style={styles.safetyPromptCard}>
          <Text style={styles.safetyPromptTitle}>
            Are you safe?
          </Text>

          <View style={styles.safetyOptionsRow}>
            {YES_NO_OPTIONS_TEXT.map((option) => {
              const selected =
                form.responderSafetyStatus === option;

              return (
                <Pressable
                  key={option}
                  disabled={safetyControlsDisabled}
                  onPress={() =>
                    updateField("responderSafetyStatus", option)
                  }
                  style={({ pressed }) => [
                    styles.safetyOption,
                    selected && styles.safetyOptionSelected,
                    safetyControlsDisabled && styles.safetyOptionDisabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons
                    name={
                      option === "Yes"
                        ? "checkmark-circle-outline"
                        : "close-circle-outline"
                    }
                    size={18}
                    color={
                      selected
                        ? COLORS.white
                        : option === "Yes"
                          ? COLORS.green
                          : COLORS.maroon
                    }
                  />
                  <Text
                    style={[
                      styles.safetyOptionText,
                      selected && styles.safetyOptionTextSelected,
                    ]}
                  >
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <CurrentTimeField
          label="TIME OF PPE USE"
          value={form.ppeUseTime}
          placeholder="mm/dd/yyyy hh:mm AM/PM"
          buttonLabel="Use current time"
          icon="time-outline"
          disabled={safetyControlsDisabled}
          onChangeText={(value) => updateField("ppeUseTime", value)}
          onUseCurrent={() =>
            updateField(
              "ppeUseTime",
              formatDateTimeForInput(new Date()),
            )
          }
        />
      </>
    );
  }

  function renderHealthcareDocumenterGeneralStep() {
    return (
      <>
        <SelectField
          label="INCIDENT NAME"
          value={form.incidentName || form.incidentId}
          placeholder={
            isLoadingIncidents
              ? "Loading active incidents..."
              : "Select active incident"
          }
          onPress={() => openChoiceSheet("incident")}
        />

        <SelectField
          label="RECEIVING FACILITY NAME"
          value={form.healthcareFacility}
          placeholder={
            isLoadingHealthcareFacilities
              ? "Loading healthcare facilities..."
              : "Select receiving facility"
          }
          onPress={() => openChoiceSheet("healthcareFacility")}
        />

        <CurrentTimeField
          label="ARRIVAL TIME"
          value={form.arrivedFacilityTime}
          placeholder="mm/dd/yyyy hh:mm"
          buttonLabel="Use current arrival time"
          onChangeText={(value) =>
            updateField("arrivedFacilityTime", value)
          }
          onUseCurrent={() =>
            updateField(
              "arrivedFacilityTime",
              formatDateTimeForInput(new Date()),
            )
          }
        />

        <SelectField
          label="DISPOSITION UPON HOSPITAL ARRIVAL"
          value={form.dispositionUponHospitalArrival}
          placeholder="Select disposition"
          onPress={() =>
            openChoiceSheet("dispositionUponHospitalArrival")
          }
        />
      </>
    );
  }

  function renderHealthcareDocumenterPatientStep() {
    return (
      <>
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

  function renderHealthcareDocumenterManagementStep() {
    const showResuscitationTime = form.resuscitationRoomUsed === "Yes";
    const showSurgeryFields =
      form.surgicalInterventionRequired === "Yes";
    const showOperatingRoomTime =
      showSurgeryFields && form.operatingRoomUsed === "Yes";
    const showXrayTime = form.xrayRequired === "Yes";
    const showUltrasoundTime = form.ultrasoundRequired === "Yes";
    const showCtTime = form.ctRequired === "Yes";
    const showIcuFields = form.admittedToUnit === "ICU";
    const showVentilationTimes =
      showIcuFields && form.mechanicalVentilationRequired === "Yes";

    return (
      <>
        <SelectField
          label="RESUSCITATION ROOM USED?"
          value={form.resuscitationRoomUsed}
          placeholder="Yes or No"
          onPress={() => openChoiceSheet("resuscitationRoomUsed")}
        />

        {showResuscitationTime ? (
          <View style={styles.conditionalChildGroup}>
            <CurrentTimeField
              label="TIME OF RESUSCITATION ROOM USE"
              value={form.edResuscitationTime}
              placeholder="mm/dd/yyyy hh:mm"
              buttonLabel="Use current resuscitation time"
              onChangeText={(value) =>
                updateField("edResuscitationTime", value)
              }
              onUseCurrent={() =>
                updateField(
                  "edResuscitationTime",
                  formatDateTimeForInput(new Date()),
                )
              }
            />
          </View>
        ) : null}

        <SelectField
          label="SURGICAL INTERVENTION?"
          value={form.surgicalInterventionRequired}
          placeholder="Yes or No"
          onPress={() =>
            openChoiceSheet("surgicalInterventionRequired")
          }
        />

        {showSurgeryFields ? (
          <View style={styles.conditionalChildGroup}>
            <CurrentTimeField
              label="TIME OF SURGICAL INTERVENTION"
              value={form.surgicalInterventionStartTime}
              placeholder="mm/dd/yyyy hh:mm"
              buttonLabel="Use current surgery time"
              onChangeText={(value) =>
                updateField("surgicalInterventionStartTime", value)
              }
              onUseCurrent={() =>
                updateField(
                  "surgicalInterventionStartTime",
                  formatDateTimeForInput(new Date()),
                )
              }
            />

            <SelectField
              label="OPERATING ROOM USED?"
              value={form.operatingRoomUsed}
              placeholder="Yes or No"
              onPress={() => openChoiceSheet("operatingRoomUsed")}
            />

            {showOperatingRoomTime ? (
              <View style={styles.conditionalGrandchildGroup}>
                <CurrentTimeField
                  label="TIME OF OPERATING ROOM USE"
                  value={form.operatingRoomTime}
                  placeholder="mm/dd/yyyy hh:mm"
                  buttonLabel="Use current OR time"
                  onChangeText={(value) =>
                    updateField("operatingRoomTime", value)
                  }
                  onUseCurrent={() =>
                    updateField(
                      "operatingRoomTime",
                      formatDateTimeForInput(new Date()),
                    )
                  }
                />
              </View>
            ) : null}
          </View>
        ) : null}

        <FormField
          label="NUMBER OF OPERATING ROOMS"
          value={form.numberOfOperatingRooms}
          placeholder="Number used or available"
          keyboardType="numeric"
          onChangeText={(value) =>
            updateField(
              "numberOfOperatingRooms",
              value.replace(/[^0-9]/g, ""),
            )
          }
        />

        <SelectField
          label="X-RAY USED?"
          value={form.xrayRequired}
          placeholder="Yes or No"
          onPress={() => openChoiceSheet("xrayRequired")}
        />

        {showXrayTime ? (
          <View style={styles.conditionalChildGroup}>
            <CurrentTimeField
              label="TIME OF X-RAY USE"
              value={form.xrayTime}
              placeholder="mm/dd/yyyy hh:mm"
              buttonLabel="Use current X-ray time"
              onChangeText={(value) => updateField("xrayTime", value)}
              onUseCurrent={() =>
                updateField("xrayTime", formatDateTimeForInput(new Date()))
              }
            />
          </View>
        ) : null}

        <SelectField
          label="ULTRASOUND USED?"
          value={form.ultrasoundRequired}
          placeholder="Yes or No"
          onPress={() => openChoiceSheet("ultrasoundRequired")}
        />

        {showUltrasoundTime ? (
          <View style={styles.conditionalChildGroup}>
            <CurrentTimeField
              label="TIME OF ULTRASOUND USE"
              value={form.ultrasoundTime}
              placeholder="mm/dd/yyyy hh:mm"
              buttonLabel="Use current ultrasound time"
              onChangeText={(value) =>
                updateField("ultrasoundTime", value)
              }
              onUseCurrent={() =>
                updateField(
                  "ultrasoundTime",
                  formatDateTimeForInput(new Date()),
                )
              }
            />
          </View>
        ) : null}

        <SelectField
          label="CT SCAN USED?"
          value={form.ctRequired}
          placeholder="Yes or No"
          onPress={() => openChoiceSheet("ctRequired")}
        />

        {showCtTime ? (
          <View style={styles.conditionalChildGroup}>
            <CurrentTimeField
              label="TIME OF CT SCAN USE"
              value={form.ctTime}
              placeholder="mm/dd/yyyy hh:mm"
              buttonLabel="Use current CT time"
              onChangeText={(value) => updateField("ctTime", value)}
              onUseCurrent={() =>
                updateField("ctTime", formatDateTimeForInput(new Date()))
              }
            />
          </View>
        ) : null}

        <SelectField
          label="ADMITTED TO UNIT"
          value={form.admittedToUnit}
          placeholder="Select unit"
          onPress={() => openChoiceSheet("admittedToUnit")}
        />

        {showIcuFields ? (
          <View style={styles.conditionalChildGroup}>
            <CurrentTimeField
              label="ICU ADMISSION TIME"
              value={form.icuAdmissionTime}
              placeholder="mm/dd/yyyy hh:mm"
              buttonLabel="Use current ICU time"
              onChangeText={(value) =>
                updateField("icuAdmissionTime", value)
              }
              onUseCurrent={() =>
                updateField(
                  "icuAdmissionTime",
                  formatDateTimeForInput(new Date()),
                )
              }
            />

            <SelectField
              label="MECHANICAL VENTILATION USED?"
              value={form.mechanicalVentilationRequired}
              placeholder="Yes or No"
              onPress={() =>
                openChoiceSheet("mechanicalVentilationRequired")
              }
            />

            {showVentilationTimes ? (
              <View style={styles.conditionalGrandchildGroup}>
                <CurrentTimeField
                  label="TIME OF MECHANICAL VENTILATION USE"
                  value={form.ventilationStartTime}
                  placeholder="mm/dd/yyyy hh:mm"
                  buttonLabel="Use current ventilation time"
                  onChangeText={(value) =>
                    updateField("ventilationStartTime", value)
                  }
                  onUseCurrent={() =>
                    updateField(
                      "ventilationStartTime",
                      formatDateTimeForInput(new Date()),
                    )
                  }
                />

                <CurrentTimeField
                  label="TIME OF DISCONTINUATION"
                  value={form.ventilationEndTime}
                  placeholder="mm/dd/yyyy hh:mm"
                  buttonLabel="Use current discontinue time"
                  onChangeText={(value) =>
                    updateField("ventilationEndTime", value)
                  }
                  onUseCurrent={() =>
                    updateField(
                      "ventilationEndTime",
                      formatDateTimeForInput(new Date()),
                    )
                  }
                />
              </View>
            ) : null}

            <SelectField
              label="ALTERNATIVE ICU ADMISSION?"
              value={form.alternativeIcuUsed}
              placeholder="Yes or No"
              onPress={() => openChoiceSheet("alternativeIcuUsed")}
            />
          </View>
        ) : null}
      </>
    );
  }

  function renderHealthcareDocumenterDispositionStep() {
    const showIcuDisposition = form.admittedToUnit === "ICU";
    const showWardTransferTime =
      showIcuDisposition && form.transferredToWard === "Yes";
    const showDischargeTime = form.dischargedAfterEd === "Yes";

    return (
      <>
        {showIcuDisposition ? (
          <>
            <SelectField
              label="CURRENTLY ADMITTED IN ICU"
              value={form.currentlyAdmittedInIcu}
              placeholder="Yes or No"
              onPress={() =>
                openChoiceSheet("currentlyAdmittedInIcu")
              }
            />

            <SelectField
              label="TRANSFERRED TO WARD"
              value={form.transferredToWard}
              placeholder="Yes or No"
              onPress={() => openChoiceSheet("transferredToWard")}
            />

            {showWardTransferTime ? (
              <View style={styles.conditionalChildGroup}>
                <CurrentTimeField
                  label="TIME OF TRANSFER"
                  value={form.icuTransferOutTime}
                  placeholder="mm/dd/yyyy hh:mm"
                  buttonLabel="Use current transfer time"
                  onChangeText={(value) =>
                    updateField("icuTransferOutTime", value)
                  }
                  onUseCurrent={() =>
                    updateField(
                      "icuTransferOutTime",
                      formatDateTimeForInput(new Date()),
                    )
                  }
                />
              </View>
            ) : null}
          </>
        ) : (
          <SelectField
            label="IN ACTIVE CARE"
            value={form.inActiveCare}
            placeholder="Yes or No"
            onPress={() => openChoiceSheet("inActiveCare")}
          />
        )}

        <SelectField
          label="DISCHARGED FROM HOSPITAL"
          value={form.dischargedAfterEd}
          placeholder="Yes or No"
          onPress={() => openChoiceSheet("dischargedAfterEd")}
        />

        {showDischargeTime ? (
          <View style={styles.conditionalChildGroup}>
            <CurrentTimeField
              label="TIME OF DISCHARGE"
              value={form.hospitalDischargeTime}
              placeholder="mm/dd/yyyy hh:mm"
              buttonLabel="Use current discharge time"
              onChangeText={(value) =>
                updateField("hospitalDischargeTime", value)
              }
              onUseCurrent={() =>
                updateField(
                  "hospitalDischargeTime",
                  formatDateTimeForInput(new Date()),
                )
              }
            />
          </View>
        ) : null}
      </>
    );
  }

  function renderSaIntroStep() {
    return (
      <>
        <SelectField
          label="INCIDENT NAME"
          value={form.incidentName || form.incidentId}
          placeholder={
            isLoadingIncidents
              ? "Loading active incidents..."
              : "Select active incident"
          }
          onPress={() => openChoiceSheet("incident")}
        />

        <SelectField
          label="WITNESS PRESENT"
          value={form.witnessPresent}
          placeholder="Select witness"
          onPress={() => openChoiceSheet("witnessPresent")}
        />

        {parseMultiSelectValue(form.witnessPresent).includes("Others") ? (
          <FormField
            label="OTHER WITNESS"
            value={form.witnessOther}
            placeholder="Specify witness"
            onChangeText={(value) =>
              updateField("witnessOther", value)
            }
          />
        ) : null}

        <SelectField
          label="WITNESS RESPONSE"
          value={form.witnessResponse}
          placeholder="Select response"
          onPress={() => openChoiceSheet("witnessResponse")}
        />

        {form.witnessResponse === "CPR" ? (
          <SelectField
            label="CPR TYPE"
            value={form.cprType}
            placeholder="Select CPR type"
            onPress={() => openChoiceSheet("cprType")}
          />
        ) : null}
      </>
    );
  }

  function renderSaInfoStep() {
    const showPersonalDetails =
      form.patientIdentified !== "No";

    return (
      <>
        <FormField
          label="VICTIM CODE"
          value={form.victimCode}
          placeholder="Enter victim code"
          onChangeText={(value) =>
            updateField("victimCode", value)
          }
        />

        {form.victimCode ? (
          <SelectField
            label="PATIENT IDENTIFIED?"
            value={form.patientIdentified}
            placeholder="Yes or No"
            onPress={() => openChoiceSheet("patientIdentified")}
          />
        ) : null}

        {showPersonalDetails ? (
          <View style={styles.twoColumnRow}>
            <View style={styles.halfColumn}>
              <FormField
                label="ID NUMBER"
                value={form.idNumber}
                placeholder="CAS-UNIT-001"
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
        ) : (
          <FormField
            label="ID NUMBER"
            value={form.idNumber}
            placeholder="CAS-UNIT-001"
            editable={false}
            onChangeText={(value) =>
              updateField("idNumber", value)
            }
          />
        )}

        {showPersonalDetails ? (
          <>
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

            <View style={styles.twoColumnRow}>
              <View style={styles.halfColumn}>
                <SelectField
                  label="NEWBORN?"
                  value={form.newborn}
                  placeholder="Yes or No"
                  onPress={() => openChoiceSheet("newborn")}
                />
              </View>

              <View style={styles.halfColumn}>
                <SelectField
                  label="PREGNANT?"
                  value={form.pregnant}
                  placeholder="Yes or No"
                  onPress={() => openChoiceSheet("pregnant")}
                />
              </View>
            </View>

            <FormField
              label="RELIGION"
              value={form.religion}
              placeholder="Religion"
              onChangeText={(value) =>
                updateField("religion", value)
              }
            />

            <FormField
              label="CONTACT NUMBER"
              value={form.contactNumber}
              placeholder="Contact number"
              keyboardType="phone-pad"
              onChangeText={(value) =>
                updateField("contactNumber", value)
              }
            />
          </>
        ) : (
          <View style={styles.inlineWarning}>
            <Ionicons
              name="person-outline"
              size={18}
              color={COLORS.maroon}
            />
            <Text style={styles.inlineWarningText}>
              Personal details are hidden because this patient is marked unidentified.
            </Text>
          </View>
        )}
      </>
    );
  }

  function renderPersonalStep() {
    return (
      <>
        {!isEditing && form.incidentId ? (
          <View style={styles.selectedIncidentBanner}>
            <View style={styles.selectedIncidentIcon}>
              <Ionicons
                name="warning-outline"
                size={18}
                color={COLORS.maroon}
              />
            </View>
            <View style={styles.selectedIncidentTextGroup}>
              <Text style={styles.selectedIncidentLabel}>
                SELECTED INCIDENT
              </Text>
              <Text
                style={styles.selectedIncidentName}
                numberOfLines={2}
              >
                {form.incidentName || form.incidentId}
              </Text>
            </View>
          </View>
        ) : null}

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
          label="INCIDENT NAME"
          value={form.incidentName || form.incidentId}
          placeholder={
            !currentUserId && !isEditing
              ? "Optional while offline"
              : isLoadingIncidents
              ? "Loading active incidents..."
              : "Select active incident"
          }
          onPress={() => openChoiceSheet("incident")}
        />

        {!currentUserId && !isEditing ? (
          <View style={styles.inlineWarning}>
            <Ionicons
              name="cloud-offline-outline"
              size={18}
              color={COLORS.maroon}
            />
            <Text style={styles.inlineWarningText}>
              You are capturing as a guest. This record will stay on this device until you log in and assign it to an active incident.
            </Text>
          </View>
        ) : null}

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
            <Pressable
              onPress={() =>
                setIsIncidentQuickCreateExpanded((current) => !current)
              }
              style={({ pressed }) => [
                styles.quickCreateHeader,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Toggle quick create incident"
            >
              <View style={styles.quickCreateHeaderTitle}>
                <Ionicons
                  name="add-circle-outline"
                  size={20}
                  color={COLORS.maroon}
                />
                <Text style={styles.quickCreateTitle}>
                  Quick create incident
                </Text>
              </View>

              <Ionicons
                name={
                  isIncidentQuickCreateExpanded
                    ? "chevron-up-outline"
                    : "chevron-down-outline"
                }
                size={18}
                color={COLORS.secondaryText}
              />
            </Pressable>

            {isIncidentQuickCreateExpanded ? (
              <View style={styles.quickCreateBody}>
                <FormField
                  label="NEW INCIDENT NAME"
                  value={newIncidentName}
                  placeholder="e.g. Flood in Barangay San Isidro"
                  onChangeText={setNewIncidentName}
                />

                <SelectField
                  label="HAZARD TYPE"
                  value={newIncidentType}
                  placeholder="Select type of hazard"
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
            <Pressable
              onPress={() =>
                setIsEvacuationQuickCreateExpanded(
                  (current) => !current,
                )
              }
              style={({ pressed }) => [
                styles.quickCreateHeader,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Toggle quick create evacuation center"
            >
              <View style={styles.quickCreateHeaderTitle}>
                <Ionicons
                  name="business-outline"
                  size={20}
                  color={COLORS.maroon}
                />
                <Text style={styles.quickCreateTitle}>
                  Quick create evacuation center
                </Text>
              </View>

              <Ionicons
                name={
                  isEvacuationQuickCreateExpanded
                    ? "chevron-up-outline"
                    : "chevron-down-outline"
                }
                size={18}
                color={COLORS.secondaryText}
              />
            </Pressable>

            {isEvacuationQuickCreateExpanded ? (
              <View style={styles.quickCreateBody}>
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

  function renderAppendixQuestion(question: AppendixQuestion) {
    const isFinalTriageQuestion = question.key === "finalTriage";
    const selectedValue = isFinalTriageQuestion
      ? getCalculatedFinalTriageAnswer(
          form.triageSystem,
          buildTriageAssessmentAnswers(form),
        )
      : form.triageAssessmentAnswers[question.key] ?? "";
    const finalTriageIsCalculated =
      isFinalTriageQuestion && selectedValue.length > 0;

    if (question.inputType === "numeric") {
      return (
        <View key={question.key} style={styles.appendixQuestion}>
          <Text style={styles.appendixQuestionLabel}>
            {question.label}
          </Text>

          <TextInput
            value={selectedValue}
            placeholder="Numbers only"
            placeholderTextColor={COLORS.muted}
            keyboardType="number-pad"
            inputMode="numeric"
            onChangeText={(value) =>
              updateTriageAssessmentAnswer(
                question.key,
                value.replace(/[^0-9]/g, ""),
              )
            }
            style={styles.appendixNumericInput}
          />
        </View>
      );
    }

    return (
      <View key={question.key} style={styles.appendixQuestion}>
        <Text style={styles.appendixQuestionLabel}>
          {question.label}
        </Text>
        {isFinalTriageQuestion ? (
          <Text style={styles.appendixQuestionHint}>
            {finalTriageIsCalculated
              ? "Automatically selected from the assessment formula."
              : "Answer assessment items to calculate the final triage."}
          </Text>
        ) : null}
        <View style={styles.appendixOptionGrid}>
          {(question.options ?? []).map((option) => {
            const selected = selectedValue === option.value;
            const finalTriageColorStyle = isFinalTriageQuestion
              ? getTriageColorButtonStyle(option.value)
              : null;

            return (
              <Pressable
                key={option.value}
                disabled={isFinalTriageQuestion}
                onPress={() =>
                  updateTriageAssessmentAnswer(
                    question.key,
                    selected ? "" : option.value,
                  )
                }
                style={({ pressed }) => [
                  styles.appendixOption,
                  isFinalTriageQuestion &&
                    styles.finalTriageOption,
                  selected && styles.appendixOptionSelected,
                  finalTriageColorStyle,
                  isFinalTriageQuestion &&
                    !selected &&
                    finalTriageColorStyle &&
                    styles.finalTriageOptionInactive,
                  isFinalTriageQuestion &&
                    selected &&
                    finalTriageColorStyle &&
                    styles.finalTriageOptionSelected,
                  pressed && !isFinalTriageQuestion && styles.pressed,
                ]}
              >
                <Text
                  numberOfLines={2}
                  style={[
                    styles.appendixOptionText,
                    isFinalTriageQuestion &&
                      finalTriageColorStyle &&
                      getTriageColorTextStyle(option.value),
                    selected && styles.appendixOptionTextSelected,
                    isFinalTriageQuestion &&
                      selected &&
                      finalTriageColorStyle &&
                      getTriageColorTextStyle(option.value),
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  function getTriageAssessmentSummary(): string {
    const questions = getAppendixQuestionsForSystem(form.triageSystem);

    if (questions.length === 0) {
      return "";
    }

    const manualQuestions = questions.filter(
      (question) => question.key !== "finalTriage",
    );
    const answeredCount = manualQuestions.filter(
      (question) => form.triageAssessmentAnswers[question.key],
    ).length;
    const calculatedFinalTriage = getCalculatedFinalTriageAnswer(
      form.triageSystem,
      buildTriageAssessmentAnswers(form),
    );
    const isEsiTriage =
      normalizeTriageSystem(form.triageSystem) === "esi";

    const resultSuffix = calculatedFinalTriage
      ? isEsiTriage
        ? ` - ${calculatedFinalTriage
            .replace("esi_", "ESI ")}`
        : ` - ${titleCase(
            triageFinalAnswerToCategory(
              form.triageSystem,
              calculatedFinalTriage,
            ),
          )}`
      : "";

    if (answeredCount === manualQuestions.length) {
      return `Complete (${answeredCount}/${manualQuestions.length})${resultSuffix}`;
    }

    return answeredCount > 0
      ? `Ready (${answeredCount}/${manualQuestions.length} answered)${resultSuffix}`
      : `${answeredCount}/${manualQuestions.length} answered`;
  }

  function renderTriageAssessmentSheet() {
    const questions = getAppendixQuestionsForSystem(form.triageSystem);

    return (
      <Modal
        visible={isTriageAssessmentVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsTriageAssessmentVisible(false)}
      >
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setIsTriageAssessmentVisible(false)}
        >
          <Pressable style={styles.assessmentSheet}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>
                  Triage Assessment
                </Text>
                <Text style={styles.assessmentSubtitle}>
                  {form.triageSystem}
                </Text>
              </View>

              <Pressable
                onPress={() => setIsTriageAssessmentVisible(false)}
                style={({ pressed }) => [
                  styles.sheetCloseButton,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Close assessment"
              >
                <Ionicons
                  name="close"
                  size={20}
                  color={COLORS.secondaryText}
                />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.assessmentList}
              showsVerticalScrollIndicator={false}
            >
              {questions.map(renderAppendixQuestion)}
            </ScrollView>

            <Pressable
              onPress={() => setIsTriageAssessmentVisible(false)}
              style={({ pressed }) => [
                styles.assessmentDoneButton,
                pressed && styles.primaryButtonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Done with triage assessment"
            >
              <Text style={styles.assessmentDoneButtonText}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  function renderTriageStep() {
  const selectedFinalTriage = getCalculatedFinalTriageAnswer(
    form.triageSystem,
    buildTriageAssessmentAnswers(form),
  );

  const isEsiTriage =
    normalizeTriageSystem(form.triageSystem) === "esi";

  const triageAssessmentColorStyle = selectedFinalTriage
    ? getTriageColorButtonStyle(selectedFinalTriage)
    : null;

  const triageAssessmentTextStyle = selectedFinalTriage
    ? isEsiTriage
      ? { color: COLORS.text }
      : getTriageColorTextStyle(selectedFinalTriage)
    : null;

  const triageAssessmentIconColor = selectedFinalTriage
    ? isEsiTriage
      ? COLORS.secondaryText
      : getTriageAssessmentIconColor(selectedFinalTriage)
    : COLORS.secondaryText;

    return (
      <>
        {isFieldResponderFlow ? (
          <>
            <FormField
              label="VICTIM CODE"
              value={form.victimCode}
              placeholder="Enter victim code"
              onChangeText={(value) =>
                updateField("victimCode", value)
              }
            />

            <FormField
              label="USER CODE"
              value={form.userCode}
              placeholder="Auto-generated from logged-in user"
              editable={false}
              onChangeText={() => undefined}
            />
          </>
        ) : null}

        <SelectField
          label="TRIAGE STAGE"
          value={form.triageStage}
          placeholder="Select triage stage"
          onPress={() => openChoiceSheet("triageStage")}
        />

        <SelectField
          label="TRIAGE SYSTEM"
          value={form.triageSystem}
          placeholder="Select triage system"
          onPress={() => openChoiceSheet("triageSystem")}
        />

        {form.triageSystem === "Other" ? (
          <FormField
            label="SPECIFY OTHER"
            value={form.triageSystemOther}
            placeholder="Specify other triage system"
            onChangeText={(value) =>
              updateField("triageSystemOther", value)
            }
          />
        ) : null}

        <SelectField
          label="TRIAGE ASSESSMENT"
          value={getTriageAssessmentSummary()}
          placeholder="Open assessment"
          icon="clipboard-outline"
          inputStyle={
            triageAssessmentColorStyle
              ? [
                  styles.triageAssessmentColoredSelect,
                  triageAssessmentColorStyle,
                ]
              : undefined
          }
          textStyle={triageAssessmentTextStyle ?? undefined}
          iconColor={triageAssessmentIconColor}
          onPress={openTriageAssessment}
        />

        {isFieldResponderFlow ? (
          <CurrentTimeField
            label="TRIAGE TIME"
            value={form.triageTime}
            placeholder="mm/dd/yyyy hh:mm AM/PM"
            buttonLabel="Use current triage time"
            onChangeText={(value) =>
              updateField("triageTime", value)
            }
            onUseCurrent={() =>
              updateField(
                "triageTime",
                formatDateTimeForInput(new Date()),
              )
            }
          />
        ) : null}

        {!isFieldResponderFlow ? (
          <>
            <CurrentTimeField
              label="TRIAGE TIME"
              value={form.triageTime}
              placeholder="mm/dd/yyyy hh:mm AM/PM"
              buttonLabel="Use current triage time"
              onChangeText={(value) =>
                updateField("triageTime", value)
              }
              onUseCurrent={() =>
                updateField(
                  "triageTime",
                  formatDateTimeForInput(new Date()),
                )
              }
            />

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

            {isHealthcareDocumenterFlow ? (
              <>
                <SelectField
                  label="ADMITTED TO HOSPITAL?"
                  value={form.admittedAfterEd}
                  placeholder="Yes or No"
                  onPress={() => openChoiceSheet("admittedAfterEd")}
                />

                {form.admittedAfterEd === "Yes" ? (
                  <View style={styles.conditionalChildGroup}>
                    <CurrentTimeField
                      label="ADMISSION TIME"
                      value={form.hospitalAdmissionTime}
                      placeholder="mm/dd/yyyy hh:mm"
                      buttonLabel="Use current admission time"
                      onChangeText={(value) =>
                        updateField("hospitalAdmissionTime", value)
                      }
                      onUseCurrent={() =>
                        updateField(
                          "hospitalAdmissionTime",
                          formatDateTimeForInput(new Date()),
                        )
                      }
                    />
                  </View>
                ) : null}

                {form.admittedAfterEd === "No" ? (
                  <View style={styles.conditionalChildGroup}>
                    <SelectField
                      label="DISCHARGED FROM HOSPITAL?"
                      value={form.dischargedAfterEd}
                      placeholder="Yes or No"
                      onPress={() =>
                        openChoiceSheet("dischargedAfterEd")
                      }
                    />

                    {form.dischargedAfterEd === "Yes" ? (
                      <View style={styles.conditionalGrandchildGroup}>
                        <CurrentTimeField
                          label="DISCHARGE TIME"
                          value={form.hospitalDischargeTime}
                          placeholder="mm/dd/yyyy hh:mm"
                          buttonLabel="Use current discharge time"
                          onChangeText={(value) =>
                            updateField(
                              "hospitalDischargeTime",
                              value,
                            )
                          }
                          onUseCurrent={() =>
                            updateField(
                              "hospitalDischargeTime",
                              formatDateTimeForInput(new Date()),
                            )
                          }
                        />
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </>
            ) : null}
          </>
        ) : null}
      </>
    );
  }

  function renderTransportStep() {
    if (isSaResponderFlow) {
      const isTransfer =
        form.patientFor === "Referral or Transfer to Health Facility";
      const isRelease = form.patientFor === "Release";

      return (
        <>
          <SelectField
            label="PATIENT FOR"
            value={form.patientFor}
            placeholder="Pending departure, release, or referral/transfer"
            onPress={() => openChoiceSheet("patientFor")}
          />

          {isTransfer ? (
            <>
              <SelectField
                label="CONDITION BEFORE TRANSFER"
                value={form.conditionBeforeTransfer}
                placeholder="Alive or Dead"
                onPress={() =>
                  openChoiceSheet("conditionBeforeTransfer")
                }
              />

              {form.conditionBeforeTransfer === "Dead" ? (
                <View style={styles.conditionalChildGroup}>
                  <SelectField
                    label="MEDICAL CONTACT"
                    value={form.transferMedicalContact}
                    placeholder="With or without medical contact"
                    onPress={() =>
                      openChoiceSheet("transferMedicalContact")
                    }
                  />
                </View>
              ) : null}

              <SelectField
                label="PRECAUTION"
                value={form.transferPrecaution}
                placeholder="Select precaution"
                onPress={() => openChoiceSheet("transferPrecaution")}
              />

              <SelectField
                label="RECEIVING FACILITY"
                value={form.healthcareFacility}
                placeholder={
                  isLoadingHealthcareFacilities
                    ? "Loading hospitals..."
                    : "Select receiving hospital"
                }
                onPress={() =>
                  openChoiceSheet("healthcareFacility")
                }
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

              <SelectField
                label="USED EMS VEHICLE?"
                value={form.usedEmsVehicle}
                placeholder="Yes or No"
                onPress={() => openChoiceSheet("usedEmsVehicle")}
              />

              {form.usedEmsVehicle === "Yes" ? (
                <View style={styles.conditionalChildGroup}>
                  <SelectField
                    label="TYPE OF EMS VEHICLE"
                    value={form.emsVehicleType}
                    placeholder="BLS or ALS"
                    onPress={() => openChoiceSheet("emsVehicleType")}
                  />
                </View>
              ) : null}

              <FormField
                label="VEHICLE MAKE, MODEL, AND PLATE NUMBER"
                value={form.vehicleMakeModelPlate}
                placeholder="e.g. Toyota Hiace ABC 1234"
                onChangeText={(value) =>
                  updateField("vehicleMakeModelPlate", value)
                }
              />

              <CurrentTimeField
                label="DEPARTED SCENE TIME"
                value={form.departedSceneTime}
                placeholder="mm/dd/yyyy hh:mm"
                icon="exit-outline"
                buttonLabel="Use current departure time"
                onChangeText={(value) =>
                  updateField("departedSceneTime", value)
                }
                onUseCurrent={() =>
                  updateField(
                    "departedSceneTime",
                    formatDateTimeForInput(new Date()),
                  )
                }
              />

              <CurrentTimeField
                label="ARRIVED FACILITY TIME"
                value={form.arrivedFacilityTime}
                placeholder="mm/dd/yyyy hh:mm"
                icon="enter-outline"
                buttonLabel="Use current arrival time"
                onChangeText={(value) =>
                  updateField("arrivedFacilityTime", value)
                }
                onUseCurrent={() =>
                  updateField(
                    "arrivedFacilityTime",
                    formatDateTimeForInput(new Date()),
                  )
                }
              />
            </>
          ) : null}

          {isRelease ? (
            <>
              <SelectField
                label="CONDITION BEFORE RELEASE"
                value={form.conditionBeforeRelease}
                placeholder="Alive or Dead"
                onPress={() =>
                  openChoiceSheet("conditionBeforeRelease")
                }
              />

              {form.conditionBeforeRelease === "Dead" ? (
                <View style={styles.conditionalChildGroup}>
                  <SelectField
                    label="MEDICAL CONTACT"
                    value={form.releaseMedicalContact}
                    placeholder="With or without medical contact"
                    onPress={() =>
                      openChoiceSheet("releaseMedicalContact")
                    }
                  />
                </View>
              ) : null}

              <CurrentTimeField
                label="DEPARTED SCENE TIME"
                value={form.departedSceneTime}
                placeholder="mm/dd/yyyy hh:mm AM/PM"
                icon="exit-outline"
                buttonLabel="Use current departure time"
                onChangeText={(value) =>
                  updateField("departedSceneTime", value)
                }
                onUseCurrent={() =>
                  updateField(
                    "departedSceneTime",
                    formatDateTimeForInput(new Date()),
                  )
                }
              />

              <View style={styles.releaseTextCard}>
                <Text style={styles.releaseTextTitle}>
                  Release of Liability
                </Text>
                <Text style={styles.releaseTextBody}>
                  {RELEASE_OF_LIABILITY_TEXT}
                </Text>
              </View>

              <SelectField
                label="RELEASE OF LIABILITY ACCEPTED?"
                value={form.releaseLiabilityAccepted}
                placeholder="Yes or No"
                onPress={() =>
                  openChoiceSheet("releaseLiabilityAccepted")
                }
              />
            </>
          ) : null}

          <FormField
            label="TRANSPORT / RELEASE NOTES"
            value={form.transportNotes}
            placeholder="Additional transfer or release notes"
            multiline
            onChangeText={(value) =>
              updateField("transportNotes", value)
            }
          />
        </>
      );
    }

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

        <CurrentTimeField
          label="EMS SCENE ARRIVAL TIME"
          value={form.arrivedSceneTime}
          placeholder="mm/dd/yyyy hh:mm"
          icon="car-outline"
          buttonLabel="Use current EMS arrival time"
          onChangeText={(value) =>
            updateField("arrivedSceneTime", value)
          }
          onUseCurrent={() =>
            updateField(
              "arrivedSceneTime",
              formatDateTimeForInput(new Date()),
            )
          }
        />

        <CurrentTimeField
          label="DEPARTED SCENE TIME"
          value={form.departedSceneTime}
          placeholder="mm/dd/yyyy hh:mm"
          icon="exit-outline"
          buttonLabel="Use current departure time"
          onChangeText={(value) =>
            updateField("departedSceneTime", value)
          }
          onUseCurrent={() =>
            updateField(
              "departedSceneTime",
              formatDateTimeForInput(new Date()),
            )
          }
        />

        <CurrentTimeField
          label="ARRIVED FACILITY TIME"
          value={form.arrivedFacilityTime}
          placeholder="mm/dd/yyyy hh:mm"
          icon="enter-outline"
          buttonLabel="Use current arrival time"
          onChangeText={(value) =>
            updateField("arrivedFacilityTime", value)
          }
          onUseCurrent={() =>
            updateField(
              "arrivedFacilityTime",
              formatDateTimeForInput(new Date()),
            )
          }
        />

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
            <Pressable
              onPress={() =>
                setIsHealthcareQuickCreateExpanded(
                  (current) => !current,
                )
              }
              style={({ pressed }) => [
                styles.quickCreateHeader,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Toggle quick create healthcare facility"
            >
              <View style={styles.quickCreateHeaderTitle}>
                <Ionicons
                  name="medkit-outline"
                  size={20}
                  color={COLORS.maroon}
                />
                <Text style={styles.quickCreateTitle}>
                  Quick create healthcare facility
                </Text>
              </View>

              <Ionicons
                name={
                  isHealthcareQuickCreateExpanded
                    ? "chevron-up-outline"
                    : "chevron-down-outline"
                }
                size={18}
                color={COLORS.secondaryText}
              />
            </Pressable>

            {isHealthcareQuickCreateExpanded ? (
              <View style={styles.quickCreateBody}>
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
    if (isFieldResponderFlow) {
      return (
        <>
          <FormField
            label="NOTES"
            value={form.remarks}
            placeholder="Add status notes"
            multiline
            onChangeText={(value) =>
              updateField("remarks", value)
            }
          />

          <Pressable
            onPress={() =>
              updateField(
                "victimCodeMarked",
                form.victimCodeMarked === "Yes" ? "" : "Yes",
              )
            }
            style={({ pressed }) => [
              styles.confirmationCheckbox,
              form.victimCodeMarked === "Yes" &&
                styles.confirmationCheckboxSelected,
              pressed && styles.pressed,
            ]}
            accessibilityRole="checkbox"
            accessibilityState={{
              checked: form.victimCodeMarked === "Yes",
            }}
          >
            <Ionicons
              name={
                form.victimCodeMarked === "Yes"
                  ? "checkbox"
                  : "square-outline"
              }
              size={22}
              color={
                form.victimCodeMarked === "Yes"
                  ? COLORS.maroon
                  : COLORS.secondaryText
              }
            />
            <Text style={styles.confirmationCheckboxText}>
              Did you mark your victims with their victim code including your own user code?
            </Text>
          </Pressable>
        </>
      );
    }

    return (
      <>
        <SectionLabel title="Clinical status" />

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

        <SelectField
          label="ON-SITE STABILIZATION / TREATMENT"
          value={form.treatmentStrategy}
          placeholder="Select treatment type"
          onPress={() => openChoiceSheet("treatmentStrategy")}
        />

        <SectionLabel title="On-site care" />

        <FormField
          label="TREATMENT AREA"
          value={form.treatmentAreaName}
          placeholder="Treatment area name"
          onChangeText={(value) =>
            updateField("treatmentAreaName", value)
          }
        />

        <CurrentTimeField
          label="STABILIZATION START TIME"
          value={form.stabilizationStartedTime}
          placeholder="mm/dd/yyyy hh:mm"
          buttonLabel="Use current care start time"
          onChangeText={(value) =>
            updateField("stabilizationStartedTime", value)
          }
          onUseCurrent={() =>
            updateField(
              "stabilizationStartedTime",
              formatDateTimeForInput(new Date()),
            )
          }
        />

        <CurrentTimeField
          label="STABILIZED TIME"
          value={form.stabilizedTime}
          placeholder="mm/dd/yyyy hh:mm"
          icon="checkmark-circle-outline"
          buttonLabel="Use current stabilized time"
          onChangeText={(value) =>
            updateField("stabilizedTime", value)
          }
          onUseCurrent={() =>
            updateField(
              "stabilizedTime",
              formatDateTimeForInput(new Date()),
            )
          }
        />

        <FormField
          label="TREATMENT NOTES"
          value={form.treatmentNotes}
          placeholder="On-site treatment or stabilization details"
          multiline
          onChangeText={(value) =>
            updateField("treatmentNotes", value)
          }
        />

        <SectionLabel title="Clinical notes" />

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

  function renderSaTreatmentStep() {
    const showPcr = form.fillPatientCareReport === "Yes";

    return (
      <>
        <SelectField
          label="TREATMENT"
          value={form.treatmentStrategy}
          placeholder="Select treatment type"
          onPress={() => openChoiceSheet("treatmentStrategy")}
        />

        <CurrentTimeField
          label="STABILIZED TIME"
          value={form.stabilizedTime}
          placeholder="mm/dd/yyyy hh:mm"
          icon="checkmark-circle-outline"
          buttonLabel="Use current stabilized time"
          onChangeText={(value) =>
            updateField("stabilizedTime", value)
          }
          onUseCurrent={() =>
            updateField(
              "stabilizedTime",
              formatDateTimeForInput(new Date()),
            )
          }
        />

        <SelectField
          label="FILL IN PATIENT CARE REPORT?"
          value={form.fillPatientCareReport}
          placeholder="Yes or No"
          onPress={() => openChoiceSheet("fillPatientCareReport")}
        />

        {showPcr ? (
          <>
            <SectionLabel title="PCR Patient Assessment" />

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
              placeholder="Patient assessment findings"
              multiline
              onChangeText={(value) =>
                updateField("medicalCondition", value)
              }
            />

            <FormField
              label="ASSISTANCE PROVIDED"
              value={form.assistanceProvided}
              placeholder="Care rendered"
              multiline
              onChangeText={(value) =>
                updateField("assistanceProvided", value)
              }
            />
          </>
        ) : null}

        <FormField
          label="TREATMENT NOTES"
          value={form.treatmentNotes}
          placeholder="Treatment observations"
          multiline
          onChangeText={(value) =>
            updateField("treatmentNotes", value)
          }
        />
      </>
    );
  }

  function renderHospitalCareStep() {
    const showDeathDetails = normalizeYesNoUnknown(form.died) === true;

    return (
      <>
        <SectionLabel title="ED and hospital care" />

        <FormField
          label="HOSPITAL / FACILITY"
          value={form.hospitalName}
          placeholder="Hospital or medical facility"
          onChangeText={(value) =>
            updateField("hospitalName", value)
          }
        />

        <SelectField
          label="ED / SIMILAR FACILITY CARE"
          value={form.soughtEdCare}
          placeholder="Select ED care use"
          onPress={() => openChoiceSheet("soughtEdCare")}
        />

        <SelectField
          label="ADMITTED AFTER ED / SIMILAR CARE"
          value={form.admittedAfterEd}
          placeholder="Select admission status"
          onPress={() => openChoiceSheet("admittedAfterEd")}
        />

        <SelectField
          label="DISCHARGED HOME AFTER ED / SIMILAR CARE"
          value={form.dischargedAfterEd}
          placeholder="Select discharge status"
          onPress={() => openChoiceSheet("dischargedAfterEd")}
        />

        <FormField
          label="ED ADMISSION TIME"
          value={form.edAdmissionTime}
          placeholder="mm/dd/yyyy hh:mm"
          onChangeText={(value) =>
            updateField("edAdmissionTime", value)
          }
        />

        <FormField
          label="ED TRANSFER OUT TIME"
          value={form.edTransferOutTime}
          placeholder="mm/dd/yyyy hh:mm"
          onChangeText={(value) =>
            updateField("edTransferOutTime", value)
          }
        />

        <CurrentTimeField
          label="ED RESUSCITATION ROOM TIME"
          value={form.edResuscitationTime}
          placeholder="mm/dd/yyyy hh:mm"
          icon="medical-outline"
          buttonLabel="Use current ED resuscitation time"
          onChangeText={(value) =>
            updateField("edResuscitationTime", value)
          }
          onUseCurrent={() =>
            updateField(
              "edResuscitationTime",
              formatDateTimeForInput(new Date()),
            )
          }
        />

        <FormField
          label="HOSPITAL ADMISSION TIME"
          value={form.hospitalAdmissionTime}
          placeholder="mm/dd/yyyy hh:mm"
          onChangeText={(value) =>
            updateField("hospitalAdmissionTime", value)
          }
        />

        <FormField
          label="HOSPITAL DISCHARGE TIME"
          value={form.hospitalDischargeTime}
          placeholder="mm/dd/yyyy hh:mm"
          onChangeText={(value) =>
            updateField("hospitalDischargeTime", value)
          }
        />

        <SectionLabel title="Surgery and imaging" />

        <FormField
          label="SURGICAL INTERVENTION START TIME"
          value={form.surgicalInterventionStartTime}
          placeholder="mm/dd/yyyy hh:mm"
          onChangeText={(value) =>
            updateField("surgicalInterventionStartTime", value)
          }
        />

        <FormField
          label="SURGICAL INTERVENTION END TIME"
          value={form.surgicalInterventionEndTime}
          placeholder="mm/dd/yyyy hh:mm"
          onChangeText={(value) =>
            updateField("surgicalInterventionEndTime", value)
          }
        />

        <FormField
          label="OPERATING ROOM USE TIME"
          value={form.operatingRoomTime}
          placeholder="mm/dd/yyyy hh:mm"
          onChangeText={(value) =>
            updateField("operatingRoomTime", value)
          }
        />

        <SelectField
          label="PLAIN X-RAY REQUIRED"
          value={form.xrayRequired}
          placeholder="Select X-ray status"
          onPress={() => openChoiceSheet("xrayRequired")}
        />

        <FormField
          label="PLAIN X-RAY TIME"
          value={form.xrayTime}
          placeholder="mm/dd/yyyy hh:mm"
          onChangeText={(value) => updateField("xrayTime", value)}
        />

        <SelectField
          label="ULTRASOUND REQUIRED"
          value={form.ultrasoundRequired}
          placeholder="Select ultrasound status"
          onPress={() => openChoiceSheet("ultrasoundRequired")}
        />

        <FormField
          label="ULTRASOUND TIME"
          value={form.ultrasoundTime}
          placeholder="mm/dd/yyyy hh:mm"
          onChangeText={(value) =>
            updateField("ultrasoundTime", value)
          }
        />

        <SelectField
          label="CT SCAN REQUIRED"
          value={form.ctRequired}
          placeholder="Select CT scan status"
          onPress={() => openChoiceSheet("ctRequired")}
        />

        <FormField
          label="CT SCAN TIME"
          value={form.ctTime}
          placeholder="mm/dd/yyyy hh:mm"
          onChangeText={(value) => updateField("ctTime", value)}
        />

        <SectionLabel title="ICU and ventilation" />

        <FormField
          label="ICU ADMISSION TIME"
          value={form.icuAdmissionTime}
          placeholder="mm/dd/yyyy hh:mm"
          onChangeText={(value) =>
            updateField("icuAdmissionTime", value)
          }
        />

        <FormField
          label="ICU TRANSFER OUT TIME"
          value={form.icuTransferOutTime}
          placeholder="mm/dd/yyyy hh:mm"
          onChangeText={(value) =>
            updateField("icuTransferOutTime", value)
          }
        />

        <SelectField
          label="MECHANICAL VENTILATION REQUIRED"
          value={form.mechanicalVentilationRequired}
          placeholder="Select ventilation status"
          onPress={() =>
            openChoiceSheet("mechanicalVentilationRequired")
          }
        />

        <FormField
          label="VENTILATION START TIME"
          value={form.ventilationStartTime}
          placeholder="mm/dd/yyyy hh:mm"
          onChangeText={(value) =>
            updateField("ventilationStartTime", value)
          }
        />

        <FormField
          label="VENTILATION END TIME"
          value={form.ventilationEndTime}
          placeholder="mm/dd/yyyy hh:mm"
          onChangeText={(value) =>
            updateField("ventilationEndTime", value)
          }
        />

        <SelectField
          label="ALTERNATIVE ICU USE"
          value={form.alternativeIcuUsed}
          placeholder="Select alternative ICU use"
          onPress={() => openChoiceSheet("alternativeIcuUsed")}
        />

        <SelectField
          label="TRANSFERRED OUT OF HOSPITAL"
          value={form.transferredOutOfHospital}
          placeholder="Select transfer status"
          onPress={() =>
            openChoiceSheet("transferredOutOfHospital")
          }
        />

        <SectionLabel title="Outcome" />

        <SelectField
          label="DIED"
          value={form.died}
          placeholder="Select death status"
          onPress={() => openChoiceSheet("died")}
        />

        {showDeathDetails ? (
          <>
            <SelectField
              label="DEATH STAGE"
              value={form.deathStage}
              placeholder="Select death stage"
              onPress={() => openChoiceSheet("deathStage")}
            />

            <FormField
              label="DEATH TIME"
              value={form.deathTime}
              placeholder="mm/dd/yyyy hh:mm"
              onChangeText={(value) => updateField("deathTime", value)}
            />

            <SelectField
              label="REACHED HOSPITAL"
              value={form.reachedHospital}
              placeholder="Select reached hospital status"
              onPress={() => openChoiceSheet("reachedHospital")}
            />

            <SelectField
              label="MEDICAL CONTACT BEFORE DEATH"
              value={form.medicalContactBeforeDeath}
              placeholder="Select medical contact status"
              onPress={() =>
                openChoiceSheet("medicalContactBeforeDeath")
              }
            />

            <SelectField
              label="FINAL DISPOSITION"
              value={form.finalDisposition}
              placeholder="Select final disposition"
              onPress={() => openChoiceSheet("finalDisposition")}
            />
          </>
        ) : null}

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
      case "Safety":
        return renderResponderSafetyStep();

      case "Intro":
        return renderSaIntroStep();

      case "Info":
        return renderSaInfoStep();

      case "General Information":
        return renderHealthcareDocumenterGeneralStep();

      case "Patient Information":
        return renderHealthcareDocumenterPatientStep();

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

      case "Treatment":
        return renderSaTreatmentStep();

      case "Management":
        return renderHealthcareDocumenterManagementStep();

      case "Disposition":
        return renderHealthcareDocumenterDispositionStep();

      case "Hospital Care":
        return renderHospitalCareStep();

      case "Remarks":
        return renderRemarksStep();
    }
  }

  if (isLoadingRecord || isLoadingUserContext) {
    return (
      <View style={styles.centerState}>
        <ActivityIndicator
          size="large"
          color={COLORS.maroon}
        />

        <Text style={styles.centerStateText}>
          {isLoadingRecord
            ? "Loading casualty record..."
            : "Loading responder profile..."}
        </Text>
      </View>
    );
  }

  if (needsResponderFunctionSelection) {
    return (
      <View style={styles.centerState}>
        <Ionicons
          name="person-circle-outline"
          size={48}
          color={COLORS.maroon}
        />

        <Text style={styles.centerStateTitle}>
          Please Select Responder Function to continue
        </Text>

        <Text style={styles.centerStateText}>
          Choose Field Responder or Stabilization Area Responder in Profile before adding a casualty.
        </Text>

        <Pressable
          onPress={() => router.replace("/profile")}
          style={({ pressed }) => [
            styles.centerStateButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.centerStateButtonText}>
            Open Profile
          </Text>
        </Pressable>
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
              onPress={confirmExitAddCasualty}
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
              Step {currentStep + 1} of {activeSteps.length} -{" "}
              {stepName}
            </Text>
          </View>

          <View style={styles.progressRow}>
            {activeSteps.map((step, index) => {
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
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={[
                      styles.progressLabel,
                      isActive && styles.progressLabelActive,
                    ]}
                  >
                    {STEP_PROGRESS_LABELS[step]}
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
        {responderFunctionLabel ? (
          <View style={styles.responderFunctionStickyHeader}>
            <View style={styles.responderFunctionIcon}>
              <Ionicons
                name="shield-checkmark-outline"
                size={18}
                color={COLORS.maroon}
              />
            </View>
            <View style={styles.responderFunctionTextGroup}>
              <Text style={styles.responderFunctionLabel}>
                RESPONDER FUNCTION
              </Text>
              <Text style={styles.responderFunctionValue}>
                {responderFunctionLabel}
              </Text>
            </View>
          </View>
        ) : null}

        {showVictimNumberStickyHeader ? (
          <View style={styles.victimNumberStickyHeader}>
            <Text style={styles.victimNumberStickyLabel}>
              CURRENT VICTIM NUMBER
            </Text>
            <Text style={styles.victimNumberStickyValue}>
              {stickyVictimNumber}
            </Text>
          </View>
        ) : null}

        <ScrollView
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {isResponderEditLockedStep ? (
            <View style={styles.inlineWarning}>
              <Ionicons
                name="lock-closed-outline"
                size={18}
                color={COLORS.maroon}
              />
              <Text style={styles.inlineWarningText}>
                Filled responder fields are locked while editing. Use the Transport section for updates.
              </Text>
            </View>
          ) : null}

          <View
            style={
              isResponderEditLockedStep
                ? styles.lockedStepContent
                : undefined
            }
            pointerEvents={isResponderEditLockedStep ? "none" : "auto"}
          >
            {renderCurrentStep()}
          </View>
        </ScrollView>

        <SafeAreaView
          edges={["bottom"]}
          style={styles.footerSafeArea}
        >
          <View style={styles.footer}>
            {currentStep > 0 ? (
              <Pressable
                onPress={goPreviousStep}
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
                {currentStep === activeSteps.length - 1
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
                    currentStep === activeSteps.length - 1
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

      <Modal
  visible={isExitConfirmVisible}
  transparent
  animationType="fade"
  onRequestClose={() =>
    setIsExitConfirmVisible(false)
  }
>
  <View style={styles.feedbackBackdrop}>
    <View style={styles.feedbackCard}>
      <View style={styles.exitConfirmIcon}>
        <Ionicons
          name="exit-outline"
          size={30}
          color={COLORS.white}
        />
      </View>

      <Text style={styles.feedbackTitle}>
        {isEditing
          ? "Exit Edit Casualty?"
          : "Exit Add Casualty?"}
      </Text>

      <Text style={styles.feedbackMessage}>
        {isEditing
          ? "Any unsaved changes will be lost. Are you sure you want to exit?"
          : "Any information you entered but have not submitted will be lost. Are you sure you want to exit?"}
      </Text>

      <View style={styles.exitConfirmActions}>
        <Pressable
          onPress={() =>
            setIsExitConfirmVisible(false)
          }
          style={({ pressed }) => [
            styles.exitCancelButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.exitCancelButtonText}>
            Cancel
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            setIsExitConfirmVisible(false);
            router.back();
          }}
          style={({ pressed }) => [
            styles.exitButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="exit-outline"
            size={18}
            color={COLORS.white}
          />

          <Text style={styles.exitButtonText}>
            Exit
          </Text>
        </Pressable>
      </View>
    </View>
  </View>
</Modal>

      <ChoiceSheet
        visible={activeChoiceSheet !== null}
        title={getChoiceSheetTitle()}
        options={getChoiceOptions()}
        searchQuery={choiceSearchQuery}
        searchable={isActiveChoiceSheetSearchable()}
        onSearchChange={setChoiceSearchQuery}
        onClose={() => setActiveChoiceSheet(null)}
      />

      {renderTriageAssessmentSheet()}

      <DatePickerSheet
        visible={isDatePickerVisible}
        value={form.dateOfBirth}
        onSelect={(value) => updateField("dateOfBirth", value)}
        onClose={() => setIsDatePickerVisible(false)}
      />

      <Modal
        visible={submissionFeedback !== null}
        transparent
        animationType="fade"
        onRequestClose={closeSubmissionFeedback}
      >
        <View style={styles.feedbackBackdrop}>
          <View style={styles.feedbackCard}>
            <View style={styles.feedbackIcon}>
              <Ionicons
                name="checkmark-circle-outline"
                size={30}
                color={COLORS.white}
              />
            </View>

            <Text style={styles.feedbackTitle}>
              {submissionFeedback?.title}
            </Text>
            <Text style={styles.feedbackMessage}>
              {submissionFeedback?.message}
            </Text>

            <Pressable
              onPress={closeSubmissionFeedback}
              style={({ pressed }) => [
                styles.feedbackButton,
                pressed && styles.primaryButtonPressed,
              ]}
            >
              <Text style={styles.feedbackButtonText}>OK</Text>
            </Pressable>
          </View>
        </View>
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
  assessmentSheet: {
    maxHeight: "82%",
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
  assessmentSubtitle: {
    color: COLORS.secondaryText,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },
  sheetCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.fieldBackground,
  },
  feedbackBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "rgba(23,33,58,0.42)",
  },
  feedbackCard: {
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 20,
    borderRadius: 18,
    backgroundColor: COLORS.white,
  },
  feedbackIcon: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: COLORS.green,
    marginBottom: 14,
  },
  feedbackTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },
  feedbackMessage: {
    color: COLORS.secondaryText,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 8,
  },
  feedbackButton: {
    width: "100%",
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: COLORS.maroon,
    marginTop: 20,
  },
  feedbackButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  exitConfirmIcon: {
  width: 56,
  height: 56,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 18,
  backgroundColor: COLORS.maroon,
  marginBottom: 14,
},

exitConfirmActions: {
  width: "100%",
  flexDirection: "row",
  gap: 10,
  marginTop: 20,
},

exitCancelButton: {
  flex: 1,
  minHeight: 46,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 12,
  borderWidth: 1,
  borderColor: COLORS.fieldBorder,
  backgroundColor: COLORS.white,
},

exitCancelButtonText: {
  color: COLORS.text,
  fontSize: 13,
  fontWeight: "900",
},

exitButton: {
  flex: 1,
  minHeight: 46,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 12,
  backgroundColor: COLORS.maroon,
  gap: 7,
},

exitButtonText: {
  color: COLORS.white,
  fontSize: 13,
  fontWeight: "900",
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
    textAlign: "center",
  },
  dateTitleButton: {
    flex: 1,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingHorizontal: 8,
  },
  dateTitleHint: {
    color: COLORS.secondaryText,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
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
  yearGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  yearCell: {
    width: "31.5%",
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.fieldBorder,
    backgroundColor: COLORS.fieldBackground,
  },
  yearCellSelected: {
    borderColor: COLORS.maroon,
    backgroundColor: "#FFF4F4",
  },
  yearText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800",
  },
  yearTextSelected: {
    color: COLORS.maroon,
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
    minWidth: 0,
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
    fontSize: 7,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 6,
  },
  progressLabelActive: {
    color: COLORS.white,
  },

  triageAssessmentColoredSelect: {
    borderColor: "rgba(255,255,255,0.72)",
  },

  formContent: {
    paddingHorizontal: 14,
    paddingTop: 23,
    paddingBottom: 30,
  },
  responderFunctionStickyHeader: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 58,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E8D4D6",
    backgroundColor: COLORS.white,
    gap: 10,
  },
  responderFunctionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF0F0",
  },
  responderFunctionTextGroup: {
    flex: 1,
    minWidth: 0,
  },
  responderFunctionLabel: {
    color: COLORS.secondaryText,
    fontSize: 10,
    fontWeight: "800",
  },
  responderFunctionValue: {
    color: COLORS.maroon,
    fontSize: 15,
    fontWeight: "900",
    marginTop: 2,
  },
  victimNumberStickyHeader: {
    borderBottomWidth: 1,
    borderBottomColor: "#E8D4D6",
    backgroundColor: "#FFF8F8",
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  victimNumberStickyLabel: {
    color: COLORS.secondaryText,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  victimNumberStickyValue: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "900",
    marginTop: 2,
  },
  fieldGroup: {
    marginBottom: 17,
  },
  selectedIncidentBanner: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E8D4D6",
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 17,
    backgroundColor: "#FFF8F8",
    gap: 10,
  },
  selectedIncidentIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
  },
  selectedIncidentTextGroup: {
    flex: 1,
    minWidth: 0,
  },
  selectedIncidentLabel: {
    color: COLORS.maroon,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  selectedIncidentName: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
    marginTop: 3,
  },
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 7,
    marginBottom: 15,
  },
  sectionLabelRule: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.fieldBorder,
  },
  sectionLabelText: {
    color: COLORS.maroon,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
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
  currentTimeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  currentTimeField: {
    flex: 1,
  },
  currentTimeButton: {
    width: 148,
    minHeight: 50,
    marginTop: 22,
    paddingHorizontal: 8,
    gap: 6,
  },
  currentTimeButtonText: {
    flexShrink: 1,
    fontSize: 11,
    lineHeight: 14,
    textAlign: "center",
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

  appendixBlock: {
    borderWidth: 1,
    borderColor: COLORS.fieldBorder,
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 4,
    marginBottom: 17,
    backgroundColor: COLORS.white,
  },
  appendixHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 7,
  },
  appendixTitle: {
    color: COLORS.maroon,
    fontSize: 13,
    fontWeight: "900",
  },
  appendixQuestion: {
    marginBottom: 12,
  },
  assessmentList: {
    paddingTop: 4,
    paddingBottom: 10,
  },
  assessmentDoneButton: {
    minHeight: 47,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: COLORS.maroon,
  },
  assessmentDoneButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  appendixQuestionLabel: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 7,
  },
  appendixQuestionHint: {
    color: COLORS.secondaryText,
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 8,
  },
  appendixOptionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  appendixOption: {
    minHeight: 38,
    minWidth: "30%",
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    borderWidth: 1,
    borderColor: COLORS.fieldBorder,
    backgroundColor: COLORS.fieldBackground,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  finalTriageOption: {
    flexBasis: "48%",
    flexGrow: 0,
    minWidth: "48%",
    borderColor: "rgba(255,255,255,0.72)",
  },
  finalTriageOptionInactive: {
    opacity: 0.4,
  },
  appendixOptionSelected: {
    borderColor: COLORS.maroon,
    backgroundColor: "#FFF4F4",
  },
  finalTriageOptionSelected: {
    borderWidth: 2,
    borderColor: COLORS.text,
  },
  finalTriageGreen: {
    backgroundColor: "#2E7D4F",
  },
  finalTriageYellow: {
    backgroundColor: "#F4C542",
  },
  finalTriageOrange: {
    backgroundColor: "#F39C12",
  },
  finalTriageRed: {
    backgroundColor: "#C62828",
  },
  finalTriageBlack: {
    backgroundColor: "#1F2933",
  },
  finalTriageBlue: {
    backgroundColor: "#1D4ED8",
  },
  finalTriageWhite: {
    borderColor: COLORS.fieldBorder,
    backgroundColor: COLORS.white,
  },
  appendixNumericInput: {
    minHeight: 42,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: COLORS.fieldBorder,
    backgroundColor: COLORS.fieldBackground,
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "800",
    paddingHorizontal: 12,
  },
  appendixOptionText: {
    color: COLORS.text,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  appendixOptionTextSelected: {
    color: COLORS.maroon,
  },
  finalTriageLightText: {
    color: COLORS.white,
  },
  finalTriageYellowText: {
    color: "#2B2100",
  },

  safetyPromptCard: {
    borderWidth: 1,
    borderColor: COLORS.fieldBorder,
    borderRadius: 13,
    backgroundColor: COLORS.fieldBackground,
    padding: 13,
    marginBottom: 14,
  },

  safetyPromptTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 10,
  },

  safetyOptionsRow: {
    flexDirection: "row",
    gap: 10,
  },

  safetyOption: {
    minHeight: 44,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.fieldBorder,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    gap: 7,
  },

  safetyOptionSelected: {
    borderColor: COLORS.maroon,
    backgroundColor: COLORS.maroon,
  },

  safetyOptionDisabled: {
    opacity: 0.65,
  },

  safetyOptionText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "900",
  },

  safetyOptionTextSelected: {
    color: COLORS.white,
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
  inlineSuccess: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BFE9CD",
    backgroundColor: "#EFFAF3",
    marginTop: -5,
    marginBottom: 17,
    gap: 8,
  },
  inlineSuccessText: {
    flex: 1,
    color: COLORS.secondaryText,
    fontSize: 11,
    lineHeight: 16,
  },
  confirmationCheckbox: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.fieldBorder,
    backgroundColor: COLORS.fieldBackground,
    marginBottom: 17,
    gap: 10,
  },
  confirmationCheckboxSelected: {
    borderColor: "#D5A0A3",
    backgroundColor: "#FFF5F5",
  },
  confirmationCheckboxText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
  },
  lockedStepContent: {
    opacity: 0.55,
  },

  quickCreateCard: {
    borderWidth: 1,
    borderColor: "#E8D4D6",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 17,
    backgroundColor: "#FFF9F9",
  },
  quickCreateHeader: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  quickCreateHeaderTitle: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  quickCreateTitle: {
    flex: 1,
    color: COLORS.maroon,
    fontSize: 13,
    fontWeight: "900",
  },
  quickCreateBody: {
    marginTop: 13,
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
  conditionalChildGroup: {
    borderLeftWidth: 3,
    borderLeftColor: "#E8D4D6",
    paddingLeft: 12,
    marginLeft: 6,
    marginBottom: 14,
  },
  conditionalGrandchildGroup: {
    borderLeftWidth: 3,
    borderLeftColor: "#F0C9CD",
    paddingLeft: 12,
    marginLeft: 8,
    marginBottom: 10,
  },
  releaseTextCard: {
    borderWidth: 1,
    borderColor: "#E8D4D6",
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 12,
    backgroundColor: "#FFF9F9",
    marginBottom: 14,
  },
  releaseTextTitle: {
    color: COLORS.maroon,
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  releaseTextBody: {
    color: COLORS.secondaryText,
    fontSize: 12,
    lineHeight: 18,
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
