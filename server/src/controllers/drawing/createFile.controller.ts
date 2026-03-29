import { Request, Response } from "express";
import { prisma } from "../../lib/prisma";

export const createFileController = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { title } = req.body;

    const file = await prisma.file.create({
      data: {
        ownerId: userId,
        title: title ?? "Untitled",
        type: "DRAWING",
      },
    });

    await prisma.drawingContent.create({
      data: { fileId: file.id },
    });

    return res.status(201).json({ success: true, data: file });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
