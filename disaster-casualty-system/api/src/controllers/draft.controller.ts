import type { NextFunction, Request, Response } from "express";

import { supabase } from "../config/supabase.js";
import { getAuthenticatedUser } from "../middleware/auth.js";
import { recordAuditLog } from "../services/audit-log.service.js";

const draftSelect = `
  id,
  owner_id,
  form_type,
  title,
  payload,
  status,
  created_at,
  updated_at
`;

const allowedFormTypes = new Set([
  "incident",
  "healthcare_facility",
  "casualty_field_responder",
  "casualty_sar",
  "casualty_hcfd",
  "account",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function normalizeFormType(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const normalized = value.trim();
  return allowedFormTypes.has(normalized) ? normalized : null;
}

function normalizeTitle(value: unknown, formType: string): string {
  if (typeof value === "string" && value.trim()) {
    return value.trim().slice(0, 140);
  }

  return `${formType.replace(/_/g, " ")} draft`;
}

export async function getDrafts(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = getAuthenticatedUser(request);
    const formType = normalizeFormType(request.query.formType);

    let query = supabase
      .from("form_drafts")
      .select(draftSelect)
      .eq("owner_id", user.id)
      .eq("status", "draft")
      .order("updated_at", { ascending: false });

    if (formType) {
      query = query.eq("form_type", formType);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Unable to retrieve drafts: ${error.message}`);
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

export async function createDraft(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = getAuthenticatedUser(request);
    const body = request.body as {
      formType?: unknown;
      title?: unknown;
      payload?: unknown;
    };
    const formType = normalizeFormType(body.formType);

    if (!formType) {
      response.status(400).json({
        success: false,
        message: "A valid formType is required.",
      });
      return;
    }

    if (!isRecord(body.payload)) {
      response.status(400).json({
        success: false,
        message: "Draft payload must be an object.",
      });
      return;
    }

    const { data, error } = await supabase
      .from("form_drafts")
      .insert({
        owner_id: user.id,
        form_type: formType,
        title: normalizeTitle(body.title, formType),
        payload: body.payload,
        status: "draft",
      })
      .select(draftSelect)
      .single();

    if (error || !data) {
      throw new Error(
        `Unable to save draft: ${error?.message ?? "Unknown database error"}`,
      );
    }

    await recordAuditLog({
      actor: user,
      action: "draft.saved",
      entityType: "form_draft",
      entityId: data.id,
      entityLabel: data.title,
      metadata: {
        formType,
      },
    });

    response.status(201).json({
      success: true,
      message: "Draft saved.",
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateDraft(
  request: Request<{ id: string }>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = getAuthenticatedUser(request);
    const { id } = request.params;
    const body = request.body as {
      title?: unknown;
      payload?: unknown;
    };

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.title !== undefined) {
      updates.title = normalizeTitle(body.title, "form");
    }

    if (body.payload !== undefined) {
      if (!isRecord(body.payload)) {
        response.status(400).json({
          success: false,
          message: "Draft payload must be an object.",
        });
        return;
      }

      updates.payload = body.payload;
    }

    const { data, error } = await supabase
      .from("form_drafts")
      .update(updates)
      .eq("id", id)
      .eq("owner_id", user.id)
      .eq("status", "draft")
      .select(draftSelect)
      .maybeSingle();

    if (error) {
      throw new Error(`Unable to update draft: ${error.message}`);
    }

    if (!data) {
      response.status(404).json({
        success: false,
        message: "Draft not found.",
      });
      return;
    }

    await recordAuditLog({
      actor: user,
      action: "draft.updated",
      entityType: "form_draft",
      entityId: data.id,
      entityLabel: data.title,
      metadata: {
        formType: data.form_type,
      },
    });

    response.status(200).json({
      success: true,
      message: "Draft updated.",
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteDraft(
  request: Request<{ id: string }>,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = getAuthenticatedUser(request);
    const { id } = request.params;

    const { data: existingDraft, error: existingError } = await supabase
      .from("form_drafts")
      .select(draftSelect)
      .eq("id", id)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (existingError) {
      throw new Error(`Unable to retrieve draft: ${existingError.message}`);
    }

    if (!existingDraft) {
      response.status(404).json({
        success: false,
        message: "Draft not found.",
      });
      return;
    }

    const { error } = await supabase
      .from("form_drafts")
      .delete()
      .eq("id", id)
      .eq("owner_id", user.id);

    if (error) {
      throw new Error(`Unable to delete draft: ${error.message}`);
    }

    await recordAuditLog({
      actor: user,
      action: "draft.deleted",
      entityType: "form_draft",
      entityId: id,
      entityLabel: existingDraft.title,
      metadata: {
        formType: existingDraft.form_type,
      },
    });

    response.status(200).json({
      success: true,
      message: "Draft deleted.",
    });
  } catch (error) {
    next(error);
  }
}

