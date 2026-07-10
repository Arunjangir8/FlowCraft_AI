import type { DrawShape, Point } from "../Drawpad";

export type AiEditOperation =
    | { type: "create"; shape: DrawShape }
    | { type: "update"; id: number | string; changes: Partial<DrawShape> }
    | { type: "delete"; id: number | string };

export type AiEditResponse = {
    message: string;
    operations: AiEditOperation[];
    dropped?: number;
};

export type AppliedPreview = {
    /** final shapes after all operations — what Accept commits */
    shapes: DrawShape[];
    created: Set<string>;
    updated: Set<string>;
    /** original shapes removed by the edit, kept for ghost rendering */
    deletedShapes: DrawShape[];
};

let _aiUid = Date.now();
const aiUid = () => `ai-edit-local-${++_aiUid}`;

/**
 * Pure patch applier: never mutates the input shapes.
 * Invalid ops (unknown ids, malformed shapes) are silently skipped —
 * AI output is never trusted to be complete or correct.
 */
export function applyOperations(shapes: DrawShape[], ops: AiEditOperation[]): AppliedPreview {
    const byId = new Map<string, DrawShape>(shapes.map(s => [String(s.id), s]));
    const created: DrawShape[] = [];
    const createdIds = new Set<string>();
    const updated = new Set<string>();
    const deleted = new Set<string>();

    for (const op of ops) {
        if (!op || typeof op !== "object") continue;
        if (op.type === "delete") {
            const k = String(op.id);
            if (byId.has(k)) deleted.add(k);
        } else if (op.type === "update") {
            const k = String(op.id);
            const cur = byId.get(k);
            if (!cur || !op.changes || typeof op.changes !== "object") continue;
            // id and type are immutable through updates
            const { id: _id, type: _type, ...changes } = op.changes as Partial<DrawShape>;
            byId.set(k, { ...cur, ...changes });
            updated.add(k);
        } else if (op.type === "create") {
            const s = op.shape;
            if (!s || typeof s !== "object" || !s.type) continue;
            const shape: DrawShape = { ...s, id: s.id ?? aiUid() };
            created.push(shape);
            createdIds.add(String(shape.id));
        }
    }

    const deletedShapes = shapes.filter(s => deleted.has(String(s.id)));

    // Keep original z-order, drop deleted, append creates on top.
    const next: DrawShape[] = [];
    for (const s of shapes) {
        const k = String(s.id);
        if (deleted.has(k)) continue;
        let sh = byId.get(k)!;
        // ponytail: unbind arrows pointing at deleted shapes without re-freezing
        // coords — stored x1/y1 are close enough for AI-laid-out diagrams.
        if (sh.type === "arrow") {
            if (sh.startBinding && deleted.has(String(sh.startBinding.shapeId))) sh = { ...sh, startBinding: undefined };
            if (sh.endBinding && deleted.has(String(sh.endBinding.shapeId))) sh = { ...sh, endBinding: undefined };
        }
        next.push(sh);
    }
    next.push(...created);

    return { shapes: next, created: createdIds, updated, deletedShapes };
}

const LERP_KEYS = ["x", "y", "x1", "y1", "x2", "y2", "rotation", "fontSize"] as const;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function lerpShape(from: DrawShape, to: DrawShape, t: number): DrawShape {
    const out: DrawShape = { ...to };
    for (const k of LERP_KEYS) {
        const a = from[k], b = to[k];
        if (typeof a === "number" && typeof b === "number" && a !== b) out[k] = lerp(a, b, t);
    }
    if (from.points && to.points && from.points.length === to.points.length) {
        out.points = to.points.map((p, i): Point => ({
            x: lerp(from.points![i].x, p.x, t),
            y: lerp(from.points![i].y, p.y, t),
        }));
    }
    return out;
}

/**
 * Shapes to draw at animation progress t (0→1): updated shapes glide from
 * their old geometry to the new one, created shapes fade in.
 */
export function lerpPreviewShapes(
    baseById: Map<string, DrawShape>,
    target: DrawShape[],
    created: Set<string>,
    updated: Set<string>,
    t: number,
): DrawShape[] {
    if (t >= 1) return target;
    return target.map(s => {
        const k = String(s.id);
        if (created.has(k)) return { ...s, opacity: (s.opacity ?? 1) * t };
        if (updated.has(k)) {
            const from = baseById.get(k);
            if (from) return lerpShape(from, s, t);
        }
        return s;
    });
}
