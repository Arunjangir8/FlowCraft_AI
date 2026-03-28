import { Router } from "express";
import healthRouter from "./health.routes";

const indexRoutes = Router();

indexRoutes.use("/health", healthRouter);


export default indexRoutes;