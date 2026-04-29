import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { sendMessage } from "../controllers/ai/sendMessage.controller";

const aiRouter = Router();

aiRouter.post("/sendMessage", authMiddleware, sendMessage);

export default aiRouter;
