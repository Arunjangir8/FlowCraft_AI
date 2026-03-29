import { Router } from "express";
import { loginController } from "../controllers/user/login.controller";
import { signupController } from "../controllers/user/signup.controller";
import { logoutController } from "../controllers/user/logout.controller";
import { getMeController } from "../controllers/user/get.controller";
import { deleteAccountController } from "../controllers/user/delete.controller";

const usersRouter = Router();

usersRouter.get("/me", getMeController);

usersRouter.post("/sign-in", loginController);
usersRouter.post("/sign-up", signupController);
usersRouter.post("/logout", logoutController);

usersRouter.delete("/account", deleteAccountController);

export default usersRouter;