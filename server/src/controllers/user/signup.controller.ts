import { Request, Response, NextFunction } from "express";
import { APIError, HttpStatusCode } from "../../shared/api-error";
import { AuthService } from "../../classes/AuthService";

const authService = new AuthService();

export const signupController = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { email, password, name } = req.body;
        if (!email || !password) {
            throw new APIError({
                message: "Email and password are required",
                httpCode: HttpStatusCode.BAD_REQUEST,
            });
        }

        if (password.length < 6) {
            throw new APIError({
                message: "Password must be at least 6 characters",
                httpCode: HttpStatusCode.BAD_REQUEST,
            });
        }

        const user = await authService.signup(email, password, name);

        res.status(201).json({
            success: true,
            message: "Signup successful",
            data: {
                user,
            },
        });
    } catch (err: any) {
        next(
            err instanceof APIError
                ? err
                : new APIError({
                    message: err.message || "Signup failed",
                    httpCode: HttpStatusCode.BAD_REQUEST,
                })
        );
    }
};