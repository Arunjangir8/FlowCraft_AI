import { NextFunction, Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import { APIError, HttpStatusCode } from "../../shared/api-error";

export const createFileController = async (req: Request, res: Response, next: NextFunction) => {
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
    next(
      error instanceof APIError ? error :
            new APIError({
              message: error.message || "Failed to Create File",
              httpCode: HttpStatusCode.INTERNAL_SERVER,
            })
    );
  }
};
