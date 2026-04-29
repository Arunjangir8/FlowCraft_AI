import { Request, Response } from "express";
import { fileSaveService } from "../../classes/FileSaveService";

export const renameFileController = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const fileId = req.params.fileId as string;
    const { title } = req.body;

    if (!title || typeof title !== "string") {
      return res.status(400).json({ message: "Title is required" });
    }

    const file = await fileSaveService.renameFile(fileId, userId, title);

    return res.status(200).json(file);
  } catch (error: any) {
    return res.status(500).json({
      message: error.message || "Failed to rename file",
    });
  }
};