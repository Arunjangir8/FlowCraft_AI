import express from "express";
import { AppEnv } from "./config";
import { notFoundHandler } from "./middleware/not-found";
import healthRouter from "./routes/health.routes";
import { errorHandler } from "./middleware/error-handler";
import { requestLogger } from "./middleware/request-logger";
import indexRoutes from "./routes";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);


app.use(AppEnv.API_PREFIX, indexRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
