import { Router } from "express";

import {
  createCasualty,
  getCasualties,
} from "../controllers/casualty.controller.js";

export const casualtyRouter = Router();

casualtyRouter.get("/", getCasualties);
casualtyRouter.post("/", createCasualty);