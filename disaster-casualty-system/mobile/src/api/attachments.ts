import { api } from "./client";

export type UploadAttachmentPayload = {
  casualtyIncidentId: string;
  fileName: string;
  fileType: string;
  mimeType: string;
  base64Data: string;
  fileSizeBytes?: number;
};

export type Attachment = {
  id: string;
  casualty_incident_id: string;
  file_name: string;
  storage_path: string;
  file_type: string;
  mime_type: string | null;
  file_size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
  signed_url: string | null;
};

type UploadAttachmentResponse = {
  success: boolean;
  message: string;
  data: unknown;
};

type AttachmentListResponse = {
  success: boolean;
  count: number;
  data: Attachment[];
};

export async function getAttachments(
  casualtyIncidentId: string,
): Promise<Attachment[]> {
  const response = await api.get<AttachmentListResponse>(
    "/attachments",
    {
      params: {
        casualtyIncidentId,
      },
    },
  );

  return response.data.data;
}

export async function uploadAttachment(
  payload: UploadAttachmentPayload,
): Promise<UploadAttachmentResponse> {
  const response = await api.post<UploadAttachmentResponse>(
    "/attachments",
    payload,
  );

  return response.data;
}
