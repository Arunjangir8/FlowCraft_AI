import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

export class FileSaveService {
  async saveDrawing(
    fileId: string,
    userId: string,
    data: {
      shapesJson: Prisma.InputJsonValue;
      bgColor?: string;
      zoom?: number;
      panX?: number;
      panY?: number;
      canvasWidth?: number;
      canvasHeight?: number;
      title?: string;
    }
  ) {
    await this.assertCanEdit(fileId, userId);
 
    const { title, ...drawingData } = data;
 
    const [drawing] = await prisma.$transaction([
      prisma.drawingContent.upsert({
        where: { fileId },
        create: { fileId, ...drawingData },
        update: {
          ...drawingData,
          version: { increment: 1 },
        },
      }),
      prisma.file.update({
        where: { id: fileId },
        data: {
          ...(title ? { title } : {}),
          updatedAt: new Date(),
        },
      }),
    ]);
 
    return drawing;
  }
 
  async getDrawing(fileId: string, userId: string) {
    await this.assertCanView(fileId, userId);
    return prisma.drawingContent.findUnique({ where: { fileId } });
  }
 
  async renameFile(fileId: string, userId: string, title: string) {
    await this.assertCanEdit(fileId, userId);
    return prisma.file.update({
      where: { id: fileId },
      data: { title },
    });
  }
 
  async deleteFile(fileId: string, userId: string) {
    const file = await prisma.file.findUnique({ where: { id: fileId } });
    if (!file) throw new Error("File not found");
    if (file.ownerId !== userId) throw new Error("Only the owner can delete this file");
 
    return prisma.file.update({
      where: { id: fileId },
      data: { deletedAt: new Date() },
    });
  }
 
  async listUserFiles(userId: string) {
    return prisma.file.findMany({
      where: { ownerId: userId, deletedAt: null },
      include: { drawing: { select: { bgColor: true, updatedAt: true } } },
      orderBy: { updatedAt: "desc" },
    });
  }
 
  private async assertCanView(fileId: string, userId: string) {
    const file = await prisma.file.findUnique({ where: { id: fileId } });
    if (!file) throw new Error("File not found");
    if (file.deletedAt) throw new Error("File has been deleted");
 
    if (file.ownerId === userId) return;
 
    const collaborator = await prisma.fileCollaborator.findUnique({
      where: { fileId_userId: { fileId, userId } },
    });
    if (collaborator) return;
 
    const shareConfig = await prisma.fileShareConfig.findUnique({ where: { fileId } });
    if (shareConfig?.isPublic) return;
 
    throw new Error("Access denied");
  }
 
  private async assertCanEdit(fileId: string, userId: string) {
    const file = await prisma.file.findUnique({ where: { id: fileId } });
    if (!file) throw new Error("File not found");
    if (file.deletedAt) throw new Error("File has been deleted");
 
    if (file.ownerId === userId) return;
 
    const collaborator = await prisma.fileCollaborator.findUnique({
      where: { fileId_userId: { fileId, userId } },
    });
    if (collaborator?.permission === "EDIT") return;
 
    throw new Error("You do not have edit permission");
  }
}