import {  Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

export class FileCopyService {
  async copyFile(originalFileId: string, copiedByUserId: string, newTitle?: string) {
    const original = await prisma.file.findUnique({
      where: { id: originalFileId },
      include: { drawing: true },
    });

    if (!original) throw new Error("File not found");
    if (original.deletedAt) throw new Error("File has been deleted");

    const isOwner = original.ownerId === copiedByUserId;

    if (!isOwner) {
      const shareConfig = await prisma.fileShareConfig.findUnique({
        where: { fileId: originalFileId },
      });
      const isCollaborator = await prisma.fileCollaborator.findUnique({
        where: { fileId_userId: { fileId: originalFileId, userId: copiedByUserId } },
      });

      const canCopy = shareConfig?.allowCopy || isCollaborator;
      if (!canCopy) throw new Error("You do not have permission to copy this file");
    }

    const newFile = await prisma.$transaction(async (tx) => {
      const createdFile = await tx.file.create({
        data: {
          ownerId: copiedByUserId,
          title: newTitle ?? `${original.title} (Copy)`,
          type: original.type,
          sizeBytes: original.sizeBytes,
        },
      });

      if (original.drawing) {
        await tx.drawingContent.create({
          data: {
            fileId: createdFile.id,
            shapesJson: original.drawing.shapesJson ?? Prisma.JsonNull,
            bgColor: original.drawing.bgColor,
            zoom: original.drawing.zoom,
            panX: original.drawing.panX,
            panY: original.drawing.panY,
            canvasWidth: original.drawing.canvasWidth,
            canvasHeight: original.drawing.canvasHeight,
          },
        });
      }

      await tx.fileCopy.create({
        data: {
          originalFileId,
          copiedFileId: createdFile.id,
          copiedByUserId,
        },
      });

      return createdFile;
    });

    return newFile;
  }

  async getCopyHistory(originalFileId: string) {
    return prisma.fileCopy.findMany({
      where: { originalFileId },
      include: {
        copiedBy: { select: { id: true, name: true, email: true } },
        copiedFile: { select: { id: true, title: true, createdAt: true } },
      },
      orderBy: { copiedAt: "desc" },
    });
  }

  async getOriginalSource(fileId: string) {
    return prisma.fileCopy.findUnique({
      where: { copiedFileId: fileId },
      include: {
        originalFile: { select: { id: true, title: true, ownerId: true } },
      },
    });
  }
}