import type { NextFunction, Request, Response } from "express";

import { supabase } from "../config/supabase.js";

export async function getIncidents(
  _request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { data, error } = await supabase
      .from("incidents")
      .select(`
        id,
        incident_code,
        incident_name,
        disaster_type,
        description,
        province,
        municipality,
        barangay,
        started_at,
        ended_at,
        status,
        created_at,
        updated_at
      `)
      .is("ended_at", null)
      .order("started_at", { ascending: false });

    if (error) {
      throw new Error(`Supabase error: ${error.message}`);
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