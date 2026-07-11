import { AiMessageRole } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { DrawShape } from "../lib/ai-agent/tools";

interface SaveAiMessageOptions {
  fileId:              string;
  userId:              string;
  role:                "user" | "assistant";
  content:             string;
  generatedShapes?:    DrawShape[] | null;
  promptTokens?:       number;
  completionTokens?:   number;
  modelId?:            string;
}

export async function saveAiMessage(opts: SaveAiMessageOptions): Promise<void> {
  const {
    fileId,
    userId,
    role,
    content,
    generatedShapes,
    promptTokens,
    completionTokens,
    modelId,
  } = opts;

  await prisma.aiMessage.create({
    data: {
      fileId,
      userId,
      role: role === "user" ? AiMessageRole.USER : AiMessageRole.ASSISTANT,
      content,
      generatedShapesJson: generatedShapes?.length
        ? (generatedShapes as any)
        : undefined,
      promptTokens,
      completionTokens,
      modelId,
    },
  });

  if (role === "assistant") {
    // Dedicated counter — never derived from message array length.
    await prisma.file.update({
      where: { id: fileId },
      data: { aiCallsUsed: { increment: 1 } },
    });

    await prisma.aiUsage.upsert({
      where: { userId },
      update: { chatsUsed: { increment: 1 } },
      create: { userId, chatsUsed: 1, generationsUsed: 0 },
    });
  }
}
