export type MortalityOutcome = {
  reached_hospital: boolean | null;
  medical_contact_before_death: boolean | null;
  death_stage: string | null;
};

export type MortalityFacilityEncounter = {
  arrived_at?: string | null;
  hospital_admitted_at?: string | null;
  disposition?: string | null;
};

export type MortalityCategory =
  | "impact"
  | "prehospital"
  | "in_hospital"
  | null;

/**
 * Classifies a death into one Utstein category without double-counting it.
 * Explicit medical-contact and hospital-arrival values take precedence over
 * the legacy death_stage value so contradictory saved rows remain exclusive.
 */
export function classifyMortalityOutcome(
  outcome: MortalityOutcome | null | undefined,
  facilityEncounter?: MortalityFacilityEncounter | null,
): MortalityCategory {
  // HCFD records can establish an in-hospital death through the facility
  // encounter even when the separate casualty outcome row is incomplete.
  if (
    facilityEncounter?.disposition === "deceased" ||
    Boolean(facilityEncounter?.hospital_admitted_at)
  ) {
    return "in_hospital";
  }

  if (!outcome) {
    return null;
  }

  if (outcome.medical_contact_before_death === false) {
    return "impact";
  }

  if (outcome.reached_hospital === true) {
    return "in_hospital";
  }

  if (
    outcome.medical_contact_before_death === true &&
    outcome.reached_hospital === false
  ) {
    return "prehospital";
  }

  if (outcome.death_stage === "impact") {
    return "impact";
  }

  if (
    outcome.death_stage === "prehospital" &&
    outcome.medical_contact_before_death === true
  ) {
    return "prehospital";
  }

  if (
    outcome.death_stage === "in_hospital" &&
    outcome.reached_hospital !== false
  ) {
    return "in_hospital";
  }

  return null;
}
