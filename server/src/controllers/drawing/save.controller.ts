// controllers/file.controller.ts
import { NextFunction, Request, Response } from "express";
import { APIError, HttpStatusCode } from "../../shared/api-error";
import { fileSaveService } from "../../classes/FileSaveService";


export const saveDrawing = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { fileId, ...data } = req.body;

    if (!fileId) {
      return res.status(400).json({ message: "fileId is required" });
    }

    const drawing = await fileSaveService.saveDrawing(
      fileId,
      userId,
      {
        shapesJson: data.shapes,
        bgColor: data.bgColor,
        zoom: data.zoom,
        panX: data.panX,
        panY: data.panY,
        canvasWidth: data.canvasWidth,
        canvasHeight: data.canvasHeight,
        title: data.title,
      }
    );

    return res.status(200).json({
      success: true,
      data: drawing,
    });
  } catch (error: any) {
    next(
      error instanceof APIError ? error :
      new APIError({
        message: error.message || "Failed to save file",
        httpCode: HttpStatusCode.INTERNAL_SERVER,
      })
    );
  }
};