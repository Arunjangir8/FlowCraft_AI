import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { getDrawing } from "../controllers/drawing/getFile.controller";
import { saveDrawing } from "../controllers/drawing/save.controller";
import { createFileController } from "../controllers/drawing/createFile.controller";
import { getAllFiles } from "../controllers/drawing/getAllFiles.controller";
import { renameFileController } from "../controllers/drawing/renameFile.controller";
import { deleteFileController } from "../controllers/drawing/deleteFile.controller";

const drawRouter = Router();

drawRouter.get("/files", authMiddleware, getAllFiles);

drawRouter.post("/create", authMiddleware, createFileController);
drawRouter.post("/save", authMiddleware, saveDrawing);
drawRouter.get("/file/:fileId",authMiddleware, getDrawing);
drawRouter.patch("/file/:fileId", authMiddleware, renameFileController);
drawRouter.delete("/file/:fileId", authMiddleware, deleteFileController);

export default drawRouter;