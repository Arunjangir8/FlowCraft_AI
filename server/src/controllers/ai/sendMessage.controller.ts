import { runDrawingAgent } from '../../lib/ai-agent';
import { APIError, HttpStatusCode } from '../../shared/api-error';
import { saveAiMessage } from '../../utils/functions';
import { FileSaveService } from './../../classes/FileSaveService';
import { Request, Response, NextFunction } from "express";

const fileSaveService = new FileSaveService();

export const sendMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      fileId,
      message,
      // sessionid,
      replaceShapes = false,
      conversationHistory = []
    } = req.body as {
      fileId: string;
      message: string;
      // sessionid: string;
      replaceShapes?: boolean;
      conversationHistory?: { role: "user" | "assistant"; content: string }[];
    }

    const user = req.user;

    if (!fileId || !message) {
      throw new APIError({
        message: "Missing required fields: fileId, message, and sessionid are required",
        httpCode: HttpStatusCode.BAD_REQUEST,
      });
    }

    if (!user) {
      throw new APIError({
        message: "Unauthorized",
        httpCode: HttpStatusCode.UNAUTHORIZED,
      });
    }

    const file = await fileSaveService.getDrawing(fileId, user.id);

    if (!file) {
      throw new APIError({
        message: "File not found",
        httpCode: HttpStatusCode.NOT_FOUND,
      });
    }

    const resolvedSessionId = await saveAiMessage({
      fileId,
      content: message,
      role: 'user',
      userId: user.id,
    })

    const agentResult = await runDrawingAgent({
      userMessage: message,
      existingShapes: file.shapesJson as any[],
      conversationHistory,
      canvasWidth: file.canvasWidth || 1200,
      canvasHeight: file.canvasHeight || 900,
    })

    await saveAiMessage({
      sessionId: resolvedSessionId,
      userId: user.id,
      role: 'assistant',
      content: agentResult.reply,
      generatedShapes: agentResult.newShapes,
    })

    return res.status(200).json({
      reply: agentResult.reply,
      shapes: {
        new: agentResult.newShapes ?? [],
        all: agentResult.newShapes
          ? replaceShapes
            ? agentResult.newShapes
            : agentResult.allShapes
          : null,
      },
      ...(agentResult.mermaidDiagram && {
        mermaidDiagram: agentResult.mermaidDiagram,
        diagramType: agentResult.diagramType,
      }),
    });

  } catch (err) {
    next(err);
  }
};
