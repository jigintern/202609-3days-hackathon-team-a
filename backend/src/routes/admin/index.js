import { Router } from "express";
import { requireAdmin } from "../../middlewares/auth.js";
import { adminUsersRouter } from "./users.js";
import { adminContentRouter } from "./content.js";
import { adminArtistsRouter } from "./artists.js";
import { adminEventsRouter } from "./events.js";
import { adminEventRequestsRouter } from "./eventRequests.js";

export const adminRouter = Router();

adminRouter.use(requireAdmin);
adminRouter.use("/users", adminUsersRouter);
adminRouter.use("/", adminContentRouter);
adminRouter.use("/artists", adminArtistsRouter);
adminRouter.use("/events", adminEventsRouter);
adminRouter.use("/event-requests", adminEventRequestsRouter);
