import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { sendMessage } from "../controllers/ai/sendMessage.controller";
import { editDrawing } from "../controllers/ai/edit.controller";
import { getAiUsage, getFileAiMessages } from "../controllers/ai/usage.controller";

const aiRouter = Router();

aiRouter.post("/sendMessage", authMiddleware, sendMessage);
aiRouter.post("/edit", authMiddleware, editDrawing);
aiRouter.get("/usage", authMiddleware, getAiUsage);
aiRouter.get("/usage/:fileId/messages", authMiddleware, getFileAiMessages);

export default aiRouter;
