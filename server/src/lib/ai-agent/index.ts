import "dotenv/config";
import { ChatGroq } from "@langchain/groq";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { GoogleGenerativeAI } from "@google/generative-ai";

import {
    ALL_DRAWING_TOOLS,
    buildSystemPrompt,
    type DrawShape,
} from "./tools";



const groq = new ChatGroq({
    model:       "llama-3.3-70b-versatile",
    apiKey:      process.env.GROQ_API_KEY,
    temperature: 0.3,
});



const geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const gemini = geminiClient.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
        temperature:      0.7,
        maxOutputTokens:  4096,
        responseMimeType: "application/json",  
    },
});



const agent = createReactAgent({
    llm:   groq,
    tools: ALL_DRAWING_TOOLS,
    messageModifier: new SystemMessage(`
You are an intelligent drawing assistant for a canvas application.
You help users create beautiful drawings, diagrams, flowcharts, and visualisations.

When the user asks you to draw or create something:
1. Call generate_shapes with a rich, detailed prompt and the appropriate style.
2. The route handler will use the returned spec to call Gemini and produce real shapes.
3. Acknowledge what you are creating and encourage the user.

When the user asks what is on the canvas, call describe_drawing.
When the user wants to modify all shapes (recolor, scale, etc.), call transform_shapes.
When the user needs inspiration or ideas, call suggest_drawing_ideas.
Always be creative, encouraging, and briefly explain what you are drawing.
    `.trim()),
});



export async function generateShapesFromPrompt(
    prompt:       string,
    canvasWidth:  number = 1200,
    canvasHeight: number = 800,
    idOffset:     number = 0,
): Promise<DrawShape[]> {
    const systemPrompt = buildSystemPrompt(canvasWidth, canvasHeight);

    
    const fullPrompt = `${systemPrompt}\n\n---\n\nDRAWING REQUEST:\n${prompt}`;

    const result   = await gemini.generateContent(fullPrompt);
    const rawText  = result.response.text();

    
    const cleaned = rawText
        .replace(/^```(?:json)?\n?/i, "")
        .replace(/\n?```$/i, "")
        .trim();

    let shapes: DrawShape[] = JSON.parse(cleaned);

    
    shapes = shapes.map((s, i) => ({ ...s, id: idOffset + i + 1 }));

    return shapes;
}



export async function generateDiagramFromPrompt(
    diagramPrompt: string,
): Promise<string> {
    const result  = await gemini.generateContent(diagramPrompt);
    let rawText   = result.response.text();

    
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
        } catch (err) {
            
        }
    }

    return rawText;
}



export interface AgentRunOptions {
    userMessage:         string;
    existingShapes?:     DrawShape[];
    canvasWidth?:        number;
    canvasHeight?:       number;
    conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface AgentRunResult {
    reply:        string;
    newShapes:    DrawShape[] | null;  
    allShapes:    DrawShape[];         
    toolsUsed:    string[];
    mermaidDiagram?: string;           
    diagramType?:    string;
}

export async function runDrawingAgent(opts: AgentRunOptions): Promise<AgentRunResult> {
    const {
        userMessage,
        existingShapes      = [],
        canvasWidth         = 1200,
        canvasHeight        = 800,
        conversationHistory = [],
    } = opts;

    const historyMessages = conversationHistory.map(m =>
        m.role === "user"
            ? new HumanMessage(m.content)
            : new SystemMessage(m.content)
    );

    
    
    
    const shapesJson = JSON.stringify(existingShapes);
    const enrichedMessage = existingShapes.length > 0
        ? `[CANVAS: ${canvasWidth}×${canvasHeight}px | ${existingShapes.length} shape(s)]\n[SHAPES_ARRAY]: ${shapesJson}\n\nUSER: ${userMessage}`
        : `[CANVAS: ${canvasWidth}×${canvasHeight}px | empty]\n\nUSER: ${userMessage}`;

    const result = await agent.invoke({
        messages: [...historyMessages, new HumanMessage(enrichedMessage)],
    });

    const messages    = result.messages;
    const lastMessage = messages[messages.length - 1];
    const reply = typeof lastMessage.content === "string"
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);

    
    const toolsUsed: string[] = messages
        .filter((m: any) => m.name)
        .map((m: any) => m.name as string);

    
    const generateToolMsg = messages.find((m: any) => m.name === "generate_shapes");

    let newShapes: DrawShape[] | null = null;

    if (generateToolMsg) {
        try {
            const spec = typeof generateToolMsg.content === "string"
                ? JSON.parse(generateToolMsg.content)
                : generateToolMsg.content;

            newShapes = await generateShapesFromPrompt(
                spec.prompt ?? userMessage,
                spec.canvasWidth  ?? canvasWidth,
                spec.canvasHeight ?? canvasHeight,
                existingShapes.length,
            );
        } catch (err) {
            console.error("[DrawingAgent] Gemini shape generation failed:", err);
            newShapes = [];
        }
    }

    const allShapes = newShapes
        ? [...existingShapes, ...newShapes]
        : existingShapes;

    
    let mermaidDiagram: string | undefined;
    let diagramType:    string | undefined;

    const diagramToolMsg = messages.find((m: any) => m.name === "generate_diagram");

    if (diagramToolMsg) {
        try {
            const spec = typeof diagramToolMsg.content === "string"
                ? JSON.parse(diagramToolMsg.content)
                : diagramToolMsg.content;

            mermaidDiagram = await generateDiagramFromPrompt(spec.diagramPrompt);
            diagramType    = spec.resolvedType;
        } catch (err) {
            console.error("[DrawingAgent] Gemini diagram generation failed:", err);
        }
    }

    return { reply, newShapes, allShapes, toolsUsed, mermaidDiagram, diagramType };
}