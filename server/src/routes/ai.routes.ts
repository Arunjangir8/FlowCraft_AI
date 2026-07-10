import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { sendMessage } from "../controllers/ai/sendMessage.controller";
import { editDrawing } from "../controllers/ai/edit.controller";

const aiRouter = Router();

aiRouter.post("/sendMessage", authMiddleware, sendMessage);
aiRouter.post("/edit", authMiddleware, editDrawing);

export default aiRouter;
