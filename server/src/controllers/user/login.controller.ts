import { Request, Response, NextFunction } from "express";
import { APIError, HttpStatusCode } from "../../shared/api-error";
import { authService } from "../../classes/AuthService";

export const loginController = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            throw new APIError({
                message: "Email and password are required",
                httpCode: HttpStatusCode.BAD_REQUEST,
            });
        }

        const { user, token } = await authService.login(email, password);
        const { passwordHash, ...safeUser } = user as any;

        res.status(200).json({
            success: true,
            message: "Login successful",
            data: {
                user: safeUser,
                token,
            },
        });
    } catch (err: any) {
        next(
            err instanceof APIError
                ? err
                : new APIError({
                    message: err.message || "Login failed",
                    httpCode: HttpStatusCode.UNAUTHORIZED,
                })
        );
    }
};
