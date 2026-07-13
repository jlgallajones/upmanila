import { Router } from "express";

import {
  createEvacuationCenter,
  getEvacuationCenters,
} from "../controllers/evacuation-center.controller.js";

export const evacuationCenterRouter = Router();

evacuationCenterRouter.get("/", getEvacuationCenters);
evacuationCenterRouter.post("/", createEvacuationCenter);
