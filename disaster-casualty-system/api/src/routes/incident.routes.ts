import { Router } from "express";

import { getIncidents } from "../controllers/incident.controller.js";

export const incidentRouter = Router();

incidentRouter.get("/", getIncidents);