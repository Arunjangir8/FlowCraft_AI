

import { AiMessageRole } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { DrawShape } from "../lib/ai-agent/tools";
import { logger } from "../shared/logger";

interface SaveAiMessageOptions {
  sessionId?:          string;   
  userId:              string;
  fileId?:             string;
  role:                "user" | "assistant";
  content:             string;
  generatedShapes?:    DrawShape[] | null;
  promptTokens?:       number;
  completionTokens?:   number;
  modelId?:            string;
}

export async function saveAiMessage(opts: SaveAiMessageOptions): Promise<string> {
  const {
    sessionId,
    userId,
    fileId,
    role,
    content,
    generatedShapes,
    promptTokens,
    completionTokens,
    modelId,
  } = opts;

  
  let activeSessionId = sessionId;

  if (!activeSessionId) {
    
    const existingSession = await prisma.aiConversationSession.findFirst({
      where: {
        userId,
        ...(fileId ? { fileId } : {}),
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
      select:  { id: true },
    });

    if (existingSession) {
      activeSessionId = existingSession.id;
    } else {
      const newSession = await prisma.aiConversationSession.create({
        data: {
          userId,
          fileId:    fileId ?? null,
          title:     "New Chat",
        },
        select: { id: true },
      });
      activeSessionId = newSession.id;
    }
  }

  
  try {
    await prisma.aiConversationSession.update({
      where: { id: activeSessionId },
      data:  { updatedAt: new Date() },
    });
  } catch (error: any) {
    
    if (error.code === "P2025") {
      logger.warn(
        `[saveAiMessage] Session ${activeSessionId} not found, creating new one`
      );
      const newSession = await prisma.aiConversationSession.create({
        data: {
          userId,
          fileId:    fileId ?? null,
          title:     "New Chat",
        },
        select: { id: true },
      });
      activeSessionId = newSession.id;
    } else {
      logger.error("[saveAiMessage] Error updating session:", error);
      
    }
  }

  
  await prisma.aiMessage.create({
    data: {
      sessionId: activeSessionId,
      role:      role === "user" ? AiMessageRole.USER : AiMessageRole.ASSISTANT,
      content,
      generatedShapesJson: generatedShapes?.length
        ? (generatedShapes as any)
        : undefined,
      promptTokens,
      completionTokens,
      modelId,
    },
  });

  
  if (role === "user") {
    const now = new Date();
    await prisma.aiUsage.upsert({
      where: {
        userId_year_month: {
          userId,
          year:  now.getFullYear(),
          month: now.getMonth() + 1,
        },
      },
      update: { chatsUsed: { increment: 1 } },
      create: {
        userId,
        year:            now.getFullYear(),
        month:           now.getMonth() + 1,
        chatsUsed:       1,
        generationsUsed: 0,
      },
    });
  }

  
  
  return activeSessionId;
}