import { NextFunction, Request, Response } from "express";
import { APIError, HttpStatusCode } from "../../shared/api-error";
import { fileSaveService } from "../../classes/FileSaveService";

export const getAllFiles = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.id;
        const [files, aiFilesUsed] = await Promise.all([
            fileSaveService.listUserFiles(userId),
            fileSaveService.countAiFiles(userId),
        ]);

        return res.status(200).json({
            success: true,
            data: files,
            aiFilesUsed,
        });
    } catch (error: any) {
        next(
            error instanceof APIError ? error :
                new APIError({
                    message: error.message || "Failed to get files",
                    httpCode: HttpStatusCode.INTERNAL_SERVER,
                })
        );
    }
};
