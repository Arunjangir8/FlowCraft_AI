import express from "express";
import cors from "cors";
import { AppEnv } from "./config";
import { notFoundHandler } from "./middleware/not-found";
import healthRouter from "./routes/health.routes";
import { errorHandler } from "./middleware/error-handler";
import { requestLogger } from "./middleware/request-logger";
import indexRoutes from "./routes";

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN ?? "*",
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

app.use(AppEnv.API_PREFIX, indexRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
