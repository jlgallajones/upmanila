import type { NextFunction, Request, Response } from "express";

import { supabase } from "../config/supabase.js";
import { getAuthenticatedUser } from "../middleware/auth.js";

type UploadAttachmentRequest = {
  casualtyIncidentId: string;
  fileName: string;
  fileType: string;
  mimeType: string;
  base64Data: string;
  fileSizeBytes?: number;
};

const attachmentBucket =
  process.env.SUPABASE_ATTACHMENTS_BUCKET ?? "attachments";

const attachmentSelect = `
  id,
  casualty_incident_id,
  file_name,
  storage_path,
  file_type,
  mime_type,
  file_size_bytes,
  uploaded_by,
  created_at:uploaded_at,
  uploader:users!attachments_uploaded_by_fkey (
    id,
    full_name,
    email,
    role
  )
`;

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function uploadAttachment(
  request: Request<
    Record<string, never>,
    unknown,
    UploadAttachmentRequest
  >,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = getAuthenticatedUser(request);
    const {
      casualtyIncidentId,
      fileName,
      fileType,
      mimeType,
      base64Data,
      fileSizeBytes,
    } = request.body;

    if (
      !casualtyIncidentId ||
      !fileName ||
      !fileType ||
      !base64Data
    ) {
      response.status(400).json({
        success: false,
        message:
          "casualtyIncidentId, fileName, fileType, and base64Data are required.",
      });
      return;
    }

    const { data: casualtyIncident, error: casualtyError } =
      await supabase
        .from("casualty_incidents")
        .select("id")
        .eq("id", casualtyIncidentId)
        .single();

    if (casualtyError || !casualtyIncident) {
      response.status(404).json({
        success: false,
        message: "Casualty incident not found.",
      });
      return;
    }

    const extension = sanitizeFileName(fileName).split(".").pop();
    const storagePath = [
      casualtyIncidentId,
      `${Date.now()}-${sanitizeFileName(fileName)}`,
    ].join("/");

    const buffer = Buffer.from(base64Data, "base64");

    const { error: uploadError } = await supabase.storage
      .from(attachmentBucket)
      .upload(storagePath, buffer, {
        contentType:
          mimeType ||
          (extension ? `image/${extension}` : "application/octet-stream"),
        upsert: false,
      });

    if (uploadError) {
      throw new Error(
        `Unable to upload attachment: ${uploadError.message}`,
      );
    }

    const { data: attachment, error: attachmentError } =
      await supabase
        .from("attachments")
        .insert({
          casualty_incident_id: casualtyIncidentId,
          file_name: fileName,
          storage_path: storagePath,
          file_type: fileType,
          mime_type: mimeType || null,
          file_size_bytes: fileSizeBytes ?? buffer.byteLength,
          uploaded_by: user.id,
        })
        .select(attachmentSelect)
        .single();

    if (attachmentError || !attachment) {
      await supabase.storage
        .from(attachmentBucket)
        .remove([storagePath]);

      throw new Error(
        `Unable to save attachment record: ${
          attachmentError?.message ?? "Unknown database error"
        }`,
      );
    }

    response.status(201).json({
      success: true,
      message: "Attachment uploaded successfully.",
      data: attachment,
    });
  } catch (error) {
    next(error);
  }
}

export async function getAttachments(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const casualtyIncidentId =
      typeof request.query.casualtyIncidentId === "string"
        ? request.query.casualtyIncidentId
        : undefined;

    if (!casualtyIncidentId) {
      response.status(400).json({
        success: false,
        message: "casualtyIncidentId is required.",
      });
      return;
    }

    const { data, error } = await supabase
      .from("attachments")
      .select(attachmentSelect)
      .eq("casualty_incident_id", casualtyIncidentId)
      .order("uploaded_at", { ascending: false });

    if (error) {
      throw new Error(
        `Unable to retrieve attachments: ${error.message}`,
      );
    }

    const attachments = await Promise.all(
      (data ?? []).map(async (attachment) => {
        const { data: signedData } = await supabase.storage
          .from(attachmentBucket)
          .createSignedUrl(attachment.storage_path, 60 * 30);

        return {
          ...attachment,
          signed_url: signedData?.signedUrl ?? null,
        };
      }),
    );

    response.status(200).json({
      success: true,
      count: attachments.length,
      data: attachments,
    });
  } catch (error) {
    next(error);
  }
}
