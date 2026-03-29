// controllers/file.controller.ts
import { Request, Response } from "express";
import { FileSaveService } from "../../classes/FileSaveService";

const fileSaveService = new FileSaveService();

export const saveDrawing = async (req: Request, res: Response) => {
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
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};