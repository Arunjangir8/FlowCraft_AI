import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { getDrawing } from "../controllers/drawing/getFile.controller";
import { saveDrawing } from "../controllers/drawing/save.controller";
import { createFileController } from "../controllers/drawing/createFile.controller";
import { getAllFiles } from "../controllers/drawing/getAllFiles.controller";

const drawRouter = Router();

drawRouter.post("/create", authMiddleware, createFileController);
drawRouter.post("/save", authMiddleware, saveDrawing);
drawRouter.get("/file/:fileId",authMiddleware, getDrawing);
drawRouter.get("/files", authMiddleware, getAllFiles);

export default drawRouter;