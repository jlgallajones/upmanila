import type { NextFunction, Request, Response } from "express";

import { supabase } from "../config/supabase.js";
import type { CreateCasualtyRequest } from "../types/casualty.types.js";

const casualtyStatuses = [
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

const casualtySeverities = [
  "none",
  "minor",
  "moderate",
  "severe",
  "critical",
];

const identificationStatuses = [
  "identified",
  "partially_identified",
  "unidentified",
];

export async function createCasualty(
  request: Request<
    Record<string, never>,
    unknown,
    CreateCasualtyRequest
  >,
  response: Response,
  next: NextFunction,
): Promise<void> {
  let createdCasualtyId: string | null = null;

  try {
    const {
      clientRecordId,
      incidentId,
      encodedBy,
      person,
      incidentDetails,
    } = request.body;

    if (!clientRecordId || !incidentId || !encodedBy) {
      response.status(400).json({
        success: false,
        message:
          "clientRecordId, incidentId, and encodedBy are required.",
      });
      return;
    }

    if (!person || !incidentDetails) {
      response.status(400).json({
        success: false,
        message: "person and incidentDetails are required.",
      });
      return;
    }

    if (
      !identificationStatuses.includes(
        person.identificationStatus,
      )
    ) {
      response.status(400).json({
        success: false,
        message: "Invalid identification status.",
      });
      return;
    }

    if (
      person.identificationStatus === "identified" &&
      !person.firstName?.trim() &&
      !person.lastName?.trim()
    ) {
      response.status(400).json({
        success: false,
        message:
          "An identified person must have a first name or last name.",
      });
      return;
    }

    if (
      person.estimatedAge !== undefined &&
      (
        !Number.isInteger(person.estimatedAge) ||
        person.estimatedAge < 0 ||
        person.estimatedAge > 130
      )
    ) {
      response.status(400).json({
        success: false,
        message: "Estimated age must be from 0 to 130.",
      });
      return;
    }

    if (
      !casualtyStatuses.includes(
        incidentDetails.currentStatus,
      )
    ) {
      response.status(400).json({
        success: false,
        message: "Invalid casualty status.",
      });
      return;
    }

    const severity = incidentDetails.severity ?? "none";

    if (!casualtySeverities.includes(severity)) {
      response.status(400).json({
        success: false,
        message: "Invalid casualty severity.",
      });
      return;
    }

    if (
      incidentDetails.latitude !== undefined &&
      (
        incidentDetails.latitude < -90 ||
        incidentDetails.latitude > 90
      )
    ) {
      response.status(400).json({
        success: false,
        message: "Latitude must be from -90 to 90.",
      });
      return;
    }

    if (
      incidentDetails.longitude !== undefined &&
      (
        incidentDetails.longitude < -180 ||
        incidentDetails.longitude > 180
      )
    ) {
      response.status(400).json({
        success: false,
        message: "Longitude must be from -180 to 180.",
      });
      return;
    }

    /*
     * Prevent the same offline record from being uploaded twice.
     */
    const { data: existingSubmission, error: duplicateError } =
      await supabase
        .from("casualty_incidents")
        .select("id, casualty_id, incident_id")
        .eq("client_record_id", clientRecordId)
        .maybeSingle();

    if (duplicateError) {
      throw new Error(
        `Unable to check duplicate submission: ${duplicateError.message}`,
      );
    }

    if (existingSubmission) {
      response.status(409).json({
        success: false,
        message: "This mobile record has already been synchronized.",
        data: existingSubmission,
      });
      return;
    }

    /*
     * Confirm that the selected disaster exists and is active.
     */
    const { data: incident, error: incidentError } =
      await supabase
        .from("incidents")
        .select("id, incident_code, incident_name, status")
        .eq("id", incidentId)
        .single();

    if (incidentError || !incident) {
      response.status(404).json({
        success: false,
        message: "Incident not found.",
      });
      return;
    }

    if (incident.status !== "active") {
      response.status(400).json({
        success: false,
        message:
          "Casualties can only be submitted to an active incident.",
      });
      return;
    }

    /*
     * Confirm that the encoder exists and is active.
     * Authentication middleware will replace this manual encodedBy
     * field later.
     */
    const { data: encoder, error: encoderError } =
      await supabase
        .from("users")
        .select("id, full_name, role, is_active")
        .eq("id", encodedBy)
        .single();

    if (encoderError || !encoder) {
      response.status(404).json({
        success: false,
        message: "Encoder account not found.",
      });
      return;
    }

    if (!encoder.is_active) {
      response.status(403).json({
        success: false,
        message: "The encoder account is inactive.",
      });
      return;
    }

    /*
     * Create the permanent person record.
     */
    const { data: casualty, error: casualtyError } =
      await supabase
        .from("casualties")
        .insert({
          id_number: person.idNumber?.trim() || null,
          id_type: person.idType?.trim() || null,

          identification_status:
            person.identificationStatus,

          first_name: person.firstName?.trim() || null,
          middle_name: person.middleName?.trim() || null,
          last_name: person.lastName?.trim() || null,
          suffix: person.suffix?.trim() || null,

          date_of_birth: person.dateOfBirth || null,
          estimated_age: person.estimatedAge ?? null,

          sex: person.sex?.trim() || null,
          civil_status: person.civilStatus?.trim() || null,
          nationality: person.nationality?.trim() || null,
          contact_number: person.contactNumber?.trim() || null,

          house_street: person.houseStreet?.trim() || null,
          barangay: person.barangay?.trim() || null,
          municipality: person.municipality?.trim() || null,
          province: person.province?.trim() || null,
          region: person.region?.trim() || null,
        })
        .select()
        .single();

    if (casualtyError || !casualty) {
      throw new Error(
        `Unable to create casualty: ${
          casualtyError?.message ?? "Unknown database error"
        }`,
      );
    }

    createdCasualtyId = casualty.id;

    /*
     * Connect the person to the selected disaster.
     */
    const { data: casualtyIncident, error: casualtyIncidentError } =
      await supabase
        .from("casualty_incidents")
        .insert({
          client_record_id: clientRecordId,
          casualty_id: casualty.id,
          incident_id: incidentId,

          evacuation_center_id:
            incidentDetails.evacuationCenterId || null,

          current_status: incidentDetails.currentStatus,
          severity,

          verification_status: "submitted",

          current_location:
            incidentDetails.currentLocation?.trim() || null,

          hospital_name:
            incidentDetails.hospitalName?.trim() || null,

          visible_injury:
            incidentDetails.visibleInjury?.trim() || null,

          medical_condition:
            incidentDetails.medicalCondition?.trim() || null,

          assistance_needed:
            incidentDetails.assistanceNeeded?.trim() || null,

          assistance_provided:
            incidentDetails.assistanceProvided?.trim() || null,

          remarks: incidentDetails.remarks?.trim() || null,

          encoded_by: encodedBy,

          reported_at:
            incidentDetails.reportedAt ??
            new Date().toISOString(),

          latitude: incidentDetails.latitude ?? null,
          longitude: incidentDetails.longitude ?? null,
        })
        .select()
        .single();

    if (casualtyIncidentError || !casualtyIncident) {
      /*
       * Remove the newly created person if linking it to the incident
       * fails. Later, this should be replaced with a PostgreSQL RPC
       * transaction.
       */
      await supabase
        .from("casualties")
        .delete()
        .eq("id", casualty.id);

      createdCasualtyId = null;

      throw new Error(
        `Unable to create casualty incident: ${
          casualtyIncidentError?.message ??
          "Unknown database error"
        }`,
      );
    }

    createdCasualtyId = null;

    response.status(201).json({
      success: true,
      message: "Casualty record submitted successfully.",
      data: {
        casualty,
        casualtyIncident,
        incident: {
          id: incident.id,
          incidentCode: incident.incident_code,
          incidentName: incident.incident_name,
        },
        encoder: {
          id: encoder.id,
          fullName: encoder.full_name,
        },
      },
    });
  } catch (error) {
    /*
     * Safety cleanup in case an unexpected error occurs after creating
     * the person but before completing the incident connection.
     */
    if (createdCasualtyId) {
      await supabase
        .from("casualties")
        .delete()
        .eq("id", createdCasualtyId);
    }

    next(error);
  }
}

export async function getCasualties(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const incidentId =
      typeof request.query.incidentId === "string"
        ? request.query.incidentId
        : undefined;

    const status =
      typeof request.query.status === "string"
        ? request.query.status
        : undefined;

    let query = supabase
      .from("casualty_incidents")
      .select(`
        id,
        client_record_id,
        current_status,
        severity,
        verification_status,
        current_location,
        hospital_name,
        visible_injury,
        medical_condition,
        assistance_needed,
        assistance_provided,
        remarks,
        reported_at,
        created_at,
        casualty:casualties (
          id,
          id_number,
          id_type,
          identification_status,
          first_name,
          middle_name,
          last_name,
          suffix,
          date_of_birth,
          estimated_age,
          sex,
          contact_number,
          house_street,
          barangay,
          municipality,
          province,
          region
        ),
        incident:incidents (
          id,
          incident_code,
          incident_name,
          disaster_type,
          status
        ),
        encoder:users!casualty_incidents_encoded_by_fkey (
          id,
          full_name,
          email,
          role
        )
      `)
      .is("deleted_at", null)
      .order("reported_at", { ascending: false });

    if (incidentId) {
      query = query.eq("incident_id", incidentId);
    }

    if (status) {
      query = query.eq("current_status", status);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Unable to retrieve casualties: ${error.message}`);
    }

    response.status(200).json({
      success: true,
      count: data?.length ?? 0,
      data: data ?? [],
    });
  } catch (error) {
    next(error);
  }
}