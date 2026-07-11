import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { Box } from "./edit";



const PointSchema = z.object({ x: z.number(), y: z.number() });

const BindingSchema = z.object({
    shapeId: z.union([z.number(), z.string()]),
    anchor: z.enum(["top", "right", "bottom", "left", "center"]),
});

const DrawShapeSchema = z.object({
    id:            z.union([z.number(), z.string()]),
    type:          z.enum(["pen", "line", "arrow", "rect", "ellipse", "diamond", "text"]),

    points:        z.array(PointSchema).optional(),

    x:             z.number().optional(),
    y:             z.number().optional(),
    text:          z.string().optional(),
    fontSize:      z.number().optional(),

    x1:            z.number().optional(),
    y1:            z.number().optional(),
    x2:            z.number().optional(),
    y2:            z.number().optional(),

    color:         z.string().optional(),
    strokeWidth:   z.number().optional(),
    fill:          z.string().optional(),
    opacity:       z.number().min(0).max(1).optional(),
    rounded:       z.boolean().optional(),
    roundedRadius: z.number().optional(),
    rotation:      z.number().optional(),

    label:         z.string().optional(),
    labelFontSize: z.number().optional(),
    labelColor:    z.string().optional(),
    startBinding:  BindingSchema.optional(),
    endBinding:    BindingSchema.optional(),
});

export type DrawShape = z.infer<typeof DrawShapeSchema>;



const PALETTE = {
    vibrant:  ["#f87171","#fb923c","#fbbf24","#a3e635","#34d399","#38bdf8","#818cf8","#e879f9","#f472b6"],
    pastel:   ["#fca5a5","#fdba74","#fde68a","#bbf7d0","#a5f3fc","#c7d2fe","#f5d0fe"],
    neutral:  ["#f8fafc","#94a3b8","#475569","#1e293b","#0f172a"],
    neon:     ["#39ff14","#ff00ff","#00ffff","#ff6600","#ffff00"],
    mono:     ["#ffffff","#d1d5db","#9ca3af","#6b7280","#374151"],
};



function buildSystemPrompt(canvasW: number, canvasH: number, occupied?: Box | null): string {
    return `
You are an expert canvas diagram artist that outputs drawing shapes as JSON.

CANVAS SIZE: ${canvasW} × ${canvasH} px
COORDINATE ORIGIN: top-left (0,0) — x grows right, y grows down.
${occupied ? `
OCCUPIED SPACE: the canvas already has shapes spanning x ∈ [${Math.round(occupied.minX)}, ${Math.round(occupied.maxX)}], y ∈ [${Math.round(occupied.minY)}, ${Math.round(occupied.maxY)}].
NEVER overlap this existing drawing — lay the new diagram out in empty space to the right:
use centerX = ${Math.round(occupied.maxX) + 150} + (your diagram width / 2), start at y = 60.` : ""}

SHAPE TYPES & REQUIRED FIELDS:
• rect     → x1,y1,x2,y2  (fill optional, label optional)
• ellipse  → x1,y1,x2,y2  (fill optional, label optional)
• diamond  → x1,y1,x2,y2  (fill optional, label optional — use for decisions/conditions)
• line     → x1,y1,x2,y2
• arrow    → x1,y1,x2,y2  (arrowhead at x2,y2; label optional for edge text)
• text     → x,y,text,fontSize
• pen      → points:[{x,y},…]  (freehand curve — 6–30 points)

LABEL FIELDS (for rect, ellipse, diamond, arrow):
• label        — text displayed inside/on the shape
• labelFontSize — font size in px (default 14)
• labelColor   — hex color for label text

ARROW BINDING (critical — this is how the frontend keeps arrows attached when nodes move):
- Every id you assign is a temporary id local to this response (e.g. 1, 2, 3, … in creation order).
- Every arrow that connects two nodes MUST set startBinding and endBinding:
  {"shapeId": <the connected node's id>, "anchor": "top"|"right"|"bottom"|"left"}.
  Bound endpoints snap exactly to the node edges — the frontend recomputes them live.
  Still include approximate x1,y1,x2,y2 as a fallback for renderers that ignore bindings.
- Vertical flow: source anchor "bottom", target anchor "top". Side branches: "right" → "left".

STYLE FIELDS (all optional):
• color         — stroke / text color  (hex, e.g. "#38bdf8")
• fill          — interior color or "none"
• strokeWidth   — 1|2|4|8
• opacity       — 0.0–1.0
• rounded       — true/false (rect only)
• roundedRadius — 4–48 (rect + rounded:true)
• rotation      — radians (0 = no rotation)

ID RULE: each shape must have a unique numeric id starting from 1, in the order the shapes are created (this order is used to bind arrows — see ARROW BINDING above).

COLOR RULES (STRICT — no exceptions):
• color      → NEVER set this field. Omit it entirely. The canvas applies a theme-aware ink color automatically.
• fill       → NEVER set this field. Omit it entirely. Shapes must have transparent/no background.
• labelColor → NEVER set this field. Omit it entirely. Labels inherit the theme ink color automatically.
• strokeWidth → 2 for nodes, 1.5 for arrows — this is the ONLY style field you should set.
• opacity    → NEVER set. Omit entirely.
• NEVER output any hex color, rgb(), rgba(), or named color anywhere in the JSON.

FLOWCHART / WORKFLOW RULES (apply when drawing processes, flows, or diagrams):
1. Use rect for process steps, diamond for decisions/conditions, ellipse for start/end nodes.
2. Always set the "label" field on rect/ellipse/diamond — do NOT add separate text shapes for labels.
3. Connect nodes with arrow shapes. Set arrow label for edge text (e.g. "Yes", "No").

LAYOUT & SPACING — STRICT COORDINATE MATH (follow exactly, no exceptions):

Node dimensions:
  rect:    width=220, height=70
  diamond: width=200, height=80
  ellipse: width=180, height=60

Vertical flow layout:
  centerX = Math.floor(canvasWidth / 2)
  nodeX1  = centerX - (nodeWidth / 2)
  nodeX2  = centerX + (nodeWidth / 2)

  Node 1: y1=60,  y2=y1+height
  Node 2: y1=node1.y2+100, y2=y1+height
  Node 3: y1=node2.y2+100, y2=y1+height
  ... and so on (always prev.y2 + 100)

Arrow connecting two vertically stacked nodes:
  x1 = centerX   (same as centerX above)
  y1 = sourceNode.y2          ← exact bottom edge of source
  x2 = centerX
  y2 = targetNode.y1          ← exact top edge of target
  Arrow MUST start exactly at source bottom and end exactly at target top — no gap, no overlap.

Decision diamond with Yes/No branches:
  "Yes" arrow: straight down from diamond center-bottom → next node center-top (same centerX)
  "No" arrow:  x1=diamond.x2, y1=(diamond.y1+diamond.y2)/2, x2=x1+220, y2=y1
               then a rect at x1=x1+220, y1=y1-35, x2=x1+220, y2=y1+35

CONCRETE WORKED EXAMPLE for canvasWidth=1200, 3 nodes (ids are creation order, arrows bound to them):
  centerX=600
  Node1 (ellipse) id=1: x1=510,y1=60,x2=690,y2=120   label="Start"
  Arrow  id=2: x1=600,y1=120,x2=600,y2=220  startBinding={shapeId:1,anchor:"bottom"}  endBinding={shapeId:3,anchor:"top"}
  Node2 (rect) id=3:    x1=490,y1=220,x2=710,y2=290   label="Process"
  Arrow  id=4: x1=600,y1=290,x2=600,y2=390  startBinding={shapeId:3,anchor:"bottom"}  endBinding={shapeId:5,anchor:"top"}
  Node3 (ellipse) id=5: x1=510,y1=390,x2=690,y2=450   label="End"

GENERAL DESIGN RULES:
1. Use the full canvas height — spread nodes across it, don't cluster at top.
2. Keep diagram readable: 5–12 nodes ideal, no more than 16.
3. Never let any two shapes share overlapping coordinate ranges.

OUTPUT FORMAT: Return ONLY a JSON object with a "shapes" key containing an array of shape objects — no markdown, no explanation. Do NOT include color, fill, labelColor, or opacity fields anywhere.
Example: {"shapes":[{"id":1,"type":"ellipse","x1":500,"y1":80,"x2":700,"y2":140,"strokeWidth":2,"label":"Start"},{"id":2,"type":"arrow","x1":600,"y1":140,"x2":600,"y2":240,"strokeWidth":1.5,"startBinding":{"shapeId":1,"anchor":"bottom"},"endBinding":{"shapeId":3,"anchor":"top"}},{"id":3,"type":"rect","x1":500,"y1":240,"x2":700,"y2":310,"strokeWidth":2,"label":"Process Step","rounded":true,"roundedRadius":6}]}
`.trim();
}



export const generateShapesTool = tool(
    async ({ prompt, style, canvasWidth, canvasHeight, existingShapeCount }) => {
        
        
        return JSON.stringify({
            prompt,
            style,
            canvasWidth:  canvasWidth  ?? 1200,
            canvasHeight: canvasHeight ?? 800,
            existingShapeCount: existingShapeCount ?? 0,
            systemPrompt: buildSystemPrompt(canvasWidth ?? 1200, canvasHeight ?? 800),
        });
    },
    {
        name: "generate_shapes",
        description: `
Generates a list of canvas drawing shapes (rect, ellipse, diamond, line, arrow, text, pen)
from a natural language description. Call this when the user wants to draw, create, 
visualise, or design something on the canvas.
        `.trim(),
        schema: z.object({
            prompt: z.string().describe(
                "Detailed description of what to draw. Include layout, elements, colors, style."
            ),
            style: z.enum(["vibrant","pastel","neutral","neon","mono","auto"]).default("auto").describe(
                "Color palette style. Use 'auto' to let the system decide from the prompt."
            ),
            canvasWidth:  z.number().optional().describe("Canvas width in px (default 1200)"),
            canvasHeight: z.number().optional().describe("Canvas height in px (default 800)"),
            existingShapeCount: z.number().optional().describe(
                "Number of shapes already on the canvas — used to assign unique IDs."
            ),
        }),
    }
);



export const describeDrawingTool = tool(
    async ({ shapes }) => {
        
        const counts: Record<string, number> = {};
        for (const s of shapes) counts[s.type] = (counts[s.type] ?? 0) + 1;
        const typeSummary = Object.entries(counts).map(([t, n]) => `${n} ${t}(s)`).join(", ");
        const colors = [...new Set(shapes.map((s: any) => s.color).filter(Boolean))].slice(0, 6);
        return JSON.stringify({
            totalShapes: shapes.length,
            types: typeSummary,
            dominantColors: colors,
            summary: `The canvas has ${shapes.length} shape(s): ${typeSummary}. Colors used: ${colors.join(", ") || "default"}.`,
        });
    },
    {
        name: "describe_drawing",
        description: "Analyses the current shapes on the canvas and returns a human-readable summary. Useful before adding new shapes so you can maintain consistency.",
        schema: z.object({
            
            shapes: z.array(z.record(z.string(), z.any())).describe(
                "The shapes array currently on the canvas. Pass it as a JSON array, NOT as a string."
            ),
        }),
    }
);



export const suggestDrawingIdeasTool = tool(
    async ({ topic, count }) => {
        const ideas: Record<string, string[]> = {
            flowchart:    ["User login flow","Order processing pipeline","CI/CD pipeline","API request lifecycle","Database query flow"],
            architecture: ["Microservices architecture","Client-server diagram","Event-driven system","Layered architecture","Cloud deployment"],
            mindmap:      ["Project brainstorm","Feature planning","Team org chart","Learning roadmap","Product strategy"],
            diagram:      ["Network topology","Database ER diagram","Component relationships","State machine","Class hierarchy"],
            art:          ["Abstract geometric pattern","Night cityscape","Solar system","Mountain landscape","Circuit board art"],
            ui:           ["Login screen wireframe","Dashboard layout","Mobile app flow","Landing page hero","Navigation structure"],
        };
        const allIdeas = Object.entries(ideas)
            .flatMap(([cat, items]) => items.map(i => ({ category: cat, idea: i })));
        const filtered = topic
            ? allIdeas.filter(i => i.category === topic || i.idea.toLowerCase().includes(topic.toLowerCase()))
            : allIdeas;
        const selected = filtered.slice(0, count ?? 5);
        return JSON.stringify({ suggestions: selected });
    },
    {
        name: "suggest_drawing_ideas",
        description: "Returns creative drawing ideas when the user is unsure what to draw. Useful for onboarding or inspiration prompts.",
        schema: z.object({
            topic: z.string().optional().describe("Optional topic filter e.g. 'flowchart', 'architecture', 'art'"),
            count: z.number().optional().default(5).describe("Number of ideas to return (default 5)"),
        }),
    }
);



export const transformShapesTool = tool(
    async ({ shapes, operation, value }) => {
        
        const transformed = shapes.map((s: any) => {
            switch (operation) {
                case "recolor":
                    return { ...s, color: value };
                case "opacity":
                    return { ...s, opacity: parseFloat(value) };
                case "scale": {
                    const factor = parseFloat(value);
                    if (s.type === "text")
                        return { ...s, x: (s.x ?? 0) * factor, y: (s.y ?? 0) * factor };
                    if (s.points)
                        return { ...s, points: s.points.map((p: any) => ({ x: p.x * factor, y: p.y * factor })) };
                    return { ...s, x1:(s.x1??0)*factor, y1:(s.y1??0)*factor, x2:(s.x2??0)*factor, y2:(s.y2??0)*factor };
                }
                case "rotate": {
                    const angle = parseFloat(value);
                    return { ...s, rotation: ((s.rotation ?? 0) + angle) % (Math.PI * 2) };
                }
                default:
                    return s;
            }
        });

        return JSON.stringify(transformed);
    },
    {
        name: "transform_shapes",
        description: "Applies a bulk transformation (recolor, opacity, scale, rotate) to all shapes on the canvas.",
        schema: z.object({
            
            shapes: z.array(z.record(z.string(), z.any())).describe(
                "The shapes array from the canvas. Pass as a JSON array, NOT as a string."
            ),
            operation: z.enum(["recolor","opacity","scale","rotate"]).describe("Transformation to apply."),
            value: z.string().describe(
                "recolor → hex color | opacity → 0.0-1.0 | scale → factor e.g. '1.5' | rotate → radians e.g. '0.785'"
            ),
        }),
    }
);



export const getCurrentDateTimeTool = tool(
    async () => {
        const now = new Date();
        return {
            iso:       now.toISOString(),
            locale:    now.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
            timestamp: now.getTime(),
        };
    },
    {
        name: "get_current_datetime",
        description: "ALWAYS use this tool when user asks about current date, time, today, or now.",
        schema: z.object({}),
    }
);





const DIAGRAM_TYPES = [
    "flowchart",
    "sequence",
    "usecase",
    "class",
    "state",
    "er",
    "gantt",
    "mindmap",
    "timeline",
    "gitgraph",
] as const;

type DiagramType = typeof DIAGRAM_TYPES[number];


const DIAGRAM_STARTERS: Record<DiagramType, string> = {
    flowchart: "flowchart TD",
    sequence:  "sequenceDiagram",
    usecase:   "flowchart LR\n  actor User\n  actor System",
    class:     "classDiagram",
    state:     "stateDiagram-v2",
    er:        "erDiagram",
    gantt:     "gantt\n  dateFormat YYYY-MM-DD",
    mindmap:   "mindmap\n  root((Topic))",
    timeline:  "timeline",
    gitgraph:  "gitGraph",
};

function buildDiagramPrompt(command: string, type: DiagramType): string {
    return `
You are an expert software architect and diagram specialist.
Generate a valid Mermaid diagram for the following request.

DIAGRAM TYPE: ${type}
MERMAID STARTER SYNTAX: ${DIAGRAM_STARTERS[type]}

RULES:
1. Output ONLY raw Mermaid syntax — no markdown fences, no explanation, no comments.
2. The first line must be the correct Mermaid diagram keyword (e.g. "flowchart TD", "sequenceDiagram", etc.).
3. Use meaningful, real-world labels — not "Node1", "A", "B".
4. Keep diagrams readable: 6–20 nodes/entities is ideal.
5. For UML use-case: represent actors on the left, use cases in the centre, system boundary as a rectangle label.
6. For sequence diagrams: use "participant", "->>" for sync calls, "-->>>" for async returns.
7. For ER diagrams: always include relationship cardinality (||--o{, }|--|{, etc.).
8. For class diagrams: include fields, methods, and relationship arrows (+, -, #).
9. For Gantt: use realistic task names and sensible durations.
10. For state diagrams: include [*] for start/end states.

REQUEST: ${command}
`.trim();
}

export const generateDiagramTool = tool(
    async ({ command, type, autoDetect }) => {
        
        let resolvedType: DiagramType = type ?? "flowchart";

        if (autoDetect || !type) {
            const cmd = command.toLowerCase();
            if (cmd.includes("sequence") || cmd.includes("api call") || cmd.includes("request") || cmd.includes("response"))
                resolvedType = "sequence";
            else if (cmd.includes("use case") || cmd.includes("usecase") || cmd.includes("actor"))
                resolvedType = "usecase";
            else if (cmd.includes("class") || cmd.includes("inheritance") || cmd.includes("interface") || cmd.includes("object"))
                resolvedType = "class";
            else if (cmd.includes("state") || cmd.includes("transition") || cmd.includes("status"))
                resolvedType = "state";
            else if (cmd.includes("entity") || cmd.includes(" er ") || cmd.includes("database") || cmd.includes("schema") || cmd.includes("relation"))
                resolvedType = "er";
            else if (cmd.includes("gantt") || cmd.includes("timeline") || cmd.includes("schedule") || cmd.includes("sprint") || cmd.includes("roadmap"))
                resolvedType = "gantt";
            else if (cmd.includes("mind map") || cmd.includes("mindmap") || cmd.includes("brainstorm"))
                resolvedType = "mindmap";
            else if (cmd.includes("git") || cmd.includes("branch") || cmd.includes("merge") || cmd.includes("commit"))
                resolvedType = "gitgraph";
            else if (cmd.includes("flow") || cmd.includes("process") || cmd.includes("step") || cmd.includes("decision"))
                resolvedType = "flowchart";
        }

        return JSON.stringify({
            command,
            resolvedType,
            diagramPrompt: buildDiagramPrompt(command, resolvedType),
            starter:       DIAGRAM_STARTERS[resolvedType],
        });
    },
    {
        name: "generate_diagram",
        description: `
Generates a text-based Mermaid diagram (NOT canvas shapes) from a natural-language command.
Use this for: UML class diagrams, sequence diagrams, use-case diagrams, ER diagrams,
state machines, Gantt charts, mind maps, git graphs, and flowcharts.
Returns a prompt spec — the agent layer calls the LLM to produce the final Mermaid syntax.
        `.trim(),
        schema: z.object({
            command: z.string().describe(
                "Natural language description of the diagram to generate. E.g. 'Draw a UML sequence diagram for user login with JWT'"
            ),
            type: z.enum(DIAGRAM_TYPES).optional().describe(
                "Explicit diagram type. If omitted, auto-detected from the command."
            ),
            autoDetect: z.boolean().optional().default(true).describe(
                "Auto-detect diagram type from keywords in the command (default true)."
            ),
        }),
    }
);



export const ALL_DRAWING_TOOLS = [
    generateShapesTool,
    describeDrawingTool,
    suggestDrawingIdeasTool,
    transformShapesTool,
    getCurrentDateTimeTool,
    generateDiagramTool,
];

export { buildSystemPrompt, PALETTE };