import { Router } from "express";

import {
  createIncident,
  getIncidents,
} from "../controllers/incident.controller.js";

export const incidentRouter = Router();

incidentRouter.get("/", getIncidents);
incidentRouter.post("/", createIncident);
