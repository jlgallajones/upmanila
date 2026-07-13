import { api } from "./client";

export type EvacuationCenter = {
  id: string;
  incident_id: string;
  center_name: string;
  address: string | null;
  barangay: string | null;
  municipality: string | null;
  province: string | null;
  capacity: number | null;
  contact_person: string | null;
  contact_number: string | null;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type EvacuationCenterListResponse = {
  success: boolean;
  count: number;
  data: EvacuationCenter[];
};

type EvacuationCenterResponse = {
  success: boolean;
  message: string;
  data: EvacuationCenter;
};

export type CreateEvacuationCenterPayload = {
  incidentId: string;
  centerName: string;
  address?: string;
  barangay?: string;
  municipality?: string;
  province?: string;
  capacity?: number;
  contactPerson?: string;
  contactNumber?: string;
  latitude?: number;
  longitude?: number;
};

export async function getEvacuationCenters(
  incidentId?: string,
): Promise<EvacuationCenter[]> {
  const response = await api.get<EvacuationCenterListResponse>(
    "/evacuation-centers",
    {
      params: incidentId
        ? {
            incidentId,
          }
        : undefined,
    },
  );

  return response.data.data;
}

export async function createEvacuationCenter(
  payload: CreateEvacuationCenterPayload,
): Promise<EvacuationCenter> {
  const response = await api.post<EvacuationCenterResponse>(
    "/evacuation-centers",
    payload,
  );

  return response.data.data;
}
