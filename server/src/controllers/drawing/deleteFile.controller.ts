import { Request, Response } from "express";
import { fileSaveService } from "../../classes/FileSaveService";

export const deleteFileController = async (req: Request<{ fileId: string }>, res: Response) => {
  try {
    const { fileId } = req.params;

    if (!fileId) {
        return res.status(400).json({ message: "fileId is required" });
    }

    const userId = req.user!.id;
    await fileSaveService.deleteFile(fileId, userId);

    return res.status(200).json({
      message: "File deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error deleting file",
      error,
    });
  }
};