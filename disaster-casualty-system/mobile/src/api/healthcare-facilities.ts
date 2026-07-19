import { api } from "./client";

export type HealthcareFacility = {
  id: string;
  facility_name: string;
  facility_level: string;
  address: string | null;
  barangay: string | null;
  municipality: string | null;
  province: string | null;
  contact_person: string | null;
  contact_number: string | null;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type HealthcareFacilityListResponse = {
  success: boolean;
  count: number;
  data: HealthcareFacility[];
};

type HealthcareFacilityResponse = {
  success: boolean;
  message: string;
  data: HealthcareFacility;
};

export type CreateHealthcareFacilityPayload = {
  facilityName: string;
  facilityLevel?: string;
  address?: string;
  barangay?: string;
  municipality?: string;
  province?: string;
  contactPerson?: string;
  contactNumber?: string;
  latitude?: number;
  longitude?: number;
};

export async function getHealthcareFacilities(
  search?: string,
): Promise<HealthcareFacility[]> {
  const response = await api.get<HealthcareFacilityListResponse>(
    "/healthcare-facilities",
    {
      params: search?.trim()
        ? {
            search,
          }
        : undefined,
    },
  );

  return response.data.data;
}

export async function createHealthcareFacility(
  payload: CreateHealthcareFacilityPayload,
): Promise<HealthcareFacility> {
  const response = await api.post<HealthcareFacilityResponse>(
    "/healthcare-facilities",
    payload,
  );

  return response.data.data;
}

