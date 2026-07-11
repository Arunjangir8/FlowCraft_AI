import { prisma } from '../../lib/prisma';
import { fileSaveService } from '../../classes/FileSaveService';
import { APIError, HttpStatusCode } from '../../shared/api-error';
import { Request, Response, NextFunction } from "express";

const AI_CALL_LIMIT = 20;
const AI_FILE_LIMIT = 3;

export const getAiUsage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) {
      throw new APIError({ message: "Unauthorized", httpCode: HttpStatusCode.UNAUTHORIZED });
    }

    const [files, subscription, aiFilesUsed] = await Promise.all([
      prisma.file.findMany({
        where: { ownerId: user.id, isAiFile: true, deletedAt: null },
        select: { id: true, title: true, aiCallsUsed: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.subscription.findUnique({ where: { userId: user.id }, include: { plan: true } }),
      fileSaveService.countAiFiles(user.id),
    ]);

    const usage = await prisma.aiUsage.findUnique({ where: { userId: user.id } });

    return res.status(200).json({
      aiFiles: {
        used: aiFilesUsed,
        limit: AI_FILE_LIMIT,
        remaining: Math.max(0, AI_FILE_LIMIT - aiFilesUsed),
      },
      files: files.map((f) => ({
        id: f.id,
        title: f.title,
        updatedAt: f.updatedAt,
        aiCallsUsed: f.aiCallsUsed,
        aiCallsLimit: AI_CALL_LIMIT,
        aiCallsRemaining: Math.max(0, AI_CALL_LIMIT - f.aiCallsUsed),
      })),
      lifetime: {
        chatsUsed: usage?.chatsUsed ?? 0,
        generationsUsed: usage?.generationsUsed ?? 0,
        chatsLimit: subscription?.plan.aiChatsPerMonth ?? null,
        generationsLimit: subscription?.plan.aiGenerationsPerMonth ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getFileAiMessages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) {
      throw new APIError({ message: "Unauthorized", httpCode: HttpStatusCode.UNAUTHORIZED });
    }

    const fileId = req.params.fileId as string;
    const file = await prisma.file.findFirst({
      where: { id: fileId, ownerId: user.id, deletedAt: null },
      select: { id: true },
    });
    if (!file) {
      throw new APIError({ message: "File not found", httpCode: HttpStatusCode.NOT_FOUND });
    }

    const messages = await prisma.aiMessage.findMany({
      where: { fileId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        role: true,
        content: true,
        createdAt: true,
        promptTokens: true,
        completionTokens: true,
      },
    });

    return res.status(200).json({ messages });
  } catch (err) {
    next(err);
  }
};
