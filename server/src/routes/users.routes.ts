import { Router } from "express";
import { loginController } from "../controllers/user/login.controller";
import { signupController } from "../controllers/user/signup.controller";
import { logoutController } from "../controllers/user/logout.controller";
import { getMeController } from "../controllers/user/get.controller";
import { deleteAccountController } from "../controllers/user/delete.controller";
import { googleLoginController } from "../controllers/user/google-login.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const usersRouter = Router();

usersRouter.get("/me", authMiddleware, getMeController);

usersRouter.post("/sign-in", loginController);
usersRouter.post("/google-sign-in", googleLoginController);
usersRouter.post("/sign-up", signupController);
usersRouter.post("/logout", authMiddleware, logoutController);

usersRouter.delete("/account", authMiddleware ,deleteAccountController);

export default usersRouter;