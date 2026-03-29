import { NextFunction, Request, Response } from "express";
import { FileSaveService } from "../../classes/FileSaveService";
import { APIError, HttpStatusCode } from "../../shared/api-error";

const fileSaveService = new FileSaveService();

export const getDrawing = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.id;
        const fileId = Array.isArray(req.params.fileId)
            ? req.params.fileId[0]
            : req.params.fileId;

        if (!fileId) {
            return res.status(400).json({ message: "fileId is required" });
        }

        const drawing = await fileSaveService.getDrawing(fileId, userId);

        return res.status(200).json({
            success: true,
            data: drawing,
        });
    } catch (error: any) {
        next(
            error instanceof APIError ? error :
                new APIError({
                    message: error.message || "Failed to get file",
                    httpCode: HttpStatusCode.INTERNAL_SERVER,
                })
        );
    }
};