import { fileSaveService } from '../../classes/FileSaveService';
import { runEditAgent, type EditCanvasMeta } from '../../lib/ai-agent/edit';
import { APIError, HttpStatusCode } from '../../shared/api-error';
import { saveAiMessage } from '../../utils/functions';
import { Request, Response, NextFunction } from "express";

const MAX_SHAPES = 2000;

export const editDrawing = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fileId, instruction, shapes, canvas } = req.body as {
      fileId: string;
      instruction: string;
      shapes: Array<Record<string, unknown>>;
      canvas?: Partial<EditCanvasMeta>;
    };

    const user = req.user;

    if (!user) {
      throw new APIError({
        message: "Unauthorized",
        httpCode: HttpStatusCode.UNAUTHORIZED,
      });
    }

    if (!fileId || !instruction?.trim()) {
      throw new APIError({
        message: "Missing required fields: fileId and instruction are required",
        httpCode: HttpStatusCode.BAD_REQUEST,
      });
    }

    if (!Array.isArray(shapes)) {
      throw new APIError({
        message: "shapes must be an array",
        httpCode: HttpStatusCode.BAD_REQUEST,
      });
    }

    if (shapes.length > MAX_SHAPES) {
      throw new APIError({
        message: "Canvas is too large for AI editing",
        httpCode: HttpStatusCode.BAD_REQUEST,
      });
    }

    // Authorization: user must be able to view/edit this file.
    const file = await fileSaveService.getDrawing(fileId, user.id);
    if (!file) {
      throw new APIError({
        message: "File not found",
        httpCode: HttpStatusCode.NOT_FOUND,
      });
    }

    // AI file quota intentionally disabled for /ai/edit. To re-enable, mirror
    // the check in sendMessage.controller.ts (fileHasAiSession + countAiFiles).

    const sessionId = await saveAiMessage({
      fileId,
      content: instruction,
      role: 'user',
      userId: user.id,
    });

    const result = await runEditAgent({
      instruction,
      shapes,
      canvas: {
        width: canvas?.width ?? file.canvasWidth ?? 1200,
        height: canvas?.height ?? file.canvasHeight ?? 900,
        background: canvas?.background,
        zoom: canvas?.zoom,
        selectedShapeIds: canvas?.selectedShapeIds,
      },
    });

    const createdShapes = result.operations
      .filter((op) => op.type === "create")
      .map((op) => (op as { shape: unknown }).shape);

    await saveAiMessage({
      sessionId,
      userId: user.id,
      role: 'assistant',
      content: result.message,
      generatedShapes: createdShapes.length ? (createdShapes as any) : null,
    });

    // Non-destructive by design: the drawing is NOT saved here. The client
    // previews the operations and commits via the normal /drawing/save flow.
    return res.status(200).json({
      message: result.message,
      operations: result.operations,
      dropped: result.dropped,
    });

  } catch (err) {
    next(err);
  }
};
