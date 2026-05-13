import "dotenv/config";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";

import {
    buildSystemPrompt,
    type DrawShape,
} from "./tools";

const openaiJson = new ChatOpenAI({
    model: "gpt-4o-mini",
    apiKey: process.env.OPENAI_API_KEY,
    temperature: 0.7,
    modelKwargs: {
        response_format: { type: "json_object" },
    },
});

const openaiText = new ChatOpenAI({
    model: "gpt-4o-mini",
    apiKey: process.env.OPENAI_API_KEY,
    temperature: 0.4,
});

export async function generateShapesFromPrompt(
    prompt: string,
    canvasWidth: number = 1200,
    canvasHeight: number = 800,
    idOffset: number = 0,
): Promise<DrawShape[]> {
    const systemPrompt = buildSystemPrompt(canvasWidth, canvasHeight);
    const fullPrompt = `${systemPrompt}\n\n---\n\nDRAWING REQUEST:\n${prompt}`;

    const result = await openaiJson.invoke(fullPrompt);
    const rawText =
        typeof result.content === "string"
            ? result.content
            : JSON.stringify(result.content);

    const cleaned = rawText
        .replace(/^```(?:json)?\n?/i, "")
        .replace(/\n?```$/i, "")
        .trim();

    const parsed = JSON.parse(cleaned);
    let shapes: DrawShape[] = Array.isArray(parsed)
        ? parsed
        : (parsed.shapes ?? parsed.elements ?? parsed.data ?? Object.values(parsed).find((v) => Array.isArray(v)) ?? []);
    shapes = shapes.map((s, i) => ({ ...s, id: idOffset + i + 1 }));

    return shapes;
}

export async function generateDiagramFromPrompt(
    diagramPrompt: string,
): Promise<string> {
    const result = await openaiText.invoke(diagramPrompt);
    let rawText =
        typeof result.content === "string"
            ? result.content
            : JSON.stringify(result.content);

    rawText = rawText
        .replace(/^```(?:mermaid)?\n?/i, "")
        .replace(/\n?```$/i, "")
        .trim();

    if (rawText.startsWith("[")) {
        try {
            const parsed = JSON.parse(rawText);
            if (Array.isArray(parsed)) {
                return parsed.join("\n").trim();
            }
        } catch {
        }
    }

    return rawText;
}

export interface AgentRunOptions {
    userMessage: string;
    existingShapes?: DrawShape[];
    canvasWidth?: number;
    canvasHeight?: number;
    conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface AgentRunResult {
    reply: string;
    newShapes: DrawShape[] | null;
    allShapes: DrawShape[];
    toolsUsed: string[];
    mermaidDiagram?: string;
    diagramType?: string;
    suggestedTitle?: string;
}

type GeminiAgentDecision =
    | {
          action: "generate_shapes";
          reply: string;
          prompt: string;
          suggestedTitle?: string;
          canvasWidth?: number;
          canvasHeight?: number;
      }
    | {
          action: "generate_diagram";
          reply: string;
          diagramPrompt: string;
          resolvedType?: string;
      }
    | {
          action: "describe_drawing";
          reply: string;
      }
    | {
          action: "transform_shapes";
          reply: string;
          transformedShapes: DrawShape[];
      }
    | {
          action: "suggest_drawing_ideas";
          reply: string;
          ideas: string[];
      }
    | {
          action: "chat";
          reply: string;
      };

export async function runDrawingAgent(
    opts: AgentRunOptions,
): Promise<AgentRunResult> {
    const {
        userMessage,
        existingShapes = [],
        canvasWidth = 1200,
        canvasHeight = 800,
        conversationHistory = [],
    } = opts;

    const historyMessages = conversationHistory.map((m) =>
        m.role === "user"
            ? new HumanMessage(m.content)
            : new AIMessage(m.content)
    );

    const shapesJson = JSON.stringify(existingShapes);

    const routingPrompt = `
You are an intelligent drawing assistant for a canvas application.

Your job is to decide the user's intent and return ONLY valid JSON.

Supported actions:
- "generate_shapes"
- "generate_diagram"
- "describe_drawing"
- "transform_shapes"
- "suggest_drawing_ideas"
- "chat"

Rules:
- If the user wants anything drawn, visualised, or created on the canvas — including flowcharts, workflows, process flows, architecture diagrams, mind maps, org charts, network diagrams — use "generate_shapes". These must be rendered as canvas shapes (rect, diamond, arrow, text, etc.), NOT as Mermaid text.
- ONLY use "generate_diagram" if the user explicitly asks for Mermaid syntax, a UML sequence diagram, ER diagram, class diagram, or state machine where text output is acceptable.
- If the user asks what is currently on the canvas, use "describe_drawing".
- If the user wants existing shapes modified, use "transform_shapes".
- If the user asks for inspiration, use "suggest_drawing_ideas".
- Otherwise use "chat".

IMPORTANT: flowchart, workflow, process, architecture, and "create a diagram" requests → always "generate_shapes".

For "generate_shapes", return:
{
  "action": "generate_shapes",
  "reply": "short friendly message",
  "prompt": "rich drawing prompt — include all steps/nodes, specify exact layout (top-to-bottom or left-to-right), and instruct arrows to connect center-bottom of source to center-top of target with no overlap. Do NOT specify any colors — shapes use theme defaults.",
  "suggestedTitle": "concise 2-5 word title describing what is being drawn, e.g. 'Employee Leave Approval Flow'",
  "canvasWidth": ${canvasWidth},
  "canvasHeight": ${canvasHeight}
}

For "generate_diagram", return:
{
  "action": "generate_diagram",
  "reply": "short friendly message",
  "diagramPrompt": "detailed mermaid generation prompt",
  "resolvedType": "flowchart|sequence|class|er|state|mindmap|architecture|other"
}

For "describe_drawing", return:
{
  "action": "describe_drawing",
  "reply": "brief description of the current canvas"
}

For "transform_shapes", return:
{
  "action": "transform_shapes",
  "reply": "short friendly message",
  "transformedShapes": [full updated shapes array]
}

For "suggest_drawing_ideas", return:
{
  "action": "suggest_drawing_ideas",
  "reply": "encouraging message",
  "ideas": ["idea 1", "idea 2", "idea 3"]
}

For "chat", return:
{
  "action": "chat",
  "reply": "helpful response"
}

Canvas info:
- width: ${canvasWidth}
- height: ${canvasHeight}
- existing shapes count: ${existingShapes.length}
- existing shapes: ${shapesJson}

Conversation history:
${historyMessages
    .map((m) => {
        if (m instanceof HumanMessage) return `User: ${m.content}`;
        return `Assistant: ${m.content}`;
    })
    .join("\n")}

Current user message:
${userMessage}
    `.trim();

    const decisionResult = await openaiJson.invoke(routingPrompt);
    const rawDecision =
        typeof decisionResult.content === "string"
            ? decisionResult.content
            : JSON.stringify(decisionResult.content);

    const cleanedDecision = rawDecision
        .replace(/^```(?:json)?\n?/i, "")
        .replace(/\n?```$/i, "")
        .trim();

    let decision: GeminiAgentDecision;

    try {
        decision = JSON.parse(cleanedDecision) as GeminiAgentDecision;
    } catch (err) {
        console.error("[DrawingAgent] OpenAI routing parse failed:", err);
        return {
            reply: "I hit a formatting issue, but I can still help. Try rephrasing what you'd like to draw.",
            newShapes: null,
            allShapes: existingShapes,
            toolsUsed: [],
        };
    }

    let newShapes: DrawShape[] | null = null;
    let allShapes: DrawShape[] = existingShapes;
    let mermaidDiagram: string | undefined;
    let diagramType: string | undefined;
    const toolsUsed: string[] = [];

    if (decision.action === "generate_shapes") {
        toolsUsed.push("generate_shapes");
        try {
            newShapes = await generateShapesFromPrompt(
                decision.prompt ?? userMessage,
                decision.canvasWidth ?? canvasWidth,
                decision.canvasHeight ?? canvasHeight,
                existingShapes.length,
            );
            allShapes = [...existingShapes, ...newShapes];
        } catch (err) {
            console.error("[DrawingAgent] OpenAI shape generation failed:", err);
            newShapes = [];
            allShapes = existingShapes;
        }
    }

    if (decision.action === "generate_diagram") {
        toolsUsed.push("generate_diagram");
        try {
            mermaidDiagram = await generateDiagramFromPrompt(
                decision.diagramPrompt,
            );
            diagramType = decision.resolvedType;
        } catch (err) {
            console.error("[DrawingAgent] OpenAI diagram generation failed:", err);
        }
    }

    if (decision.action === "transform_shapes") {
        toolsUsed.push("transform_shapes");
        allShapes = decision.transformedShapes ?? existingShapes;
    }

    if (decision.action === "describe_drawing") {
        toolsUsed.push("describe_drawing");
    }

    if (decision.action === "suggest_drawing_ideas") {
        toolsUsed.push("suggest_drawing_ideas");
    }

    return {
        reply: decision.reply,
        newShapes,
        allShapes,
        toolsUsed,
        mermaidDiagram,
        diagramType,
        suggestedTitle: decision.action === "generate_shapes" ? decision.suggestedTitle : undefined,
    };
}