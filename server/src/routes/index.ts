import { Router } from "express";
import healthRouter from "./health.routes";
import usersRouter from "./users.routes";
import drawRouter from "./drawing.routes";
import eventRoutes from "./event.routes";

const indexRoutes = Router();

indexRoutes.use("/health", healthRouter);

indexRoutes.use('/user', usersRouter);

indexRoutes.use('/drawing', drawRouter);

indexRoutes.use('/events', eventRoutes);


export default indexRoutes;