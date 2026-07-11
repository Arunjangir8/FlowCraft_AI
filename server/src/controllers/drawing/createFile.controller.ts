import { NextFunction, Request, Response } from "express";
import { APIError, HttpStatusCode } from "../../shared/api-error";
import { fileSaveService } from "../../classes/FileSaveService";

export const createFileController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { title, isAiFile } = (req.body ?? {}) as { title?: string; isAiFile?: boolean };

    const file = await fileSaveService.createFile(userId, "DRAWING", title, true, !!isAiFile);

    return res.status(201).json({ success: true, data: file });
  } catch (error: any) {
    next(
      error instanceof APIError ? error :
            new APIError({
              message: error.message || "Failed to Create File",
              httpCode: HttpStatusCode.INTERNAL_SERVER,
            })
    );
  }
};
