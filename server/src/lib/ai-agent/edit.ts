import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

const openaiEdit = new ChatOpenAI({
    model: "gpt-4o-mini",
    apiKey: process.env.OPENAI_API_KEY,
    temperature: 0.2,
    timeout: 45_000,
    modelKwargs: {
        response_format: { type: "json_object" },
    },
});

const PointSchema = z.object({ x: z.number(), y: z.number() });

const BindingSchema = z.object({
    shapeId: z.union([z.number(), z.string()]),
    anchor: z.enum(["top", "right", "bottom", "left", "center"]),
});

// Superset of the client DrawShape — unknown keys are stripped by zod.
const EditShapeSchema = z.object({
    id:            z.union([z.number(), z.string()]).optional(),
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

const ChangesSchema = EditShapeSchema.omit({ id: true, type: true }).partial();

const OperationSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("create"), shape: EditShapeSchema }),
    z.object({ type: z.literal("update"), id: z.union([z.number(), z.string()]), changes: ChangesSchema }),
    z.object({ type: z.literal("delete"), id: z.union([z.number(), z.string()]) }),
]);

export type EditOperation = z.infer<typeof OperationSchema>;

const EditResponseSchema = z.object({
    message: z.string().catch("Here are the suggested edits."),
    operations: z.array(z.unknown()).catch([]),
});

export interface EditCanvasMeta {
    width: number;
    height: number;
    background?: string;
    zoom?: number;
    selectedShapeIds?: Array<number | string>;
}

export interface EditAgentInput {
    instruction: string;
    shapes: Array<Record<string, unknown>>;
    canvas: EditCanvasMeta;
}

export interface EditAgentResult {
    message: string;
    operations: EditOperation[];
    /** ops the model returned that failed validation and were discarded */
    dropped: number;
}

const MAX_OPERATIONS = 100;

type Box = { minX: number; minY: number; maxX: number; maxY: number };

function shapeBounds(s: Record<string, unknown>): Box | null {
    const xs: number[] = [], ys: number[] = [];
    const push = (x: unknown, y: unknown) => {
        if (typeof x === "number") xs.push(x);
        if (typeof y === "number") ys.push(y);
    };
    push(s.x, s.y); push(s.x1, s.y1); push(s.x2, s.y2);
    if (Array.isArray(s.points)) for (const p of s.points) push(p?.x, p?.y);
    if (!xs.length || !ys.length) return null;
    return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

function collectBounds(shapes: Array<Record<string, unknown>>): Box | null {
    let out: Box | null = null;
    for (const s of shapes) {
        const b = shapeBounds(s);
        if (!b) continue;
        out = out
            ? { minX: Math.min(out.minX, b.minX), minY: Math.min(out.minY, b.minY), maxX: Math.max(out.maxX, b.maxX), maxY: Math.max(out.maxY, b.maxY) }
            : b;
    }
    return out;
}

const boxesIntersect = (a: Box, b: Box) =>
    !(a.maxX < b.minX || b.maxX < a.minX || a.maxY < b.minY || b.maxY < a.minY);

function shiftShape(s: Record<string, unknown>, dx: number) {
    for (const k of ["x", "x1", "x2"] as const) {
        if (typeof s[k] === "number") s[k] = (s[k] as number) + dx;
    }
    if (Array.isArray(s.points)) {
        s.points = s.points.map((p) =>
            p && typeof p.x === "number" ? { ...p, x: p.x + dx } : p);
    }
}

function buildEditSystemPrompt(canvas: EditCanvasMeta, shapeCount: number, occupied: Box | null): string {
    const selected = canvas.selectedShapeIds?.length
        ? `SELECTED SHAPE IDS (the user may refer to "this"/"selected"): ${JSON.stringify(canvas.selectedShapeIds)}`
        : "No shapes are currently selected.";
    return `
You are an expert diagram artist editing a drawing on a canvas via patch operations.
Never rewrite shapes that don't need to change — but creating new content is fully in
scope: if the canvas is empty (or the user asks to design/draw something new), build the
ENTIRE requested drawing with "create" operations. Never refuse because the canvas is
empty or "too basic".

CANVAS: ${canvas.width} × ${canvas.height} px, origin top-left (0,0), x grows right, y grows down.
Current zoom: ${canvas.zoom ?? 1}. Shapes on canvas: ${shapeCount}.
${selected}
${occupied ? `
OCCUPIED SPACE: existing shapes span x ∈ [${Math.round(occupied.minX)}, ${Math.round(occupied.maxX)}], y ∈ [${Math.round(occupied.minY)}, ${Math.round(occupied.maxY)}].
- If the user asks for a NEW / separate diagram, NEVER overlap the existing shapes:
  lay it out in empty space to the right — use centerX = ${Math.round(occupied.maxX) + 150} + (your diagram width / 2), start at y = 60.
- If the user asks to modify or extend the existing diagram, work within the occupied area as usual.` : ""}

SHAPE TYPES & GEOMETRY FIELDS:
• rect / ellipse / diamond → x1,y1,x2,y2 (diamond = decisions, ellipse = start/end, rect = steps)
• line / arrow → x1,y1,x2,y2 (arrowhead at x2,y2)
• text → x,y,text,fontSize
• pen → points:[{x,y},…]
Node labels live in the "label" field on rect/ellipse/diamond/arrow (labelFontSize default 14).
Arrows may have startBinding/endBinding: { "shapeId": <id>, "anchor": "top"|"right"|"bottom"|"left" } to attach to a node.

SUPPORTED OPERATIONS (this is the ONLY output vocabulary):
1. {"type":"update","id":<existing shape id>,"changes":{<only the fields that change>}}
2. {"type":"create","shape":{<full shape object with a unique temporary id like "n1","a1">}}
3. {"type":"delete","id":<existing shape id>}

CREATED-SHAPE IDS & ARROW BINDING (critical for clean results):
- Give every created shape a unique temporary id (e.g. "n1", "n2", "a1").
- Every created arrow that connects two nodes MUST set startBinding and endBinding
  ({"shapeId": <node id — temporary or existing>, "anchor": "bottom"/"top"/"right"/"left"}).
  Bound endpoints snap exactly to the node edges, so the arrows always look perfect.
  Still include approximate x1,y1,x2,y2 as a fallback.
- Vertical flow: source anchor "bottom", target anchor "top". Side branches: "right" → "left".

STRICT RULES:
- Echo shape ids EXACTLY as they appear in the current shapes JSON.
- "changes" must contain ONLY fields that actually change. Never echo unchanged fields.
- Never duplicate unchanged shapes. Never emit an update whose changes equal current values.
- NEVER set color, fill, labelColor, or opacity — the canvas applies theme colors automatically.
- strokeWidth: 2 for nodes, 1.5 for arrows (only if creating).
- When moving a node, also update any arrow endpoints (x1/y1/x2/y2) that visually connect to it,
  unless the arrow is bound to it via startBinding/endBinding (bound endpoints follow automatically).
- Keep spacing readable: ~100px vertical gap between stacked nodes, no overlapping shapes.
- Max ${MAX_OPERATIONS} operations.

LAYOUT MATH when creating flowcharts/diagrams (follow exactly):
- Node sizes: rect 220×70, diamond 200×80, ellipse 180×60.
- Vertical flow: centerX = ${Math.floor(canvas.width / 2)}; node x1 = centerX - width/2, x2 = centerX + width/2.
  First node y1 = 60; each next node y1 = previous y2 + 100.
- Connect consecutive nodes with an arrow: x1 = centerX, y1 = source y2, x2 = centerX, y2 = target y1
  (exact bottom edge to exact top edge — no gap, no overlap). Put edge text ("Yes"/"No") in the arrow's "label".
- Decision "No" branch: arrow from diamond's right edge going right 220px, then a rect there
  (rect vertically centered on the diamond: rect y1 = diamond centerY - 35, y2 = centerY + 35).
- Use rect for steps, diamond for decisions, ellipse for start/end; set "label" on every node
  (never separate text shapes for node labels).

WORKED EXAMPLE (empty 1200-wide canvas, "start → check → end"):
{"message":"Created the flow.","operations":[
{"type":"create","shape":{"id":"n1","type":"ellipse","x1":510,"y1":60,"x2":690,"y2":120,"label":"Start","strokeWidth":2}},
{"type":"create","shape":{"id":"a1","type":"arrow","x1":600,"y1":120,"x2":600,"y2":220,"strokeWidth":1.5,"startBinding":{"shapeId":"n1","anchor":"bottom"},"endBinding":{"shapeId":"n2","anchor":"top"}}},
{"type":"create","shape":{"id":"n2","type":"diamond","x1":500,"y1":220,"x2":700,"y2":300,"label":"Check OK?","strokeWidth":2}},
{"type":"create","shape":{"id":"a2","type":"arrow","x1":600,"y1":300,"x2":600,"y2":400,"strokeWidth":1.5,"label":"Yes","startBinding":{"shapeId":"n2","anchor":"bottom"},"endBinding":{"shapeId":"n3","anchor":"top"}}},
{"type":"create","shape":{"id":"n3","type":"ellipse","x1":510,"y1":400,"x2":690,"y2":460,"label":"End","strokeWidth":2}}]}
Note the exact math: node2.y1 = node1.y2 + 100; arrows bound bottom→top; every node labelled.

OUTPUT: valid JSON only — no markdown, no explanations outside the JSON:
{"message":"<one short friendly sentence describing what you changed>","operations":[...]}
Only if the instruction is truly impossible (e.g. it references shapes that don't exist)
return {"message":"<why>","operations":[]}.
`.trim();
}

export async function runEditAgent(input: EditAgentInput): Promise<EditAgentResult> {
    const { instruction, shapes, canvas } = input;
    const occupied = collectBounds(shapes);

    const prompt = [
        buildEditSystemPrompt(canvas, shapes.length, occupied),
        "",
        "CURRENT SHAPES (JSON):",
        JSON.stringify(shapes),
        "",
        "USER INSTRUCTION:",
        instruction,
    ].join("\n");

    const result = await openaiEdit.invoke(prompt);
    const rawText =
        typeof result.content === "string"
            ? result.content
            : JSON.stringify(result.content);

    const cleaned = rawText
        .replace(/^```(?:json)?\n?/i, "")
        .replace(/\n?```$/i, "")
        .trim();

    let parsed: unknown;
    try {
        parsed = JSON.parse(cleaned);
    } catch (err) {
        console.error("[EditAgent] AI returned invalid JSON:", err);
        return { message: "The AI response was malformed — please try again.", operations: [], dropped: 0 };
    }

    const envelope = EditResponseSchema.parse(
        parsed && typeof parsed === "object" ? parsed : {},
    );

    const { operations, dropped } = validateOperations(shapes, envelope.operations);

    // Safety net: a brand-new diagram (pure creation) must never land on top of
    // the existing drawing, even if the model ignored the occupied-space rule.
    if (occupied && operations.length >= 3 && operations.every((o) => o.type === "create")) {
        const createdBox = collectBounds(operations.map((o) => (o as { shape: Record<string, unknown> }).shape));
        if (createdBox && boxesIntersect(occupied, createdBox)) {
            const dx = occupied.maxX + 150 - createdBox.minX;
            for (const op of operations) {
                shiftShape((op as { shape: Record<string, unknown> }).shape, dx);
            }
        }
    }

    return { message: envelope.message, operations, dropped };
}

/** Validate each operation independently: one bad op must not discard the rest. */
export function validateOperations(
    shapes: Array<Record<string, unknown>>,
    rawOps: unknown[],
): { operations: EditOperation[]; dropped: number } {
    const existingIds = new Set(shapes.map((s) => String(s.id)));
    const operations: EditOperation[] = [];
    let dropped = 0;

    // Pass 1: parse, and assign server ids to creates (AI temp ids can never
    // collide with existing shapes). Remember temp id → server id for pass 2.
    const idMap = new Map<string, string | number>();
    for (const raw of rawOps.slice(0, MAX_OPERATIONS)) {
        const check = OperationSchema.safeParse(raw);
        if (!check.success) { dropped++; continue; }
        const op = check.data;

        if (op.type === "create") {
            const serverId = `ai-edit-${Date.now()}-${operations.length}`;
            if (op.shape.id != null) idMap.set(String(op.shape.id), serverId);
            op.shape.id = serverId;
            operations.push(op);
            continue;
        }
        if (!existingIds.has(String(op.id))) { dropped++; continue; }
        if (op.type === "update" && Object.keys(op.changes).length === 0) { dropped++; continue; }
        operations.push(op);
    }

    // Pass 2: remap arrow bindings that reference AI temp ids to the assigned
    // server ids; drop bindings pointing at ids that exist nowhere.
    const remapBinding = (b?: z.infer<typeof BindingSchema>) => {
        if (!b) return undefined;
        const key = String(b.shapeId);
        if (idMap.has(key)) return { ...b, shapeId: idMap.get(key)! };
        if (existingIds.has(key)) return b;
        return undefined;
    };
    for (const op of operations) {
        const target = op.type === "create" ? op.shape : op.type === "update" ? op.changes : null;
        if (!target) continue;
        if ("startBinding" in target) target.startBinding = remapBinding(target.startBinding);
        if ("endBinding" in target) target.endBinding = remapBinding(target.endBinding);
    }

    dropped += Math.max(0, rawOps.length - MAX_OPERATIONS);

    return { operations, dropped };
}
