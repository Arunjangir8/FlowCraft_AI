import { Router } from "express";
import healthRouter from "./health.routes";
import usersRouter from "./users.routes";

const indexRoutes = Router();

indexRoutes.use("/health", healthRouter);

indexRoutes.use('/user', usersRouter);


export default indexRoutes;