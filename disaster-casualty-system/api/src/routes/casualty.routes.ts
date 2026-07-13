import { Router } from "express";

import {
  createCasualty,
  getCasualties,
  getCasualtyById,
  updateCasualty,
} from "../controllers/casualty.controller.js";

export const casualtyRouter = Router();

casualtyRouter.get("/", getCasualties);
casualtyRouter.get("/:id", getCasualtyById);
casualtyRouter.post("/", createCasualty);
casualtyRouter.put("/:id", updateCasualty);
