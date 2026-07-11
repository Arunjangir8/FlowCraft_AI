import { drawShape, drawArrowLabel, getBounds, resolveArrowEndpoints, type DrawShape } from "../Drawpad";

export const EXPORT_PADDING = 50;
const EXPORT_BG = "#ffffff";
const EXPORT_INK = "#0b0b0d";

/** Renders every shape (not just the viewport) onto an offscreen canvas: white
 * background, full content bounds, EXPORT_PADDING on all sides. */
export function renderShapesToCanvas(shapes: DrawShape[]): HTMLCanvasElement | null {
    if (!shapes.length) return null;

    // shape.color/labelColor are baked from whatever theme was active when the
    // shape was drawn (see `color: ink` at creation) — not a deliberate per-shape
    // choice. Force them to the export ink so nothing renders white-on-white.
    const resolved = shapes.map(s => {
        const themed = { ...s, color: EXPORT_INK, labelColor: EXPORT_INK };
        if (s.type !== "arrow") return themed;
        const { start, end } = resolveArrowEndpoints(s, shapes);
        return { ...themed, x1: start.x, y1: start.y, x2: end.x, y2: end.y };
    });

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    resolved.forEach(s => {
        const b = getBounds(s);
        minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
    });
    if (!isFinite(minX)) return null;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.ceil(maxX - minX) + EXPORT_PADDING * 2;
    const height = Math.ceil(maxY - minY) + EXPORT_PADDING * 2;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = EXPORT_BG;
    ctx.fillRect(0, 0, width, height);
    ctx.translate(EXPORT_PADDING - minX, EXPORT_PADDING - minY);

    resolved.forEach(s => drawShape(ctx, s, EXPORT_INK));
    resolved.forEach(s => drawArrowLabel(ctx, s, EXPORT_INK, EXPORT_BG));

    return canvas;
}
