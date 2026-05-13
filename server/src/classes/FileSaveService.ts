import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

class FileSaveService {
  async createFile(
    userId: string,
    type: "DRAWING" | "MARKDOWN",
    title?: string,
    reuseBlank: boolean = true
  ) {
    if (reuseBlank && type === "DRAWING") {
      const existingBlank = await prisma.file.findFirst({
        where: {
          ownerId: userId,
          type: "DRAWING",
          title: "Untitled Drawing",
          deletedAt: null,
          drawing: {
            shapesJson: { equals: [] },
          },
        },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });

      if (existingBlank) return existingBlank;
    }

    return prisma.$transaction(async (tx) => {
      const file = await tx.file.create({
        data: {
          ownerId: userId,
          title: title ?? (type === "DRAWING" ? "Untitled Drawing" : "Untitled Doc"),
          type,
        },
      });

      if (type === "DRAWING") {
        await tx.drawingContent.create({
          data: { fileId: file.id },
        });
      }

      // if (type === "MARKDOWN") {
      //   await tx.markdownContent.create({
      //     data: {
      //       fileId: file.id,
      //       content: "",
      //     },
      //   });
      // }

      return file;
    });
  }

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

  async getFileTitle(fileId: string): Promise<string | null> {
    const file = await prisma.file.findUnique({ where: { id: fileId }, select: { title: true } });
    return file?.title ?? null;
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

  async countAiFiles(userId: string): Promise<number> {
    const rows = await prisma.aiConversationSession.findMany({
      where: { userId, fileId: { not: null }, deletedAt: null },
      select: { fileId: true },
      distinct: ["fileId"],
    });
    return rows.length;
  }

  async fileHasAiSession(userId: string, fileId: string): Promise<boolean> {
    const session = await prisma.aiConversationSession.findFirst({
      where: { userId, fileId, deletedAt: null },
      select: { id: true },
    });
    return session !== null;
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

export const fileSaveService = new FileSaveService();