import cors from "cors";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";

import { incidentRouter } from "./routes/incident.routes.js";
import { casualtyRouter } from "./routes/casualty.routes.js";
import { dashboardRouter } from "./routes/dashboard.routes.js";
import { evacuationCenterRouter } from "./routes/evacuation-center.routes.js";
import { notificationRouter } from "./routes/notification.routes.js";
import { profileRouter } from "./routes/profile.routes.js";
export const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/", (_request: Request, response: Response) => {
  response.json({
    success: true,
    message: "Disaster Casualty Management System API",
  });
});

app.get("/api/health", (_request: Request, response: Response) => {
  response.status(200).json({
    success: true,
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/incidents", incidentRouter);
app.use("/api/evacuation-centers", evacuationCenterRouter);
app.use("/api/casualties", casualtyRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/profile", profileRouter);
app.use(
  (
    _request: Request,
    response: Response,
  ) => {
    response.status(404).json({
      success: false,
      message: "API route not found.",
    });
  },
);

app.use(
  (
    error: unknown,
    _request: Request,
    response: Response,
    _next: NextFunction,
  ) => {
    console.error(error);

    const message =
      error instanceof Error
        ? error.message
        : "Internal server error.";

    response.status(500).json({
      success: false,
      message,
    });
  },
);
