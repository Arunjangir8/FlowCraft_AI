import {
    useState, useRef, useEffect, useCallback,
    type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode
} from "react";
import { useNavigate } from "react-router-dom";


export const TOOLS = {
    SELECT: "select", PAN: "pan", PEN: "pen", ERASER: "eraser",
    LINE: "line", ARROW: "arrow", RECT: "rect", ELLIPSE: "ellipse",
    DIAMOND: "diamond", TEXT: "text",
} as const;

export const BG_BLACK = "#0b0b0d";
export const BG_WHITE = "#ffffff";
export type BgMode = typeof BG_BLACK | typeof BG_WHITE;

export const getInkColor = (bg: string) => (bg === BG_WHITE ? "#0b0b0d" : "#f5f5f7");
export const getMutedInk = (bg: string) => (bg === BG_WHITE ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.6)");

const STROKE_WIDTHS = [1, 2, 4, 8];
let _uid = 0;
export const uid = () => ++_uid;





export type Point = { x: number; y: number };
export type Tool = typeof TOOLS[keyof typeof TOOLS];
export type ShapeType = "pen" | "eraser" | "line" | "arrow" | "rect" | "ellipse" | "diamond" | "text";
type SelMode = "move" | "rotate" | "resize" | "arrow-endpoint";
type ResizeHandle = "tl" | "tr" | "bl" | "br";
type ArrowEndpointHandle = "start" | "end";

export type AnchorSide = "top" | "right" | "bottom" | "left" | "center";
export type ArrowBinding = { shapeId: number | string; anchor: AnchorSide };

export type DrawShape = {
    id: number | string;
    type: ShapeType;
    points?: Point[];
    x?: number; y?: number;
    text?: string; fontSize?: number;
    x1?: number; y1?: number; x2?: number; y2?: number;
    color?: string; strokeWidth?: number; fill?: string;
    opacity?: number; rounded?: boolean; roundedRadius?: number; rotation?: number;

    
    label?: string;
    labelFontSize?: number;
    labelColor?: string;

    
    startBinding?: ArrowBinding;
    endBinding?: ArrowBinding;
};

type Bounds = { x: number; y: number; w: number; h: number };
type DrawStateRef = {
    shapes: DrawShape[]; zoom: number; pan: Point;
    selectedId: number | string | null; selectedIds: Set<number | string>;
    editingTextId: number | string | null; editingLabelId: number | string | null;
};

export interface DrawingPadProps {
    shapes: DrawShape[];
    setShapes: React.Dispatch<React.SetStateAction<DrawShape[]>>;
    bgColor: string;
    setBgColor: (c: string) => void;
    zoom: number;
    setZoom: React.Dispatch<React.SetStateAction<number>>;
    pan: Point;
    setPan: React.Dispatch<React.SetStateAction<Point>>;
    onSave: () => Promise<void>;
    onSync: () => Promise<void>;
    savedToast: boolean;
    hasLocalCache: boolean;
}





export function getBounds(shape: DrawShape): Bounds {
    if (shape.type === "pen" || shape.type === "eraser") {
        if (!shape.points?.length) return { x: 0, y: 0, w: 4, h: 4 };
        const sw = shape.type === "eraser" ? (shape.strokeWidth ?? 2) * 3 : (shape.strokeWidth ?? 2) / 2;
        const xs = shape.points.map(p => p.x);
        const ys = shape.points.map(p => p.y);
        const minX = Math.min(...xs) - sw, maxX = Math.max(...xs) + sw;
        const minY = Math.min(...ys) - sw, maxY = Math.max(...ys) + sw;
        return { x: minX, y: minY, w: Math.max(maxX - minX, 4), h: Math.max(maxY - minY, 4) };
    }
    if (shape.type === "text") {
        const fs = shape.fontSize || 18;
        return { x: shape.x ?? 0, y: (shape.y ?? 0) - fs, w: Math.max((shape.text?.length || 1) * fs * 0.6, 20), h: fs + 6 };
    }
    const x1 = shape.x1 ?? 0, y1 = shape.y1 ?? 0, x2 = shape.x2 ?? 0, y2 = shape.y2 ?? 0;
    return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.max(Math.abs(x2 - x1), 4), h: Math.max(Math.abs(y2 - y1), 4) };
}

export function getCenter(shape: DrawShape): Point {
    const b = getBounds(shape); return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

export function rotPt(px: number, py: number, cx: number, cy: number, angle: number): Point {
    const cos = Math.cos(angle), sin = Math.sin(angle);
    return { x: cx + cos * (px - cx) - sin * (py - cy), y: cy + sin * (px - cx) + cos * (py - cy) };
}

function getRotHandlePos(shape: DrawShape): Point {
    const b = getBounds(shape), c = getCenter(shape);
    return rotPt(c.x, b.y - 34, c.x, c.y, shape.rotation || 0);
}

function getResizeHandleHit(shape: DrawShape, px: number, py: number, zoom: number): ResizeHandle | null {
    const b = getBounds(shape), c = getCenter(shape), rot = shape.rotation || 0;
    const lp = rotPt(px, py, c.x, c.y, -rot);
    const pad = 12, hw = 14 / zoom;
    const corners: [ResizeHandle, number, number][] = [
        ["tl", b.x - pad, b.y - pad],
        ["tr", b.x + b.w + pad, b.y - pad],
        ["bl", b.x - pad, b.y + b.h + pad],
        ["br", b.x + b.w + pad, b.y + b.h + pad],
    ];
    for (const [handle, hx, hy] of corners) {
        if (Math.abs(lp.x - hx) <= hw && Math.abs(lp.y - hy) <= hw) return handle;
    }
    return null;
}

function resizeShape(orig: DrawShape, handle: ResizeHandle, localPos: Point): DrawShape {
    if (orig.type === "pen" || orig.type === "eraser" || orig.type === "text") return orig;
    const b = getBounds(orig);
    let nx1 = b.x, ny1 = b.y, nx2 = b.x + b.w, ny2 = b.y + b.h;
    if (handle === "tl") { nx1 = localPos.x; ny1 = localPos.y; }
    else if (handle === "tr") { nx2 = localPos.x; ny1 = localPos.y; }
    else if (handle === "bl") { nx1 = localPos.x; ny2 = localPos.y; }
    else if (handle === "br") { nx2 = localPos.x; ny2 = localPos.y; }
    if (Math.abs(nx2 - nx1) < 8) { if (handle === "tl" || handle === "bl") nx1 = nx2 - 8; else nx2 = nx1 + 8; }
    if (Math.abs(ny2 - ny1) < 8) { if (handle === "tl" || handle === "tr") ny1 = ny2 - 8; else ny2 = ny1 + 8; }
    return { ...orig, x1: nx1, y1: ny1, x2: nx2, y2: ny2 };
}

export function moveShape(shape: DrawShape, dx: number, dy: number): DrawShape {
    if (shape.type === "pen" || shape.type === "eraser")
        return { ...shape, points: (shape.points ?? []).map(p => ({ x: p.x + dx, y: p.y + dy })) };
    if (shape.type === "text") return { ...shape, x: (shape.x ?? 0) + dx, y: (shape.y ?? 0) + dy };
    return { ...shape, x1: (shape.x1 ?? 0) + dx, y1: (shape.y1 ?? 0) + dy, x2: (shape.x2 ?? 0) + dx, y2: (shape.y2 ?? 0) + dy };
}

function boundsIntersect(a: Bounds, b: Bounds): boolean {
    return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
}

function applyShapeRotation(ctx: CanvasRenderingContext2D, shape: DrawShape) {
    if (!shape.rotation) return;
    const c = getCenter(shape);
    ctx.translate(c.x, c.y); ctx.rotate(shape.rotation); ctx.translate(-c.x, -c.y);
}

function distToSegment(p: Point, a: Point, b: Point): number {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}





export function isLabelEditableShape(s: DrawShape): boolean {
    return s.type === "rect" || s.type === "ellipse" || s.type === "diamond" || s.type === "arrow";
}

export function getShapeLabelBox(shape: DrawShape): Bounds {
    if (shape.type === "arrow") {
        const seg = getArrowMidSegmentResolved(shape);
        const mx = (seg.a.x + seg.b.x) / 2, my = (seg.a.y + seg.b.y) / 2;
        const fs = shape.labelFontSize ?? 14;
        const lines = (shape.label ?? "").split("\n");
        const longest = Math.max(...lines.map(l => l.length), 4);
        const w = Math.max(longest * fs * 0.6 + 12, 50);
        const h = Math.max(lines.length, 1) * fs * 1.3 + 6;
        return { x: mx - w / 2, y: my - h / 2, w, h };
    }
    const b = getBounds(shape);
    if (shape.type === "diamond") {
        return { x: b.x + b.w * 0.22, y: b.y + b.h * 0.3, w: b.w * 0.56, h: b.h * 0.4 };
    }
    const padX = Math.max(8, b.w * 0.08);
    const padY = Math.max(6, b.h * 0.08);
    return { x: b.x + padX, y: b.y + padY, w: Math.max(b.w - padX * 2, 10), h: Math.max(b.h - padY * 2, 10) };
}

function drawShapeLabelInner(ctx: CanvasRenderingContext2D, shape: DrawShape, ink: string) {
    if (!shape.label) return;
    const box = getShapeLabelBox(shape);
    const fs = shape.labelFontSize ?? 14;
    ctx.save();
    ctx.fillStyle = shape.labelColor ?? ink;
    ctx.globalAlpha = shape.opacity ?? 1;
    ctx.font = `${fs}px -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const lines = shape.label.split("\n");
    const cx = box.x + box.w / 2;
    const totalH = lines.length * fs * 1.3;
    let y = box.y + box.h / 2 - totalH / 2 + fs * 0.65;
    for (const line of lines) { ctx.fillText(line, cx, y); y += fs * 1.3; }
    ctx.restore();
}





export function getShapeAnchorPoints(shape: DrawShape): Record<AnchorSide, Point> {
    const b = getBounds(shape);
    const c = getCenter(shape);
    const raw: Record<AnchorSide, Point> = {
        top: { x: b.x + b.w / 2, y: b.y },
        right: { x: b.x + b.w, y: b.y + b.h / 2 },
        bottom: { x: b.x + b.w / 2, y: b.y + b.h },
        left: { x: b.x, y: b.y + b.h / 2 },
        center: { x: c.x, y: c.y },
    };
    const rot = shape.rotation || 0;
    if (!rot) return raw;
    const out = {} as Record<AnchorSide, Point>;
    (Object.keys(raw) as AnchorSide[]).forEach(k => { out[k] = rotPt(raw[k].x, raw[k].y, c.x, c.y, rot); });
    return out;
}

export function getNearestAnchor(shape: DrawShape, p: Point, threshold = 28): { anchor: AnchorSide; point: Point } | null {
    if (shape.type !== "rect" && shape.type !== "ellipse" && shape.type !== "diamond") return null;
    const anchors = getShapeAnchorPoints(shape);
    let bestAnchor: AnchorSide | null = null;
    let bestPoint: Point | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    (Object.keys(anchors) as AnchorSide[]).forEach(k => {
        if (k === "center") return;
        const d = Math.hypot(p.x - anchors[k].x, p.y - anchors[k].y);
        if (d < bestDistance) {
            bestAnchor = k;
            bestPoint = anchors[k];
            bestDistance = d;
        }
    });
    if (bestAnchor === null || bestPoint === null || bestDistance > threshold) return null;
    return { anchor: bestAnchor, point: bestPoint };
}

export function findBindingTarget(shapes: DrawShape[], p: Point, excludeId?: number | string): { shape: DrawShape; anchor: AnchorSide; point: Point } | null {
    for (let i = shapes.length - 1; i >= 0; i--) {
        const s = shapes[i];
        if (s.id === excludeId) continue;
        const hit = getNearestAnchor(s, p);
        if (hit) return { shape: s, anchor: hit.anchor, point: hit.point };
    }
    return null;
}

export function resolveArrowEndpoints(arrow: DrawShape, all: DrawShape[]): { start: Point; end: Point } {
    let start: Point = { x: arrow.x1 ?? 0, y: arrow.y1 ?? 0 };
    let end: Point = { x: arrow.x2 ?? 0, y: arrow.y2 ?? 0 };
    if (arrow.startBinding) {
        const s = all.find(sh => sh.id === arrow.startBinding!.shapeId);
        if (s) start = getShapeAnchorPoints(s)[arrow.startBinding.anchor];
    }
    if (arrow.endBinding) {
        const s = all.find(sh => sh.id === arrow.endBinding!.shapeId);
        if (s) end = getShapeAnchorPoints(s)[arrow.endBinding.anchor];
    }
    return { start, end };
}


function anchorDirection(side?: AnchorSide): Point | null {
    switch (side) {
        case "left": return { x: -1, y: 0 };
        case "right": return { x: 1, y: 0 };
        case "top": return { x: 0, y: -1 };
        case "bottom": return { x: 0, y: 1 };
        default: return null;
    }
}


function simplifyOrthogonal(pts: Point[]): Point[] {
    if (pts.length < 3) return pts;
    const out: Point[] = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
        const a = out[out.length - 1], b = pts[i], c = pts[i + 1];
        const collinear = (a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y);
        if (!collinear) out.push(b);
    }
    out.push(pts[pts.length - 1]);
    
    return out.filter((p, i) => i === 0 || p.x !== out[i - 1].x || p.y !== out[i - 1].y);
}


export function buildOrthogonalPath(start: Point, end: Point, opts?: {
    startSide?: AnchorSide; endSide?: AnchorSide;
}): Point[] {
    const NEAR = 0.5;
    const dx = end.x - start.x, dy = end.y - start.y;

    const sDir = anchorDirection(opts?.startSide);
    const eDir = anchorDirection(opts?.endSide);

    
    if (!sDir && !eDir) {
        if (Math.abs(dx) < NEAR) return [start, { x: start.x, y: end.y }];
        if (Math.abs(dy) < NEAR) return [start, { x: end.x, y: start.y }];
        const horizontalFirst = Math.abs(dx) >= Math.abs(dy);
        const bend = horizontalFirst ? { x: end.x, y: start.y } : { x: start.x, y: end.y };
        return simplifyOrthogonal([start, bend, end]);
    }

    
    const STUB = 24; 
    const CLEAR = 60; 

    
    const sd: Point = sDir ?? { x: Math.sign(dx) || 1, y: 0 };
    const ed: Point = eDir ?? { x: -(Math.sign(dx) || 1), y: 0 };

    
    const sStub: Point = { x: start.x + sd.x * STUB, y: start.y + sd.y * STUB };
    const eStub: Point = { x: end.x + ed.x * STUB, y: end.y + ed.y * STUB };

    const sHorizontal = sd.y === 0;       
    const eHorizontal = ed.y === 0;       

    let mid: Point[] = [];

    if (sHorizontal && eHorizontal) {
        if (sd.x !== ed.x) { 
            if ((eStub.x - sStub.x) * sd.x > 0) { 
                mid = [sStub, { x: (sStub.x + eStub.x) / 2, y: sStub.y }, { x: (sStub.x + eStub.x) / 2, y: eStub.y }, eStub];
            } else { 
                const safeY = Math.min(sStub.y, eStub.y) - CLEAR;
                mid = [sStub, { x: sStub.x, y: safeY }, { x: eStub.x, y: safeY }, eStub];
            }
        } else { 
            const safeX = sd.x > 0 ? Math.max(sStub.x, eStub.x) + STUB : Math.min(sStub.x, eStub.x) - STUB;
            mid = [sStub, { x: safeX, y: sStub.y }, { x: safeX, y: eStub.y }, eStub];
        }
    } else if (!sHorizontal && !eHorizontal) {
        if (sd.y !== ed.y) {
            if ((eStub.y - sStub.y) * sd.y > 0) {
                mid = [sStub, { x: sStub.x, y: (sStub.y + eStub.y) / 2 }, { x: eStub.x, y: (sStub.y + eStub.y) / 2 }, eStub];
            } else {
                const safeX = Math.min(sStub.x, eStub.x) - CLEAR;
                mid = [sStub, { x: safeX, y: sStub.y }, { x: safeX, y: eStub.y }, eStub];
            }
        } else {
            const safeY = sd.y > 0 ? Math.max(sStub.y, eStub.y) + STUB : Math.min(sStub.y, eStub.y) - STUB;
            mid = [sStub, { x: sStub.x, y: safeY }, { x: eStub.x, y: safeY }, eStub];
        }
    } else {
        
        if (sHorizontal) { 
            const hGood = (eStub.x - sStub.x) * sd.x >= 0;
            const vGood = (sStub.y - eStub.y) * ed.y >= 0;
            if (hGood && vGood) {
                mid = [sStub, { x: eStub.x, y: sStub.y }, eStub];
            } else if (!hGood && vGood) {
                const safeY = ed.y > 0 ? eStub.y + CLEAR : eStub.y - CLEAR;
                mid = [sStub, { x: sStub.x, y: safeY }, { x: eStub.x, y: safeY }, eStub];
            } else if (hGood && !vGood) {
                const safeX = sd.x > 0 ? sStub.x + CLEAR : sStub.x - CLEAR;
                mid = [sStub, { x: safeX, y: sStub.y }, { x: safeX, y: eStub.y }, eStub];
            } else {
                const safeY = ed.y > 0 ? eStub.y + CLEAR : eStub.y - CLEAR;
                mid = [sStub, { x: sStub.x, y: safeY }, { x: eStub.x, y: safeY }, eStub];
            }
        } else { 
            const vGood = (eStub.y - sStub.y) * sd.y >= 0;
            const hGood = (sStub.x - eStub.x) * ed.x >= 0;
            if (vGood && hGood) {
                mid = [sStub, { x: sStub.x, y: eStub.y }, eStub];
            } else if (!vGood && hGood) {
                const safeX = ed.x > 0 ? eStub.x + CLEAR : eStub.x - CLEAR;
                mid = [sStub, { x: safeX, y: sStub.y }, { x: safeX, y: eStub.y }, eStub];
            } else if (vGood && !hGood) {
                const safeY = sd.y > 0 ? sStub.y + CLEAR : sStub.y - CLEAR;
                mid = [sStub, { x: sStub.x, y: safeY }, { x: eStub.x, y: safeY }, eStub];
            } else {
                const safeX = ed.x > 0 ? eStub.x + CLEAR : eStub.x - CLEAR;
                mid = [sStub, { x: safeX, y: sStub.y }, { x: safeX, y: eStub.y }, eStub];
            }
        }
    }

    return simplifyOrthogonal([start, ...mid, end]);
}

export function getArrowPath(arrow: DrawShape, all: DrawShape[]): Point[] {
    const { start, end } = resolveArrowEndpoints(arrow, all);
    return buildOrthogonalPath(start, end, {
        startSide: arrow.startBinding?.anchor,
        endSide: arrow.endBinding?.anchor,
    });
}


function getArrowMidSegmentFromPath(path: Point[]): { a: Point; b: Point } {
    if (path.length < 2) return { a: { x: 0, y: 0 }, b: { x: 0, y: 0 } };
    
    let best = { a: path[0], b: path[1], len: Math.hypot(path[1].x - path[0].x, path[1].y - path[0].y) };
    for (let i = 1; i < path.length - 1; i++) {
        const l = Math.hypot(path[i + 1].x - path[i].x, path[i + 1].y - path[i].y);
        if (l > best.len) best = { a: path[i], b: path[i + 1], len: l };
    }
    return { a: best.a, b: best.b };
}


export function getArrowMidSegmentResolved(arrow: DrawShape): { a: Point; b: Point } {
    const start = { x: arrow.x1 ?? 0, y: arrow.y1 ?? 0 };
    const end = { x: arrow.x2 ?? 0, y: arrow.y2 ?? 0 };
    const path = buildOrthogonalPath(start, end, {
        startSide: arrow.startBinding?.anchor,
        endSide: arrow.endBinding?.anchor,
    });
    return getArrowMidSegmentFromPath(path);
}

export function hitTestArrow(arrow: DrawShape, all: DrawShape[], p: Point, tol = 10): boolean {
    const path = getArrowPath(arrow, all);
    for (let i = 0; i < path.length - 1; i++) {
        if (distToSegment(p, path[i], path[i + 1]) <= tol) return true;
    }
    return false;
}

export function getArrowEndpointHandleHit(arrow: DrawShape, all: DrawShape[], p: Point, zoom: number): ArrowEndpointHandle | null {
    const r = 12 / zoom;
    const { start, end } = resolveArrowEndpoints(arrow, all);
    if (Math.hypot(p.x - start.x, p.y - start.y) <= r) return "start";
    if (Math.hypot(p.x - end.x, p.y - end.y) <= r) return "end";
    return null;
}





function hitTest(shape: DrawShape, px: number, py: number, all?: DrawShape[]): boolean {
    if (shape.type === "arrow") {
        return hitTestArrow(shape, all ?? [shape], { x: px, y: py }, 12);
    }
    const c = getCenter(shape);
    const lp = rotPt(px, py, c.x, c.y, -(shape.rotation || 0));
    const b = getBounds(shape), pad = 8;
    return lp.x >= b.x - pad && lp.x <= b.x + b.w + pad && lp.y >= b.y - pad && lp.y <= b.y + b.h + pad;
}





function drawShape(ctx: CanvasRenderingContext2D, shape: DrawShape, ink: string, skipLabel?: boolean): void {
    ctx.save();
    applyShapeRotation(ctx, shape);
    ctx.globalAlpha = shape.opacity ?? 1;
    const stroke = shape.color ?? ink;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = shape.strokeWidth ?? 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    switch (shape.type) {
        case "pen": {
            const pts = shape.points; if (!pts || pts.length < 2) break;
            ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) {
                const mid = { x: (pts[i - 1].x + pts[i].x) / 2, y: (pts[i - 1].y + pts[i].y) / 2 };
                ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, mid.x, mid.y);
            }
            ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y); ctx.stroke(); break;
        }
        case "eraser": {
            const pts = shape.points; if (!pts || pts.length < 2) break;
            ctx.globalCompositeOperation = "destination-out"; ctx.strokeStyle = "rgba(0,0,0,1)"; ctx.lineWidth = (shape.strokeWidth ?? 2) * 6;
            ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
            ctx.stroke(); break;
        }
        case "line": ctx.beginPath(); ctx.moveTo(shape.x1 ?? 0, shape.y1 ?? 0); ctx.lineTo(shape.x2 ?? 0, shape.y2 ?? 0); ctx.stroke(); break;
        case "arrow": {
            
            const start = { x: shape.x1 ?? 0, y: shape.y1 ?? 0 };
            const end = { x: shape.x2 ?? 0, y: shape.y2 ?? 0 };
            const path = buildOrthogonalPath(start, end, {
                startSide: shape.startBinding?.anchor,
                endSide: shape.endBinding?.anchor,
            });

            if (path.length === 0) break;

            ctx.beginPath();
            ctx.moveTo(path[0].x, path[0].y);
            for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
            ctx.stroke();

            if (path.length < 2) break;

            
            const p1 = path[path.length - 2], p2 = path[path.length - 1];
            const dx = p2.x - p1.x, dy = p2.y - p1.y;
            const angle = Math.atan2(dy, dx);
            const head = Math.min(14, Math.sqrt(dx * dx + dy * dy) * 0.4);
            if (head > 1) {
                ctx.beginPath();
                ctx.moveTo(p2.x, p2.y);
                ctx.lineTo(p2.x - head * Math.cos(angle - Math.PI / 6), p2.y - head * Math.sin(angle - Math.PI / 6));
                ctx.lineTo(p2.x - head * Math.cos(angle + Math.PI / 6), p2.y - head * Math.sin(angle + Math.PI / 6));
                ctx.closePath();
                ctx.fillStyle = stroke;
                ctx.fill();
            }
            break;
        }
        case "rect": {
            const x1 = shape.x1 ?? 0, y1 = shape.y1 ?? 0, x2 = shape.x2 ?? 0, y2 = shape.y2 ?? 0;
            const x = Math.min(x1, x2), y = Math.min(y1, y2), w = Math.abs(x2 - x1), h = Math.abs(y2 - y1);
            ctx.beginPath();
            if (shape.rounded && (ctx as CanvasRenderingContext2D & { roundRect?: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect) {
                (ctx as CanvasRenderingContext2D & { roundRect: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect(x, y, w, h, shape.roundedRadius ?? 8);
            } else ctx.rect(x, y, w, h);
            if (shape.fill && shape.fill !== "none") { ctx.fillStyle = shape.fill; ctx.fill(); } ctx.stroke(); break;
        }
        case "ellipse": {
            const x1 = shape.x1 ?? 0, y1 = shape.y1 ?? 0, x2 = shape.x2 ?? 0, y2 = shape.y2 ?? 0;
            const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2, rx = Math.abs(x2 - x1) / 2, ry = Math.abs(y2 - y1) / 2;
            ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(rx, 1), Math.max(ry, 1), 0, 0, Math.PI * 2);
            if (shape.fill && shape.fill !== "none") { ctx.fillStyle = shape.fill; ctx.fill(); } ctx.stroke(); break;
        }
        case "diamond": {
            const x1 = shape.x1 ?? 0, y1 = shape.y1 ?? 0, x2 = shape.x2 ?? 0, y2 = shape.y2 ?? 0;
            const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2, rx = Math.abs(x2 - x1) / 2, ry = Math.abs(y2 - y1) / 2;
            ctx.beginPath(); ctx.moveTo(cx, cy - ry); ctx.lineTo(cx + rx, cy); ctx.lineTo(cx, cy + ry); ctx.lineTo(cx - rx, cy); ctx.closePath();
            if (shape.fill && shape.fill !== "none") { ctx.fillStyle = shape.fill; ctx.fill(); } ctx.stroke(); break;
        }
        case "text": {
            const fs = shape.fontSize ?? 18;
            ctx.font = `${fs}px -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif`;
            ctx.fillStyle = shape.color ?? ink;
            ctx.globalAlpha = shape.opacity ?? 1;
            (shape.text ?? "").split("\n").forEach((line, i) => ctx.fillText(line, shape.x ?? 0, (shape.y ?? 0) + i * fs * 1.3));
            break;
        }
    }
    if (!skipLabel && shape.label && (shape.type === "rect" || shape.type === "ellipse" || shape.type === "diamond")) {
        drawShapeLabelInner(ctx, shape, ink);
    }
    ctx.restore();
}

function drawEraserGhost(ctx: CanvasRenderingContext2D, shape: DrawShape, zoom: number): void {
    const pts = shape.points; if (!pts || pts.length < 2) return;
    ctx.save(); applyShapeRotation(ctx, shape);
    ctx.strokeStyle = "#fb923c"; ctx.lineWidth = (shape.strokeWidth ?? 2) * 6; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.globalAlpha = 0.5; ctx.setLineDash([10 / zoom, 7 / zoom]);
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke();
    ctx.restore();
}

function drawSelectionOverlay(ctx: CanvasRenderingContext2D, shape: DrawShape, zoom: number, ink: string, allShapes?: DrawShape[]): void {
    const sel = ink === "#0b0b0d" ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.85)";
    const dot = ink;

    
    if (shape.type === "arrow") {
        const all = allShapes ?? [shape];
        const { start, end } = resolveArrowEndpoints(shape, all);
        const r = 5 / zoom;
        ctx.save();
        ctx.fillStyle = dot;
        ctx.strokeStyle = sel;
        ctx.lineWidth = 1.5 / zoom;
        [start, end].forEach(pt => {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();
        });
        ctx.restore();
        return;
    }

    ctx.save();
    applyShapeRotation(ctx, shape);
    const b = getBounds(shape), c = getCenter(shape);
    const pad = 8, hw = 4 / zoom, lw = 1 / zoom;
    ctx.strokeStyle = sel; ctx.lineWidth = lw; ctx.setLineDash([4 / zoom, 3 / zoom]);
    ctx.strokeRect(b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2); ctx.setLineDash([]);
    const corners: [number, number][] = [
        [b.x - pad, b.y - pad], [b.x + b.w + pad, b.y - pad],
        [b.x - pad, b.y + b.h + pad], [b.x + b.w + pad, b.y + b.h + pad],
    ];
    corners.forEach(([hx, hy]) => {
        ctx.fillStyle = dot;
        ctx.fillRect(hx - hw, hy - hw, hw * 2, hw * 2);
    });
    const hY = b.y - 30 / zoom;
    ctx.strokeStyle = sel; ctx.lineWidth = lw; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(c.x, b.y - pad); ctx.lineTo(c.x, hY); ctx.stroke();
    ctx.beginPath(); ctx.arc(c.x, hY, 4 / zoom, 0, Math.PI * 2); ctx.fillStyle = dot; ctx.fill();
    ctx.restore();
}

function drawDotGrid(ctx: CanvasRenderingContext2D, w: number, h: number, pan: Point, bgColor: string): void {
    ctx.fillStyle = bgColor; ctx.fillRect(0, 0, w, h);
    const spacing = 28, ox = ((pan.x % spacing) + spacing) % spacing, oy = ((pan.y % spacing) + spacing) % spacing;
    ctx.fillStyle = bgColor === BG_WHITE ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)";
    for (let x = ox; x < w; x += spacing) for (let y = oy; y < h; y += spacing) { ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI * 2); ctx.fill(); }
}





const Ic: Record<string, ReactNode> = {
    select: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51z" /></svg>,
    pan: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" /></svg>,
    pen: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 19l7-7 3 3-7 7-3-3z M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /></svg>,
    eraser: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M20 20H7l-4-4 8-8 12 12-3 0M14 6l8 8" /></svg>,
    line: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M5 19L19 5" /></svg>,
    arrow: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M5 12h10v-4l5 6-5 6v-4H5z" /></svg>,
    rect: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="3" width="18" height="18" rx="2" /></svg>,
    ellipse: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="9" /></svg>,
    diamond: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 2L22 12 12 22 2 12z" /></svg>,
    text: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 7V4h16v3M9 20h6M12 4v16" /></svg>,
    undo: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 7v6h6M3 13a9 9 0 1 0 3-7.7L3 8" /></svg>,
    redo: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M21 7v6h-6M21 13a9 9 0 1 1-3-7.7L21 8" /></svg>,
    trash: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>,
    download: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>,
    pdf: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6" /></svg>,
    edit: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z" /></svg>,
    sun: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>,
    moon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>,
    back: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>,
};





const glassPanel = (bg: string): CSSProperties => ({
    background: bg === BG_WHITE ? "rgba(255,255,255,0.72)" : "rgba(20,20,22,0.62)",
    backdropFilter: "blur(20px) saturate(180%)",
    WebkitBackdropFilter: "blur(20px) saturate(180%)",
    border: bg === BG_WHITE ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.1)",
    borderRadius: 14,
    boxShadow: bg === BG_WHITE
        ? "0 8px 32px rgba(0,0,0,0.08), 0 1px 0 rgba(255,255,255,0.6) inset"
        : "0 8px 32px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.06) inset",
    color: getInkColor(bg),
});

type FloatingBtnProps = { active?: boolean; label: string; onClick: () => void; danger?: boolean; bg: string; children: ReactNode };
function FloatingBtn({ active, label, onClick, danger, bg, children }: FloatingBtnProps) {
    const [hov, setHov] = useState(false);
    const ink = getInkColor(bg);
    const isLight = bg === BG_WHITE;
    const activeBg = isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.12)";
    const hovBg = isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.06)";
    return (
        <button onClick={onClick} title={label} aria-label={label}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{
                width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: 9, border: "none", cursor: "pointer", transition: "all 0.15s ease",
                background: active ? activeBg : hov ? hovBg : "transparent",
                color: danger ? (hov ? "#ef4444" : isLight ? "rgba(239,68,68,0.7)" : "rgba(239,68,68,0.8)") : ink,
                opacity: active ? 1 : 0.78,
            }}>
            {children}
        </button>
    );
}

function Divider({ bg, vertical = false }: { bg: string; vertical?: boolean }) {
    const c = bg === BG_WHITE ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)";
    return <div style={{ background: c, [vertical ? "width" : "height"]: 1, [vertical ? "height" : "width"]: vertical ? 20 : "100%", margin: vertical ? "0 4px" : "4px 0" }} />;
}





export default function DrawingPad({ shapes, setShapes, bgColor, setBgColor, zoom, setZoom, pan, setPan, onSave, onSync, savedToast, hasLocalCache }: DrawingPadProps) {
    
    const safeBg: BgMode = bgColor === BG_WHITE ? BG_WHITE : BG_BLACK;
    const ink = getInkColor(safeBg);
    const muted = getMutedInk(safeBg);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const labelTextareaRef = useRef<HTMLTextAreaElement>(null);
    const stateRef = useRef<DrawStateRef>({ shapes: [], zoom: 1, pan: { x: 0, y: 0 }, selectedId: null, selectedIds: new Set(), editingTextId: null, editingLabelId: null });
    const textActiveRef = useRef(false);
    const preDragRef = useRef<DrawShape[] | null>(null);
    const origShapesRef = useRef<Map<number | string, DrawShape>>(new Map());
    const bgColorRef = useRef(safeBg);
    const attachedErasersRef = useRef<DrawShape[]>([]);
    const marqueeStartRef = useRef<Point | null>(null);
    const arrowEndpointDragRef = useRef<{ arrowId: number | string; handle: ArrowEndpointHandle } | null>(null);

    const [tool, setTool] = useState<Tool>(TOOLS.PEN);
    const [strokeWidth, setStrokeWidth] = useState(2);
    const [fillColor, setFillColor] = useState("none");
    const [opacity, setOpacity] = useState(1);
    const [rounded, setRounded] = useState(false);
    const [roundedRadius, setRoundedRadius] = useState(8);
    const [fontSize, setFontSize] = useState<number | "custom">(18);
    const [customFontSize] = useState<number>(24);
    const [, setUndoStack] = useState<DrawShape[][]>([]);
    const [, setRedoStack] = useState<DrawShape[][]>([]);
    const [preview, setPreview] = useState<DrawShape | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPos, setStartPos] = useState<Point>({ x: 0, y: 0 });
    const [currentPath, setCurrentPath] = useState<Point[]>([]);
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState<Point>({ x: 0, y: 0 });
    const [textInput, setTextInput] = useState<Point | null>(null);
    const [textVal, setTextVal] = useState("");
    const [editingTextId, setEditingTextId] = useState<number | string | null>(null);
    const [editingLabelId, setEditingLabelId] = useState<number | string | null>(null);
    const [labelEditVal, setLabelEditVal] = useState("");
    const [selectedId, setSelectedId] = useState<number | string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<number | string>>(new Set());
    const [, setMarquee] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
    const [selMode, setSelMode] = useState<SelMode | null>(null);
    const [selStartPos, setSelStartPos] = useState<Point | null>(null);
    const [selOrigShape, setSelOrigShape] = useState<DrawShape | null>(null);
    const [resizeHandle, setResizeHandle] = useState<ResizeHandle | null>(null);
    const [justDrawnId, setJustDrawnId] = useState<number | string | null>(null);
    const [showDlMenu, setShowDlMenu] = useState(false);
    const [canvasCursor, setCanvasCursor] = useState("crosshair");
    const navigate = useNavigate();

    useEffect(() => { stateRef.current = { shapes, zoom, pan, selectedId, selectedIds, editingTextId, editingLabelId }; }, [shapes, zoom, pan, selectedId, selectedIds, editingTextId, editingLabelId]);
    useEffect(() => { bgColorRef.current = safeBg; }, [safeBg]);
    useEffect(() => { textActiveRef.current = textInput !== null || editingLabelId !== null; }, [textInput, editingLabelId]);
    useEffect(() => { if (!textInput || !textareaRef.current) return; requestAnimationFrame(() => { textareaRef.current?.focus(); textareaRef.current?.select(); }); }, [textInput]);
    useEffect(() => { if (editingLabelId == null || !labelTextareaRef.current) return; requestAnimationFrame(() => { labelTextareaRef.current?.focus(); labelTextareaRef.current?.select(); }); }, [editingLabelId]);

    
    
    
    const redraw = useCallback((previewShape: DrawShape | null) => {
        const canvas = canvasRef.current; if (!canvas) return;
        const ctx = canvas.getContext("2d"); if (!ctx) return;
        const { shapes, zoom, pan, selectedId, selectedIds, editingTextId, editingLabelId } = stateRef.current;
        const bg = bgColorRef.current;
        const inkNow = getInkColor(bg);

        drawDotGrid(ctx, canvas.width, canvas.height, pan, bg);

        const off = document.createElement("canvas"); off.width = canvas.width; off.height = canvas.height;
        const octx = off.getContext("2d")!;
        octx.save(); octx.translate(pan.x, pan.y); octx.scale(zoom, zoom);

        
        const resolved = shapes.map(s => {
            if (s.type !== "arrow") return s;
            const { start, end } = resolveArrowEndpoints(s, shapes);
            return { ...s, x1: start.x, y1: start.y, x2: end.x, y2: end.y };
        });
        
        resolved.forEach(s => {
            if (s.type === "text" && s.id === editingTextId) return;
            drawShape(octx, { ...s, color: inkNow }, inkNow, s.id === editingLabelId);
        });

        
        resolved.forEach(s => {
            if (s.type === "arrow" && s.label && s.id !== editingLabelId) {
                const seg = getArrowMidSegmentResolved(s);
                const mx = (seg.a.x + seg.b.x) / 2, my = (seg.a.y + seg.b.y) / 2;
                const fs = s.labelFontSize ?? 14;
                const lines = s.label.split("\n");
                octx.save();
                octx.font = `${fs}px -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif`;
                octx.textAlign = "center";
                octx.textBaseline = "middle";
                lines.forEach((line, i) => {
                    const w = octx.measureText(line).width + 12;
                    const ly = my + (i - (lines.length - 1) / 2) * fs * 1.3;
                    octx.fillStyle = bg;
                    octx.fillRect(mx - w / 2, ly - fs * 0.65, w, fs * 1.25);
                    octx.fillStyle = inkNow;
                    octx.fillText(line, mx, ly);
                });
                octx.restore();
            }
        });

        if (previewShape) drawShape(octx, { ...previewShape, color: previewShape.color ?? inkNow }, inkNow);
        octx.restore();
        ctx.drawImage(off, 0, 0);

        
        ctx.save(); ctx.translate(pan.x, pan.y); ctx.scale(zoom, zoom);
        const activeIds: Set<number | string> = selectedIds.size > 0
            ? selectedIds
            : (selectedId ? new Set<number | string>([selectedId]) : new Set<number | string>());
        activeIds.forEach(id => {
            const sel = resolved.find(s => s.id === id);
            if (!sel) return;
            if (sel.type === "eraser") drawEraserGhost(ctx, sel, zoom);
            else drawSelectionOverlay(ctx, sel, zoom, inkNow, resolved);
        });
        const mq = (previewShape as DrawShape & { _marquee?: { x1: number; y1: number; x2: number; y2: number } } | null)?._marquee;
        if (mq) {
            ctx.strokeStyle = inkNow; ctx.lineWidth = 1 / zoom; ctx.setLineDash([5 / zoom, 3 / zoom]);
            ctx.fillStyle = bg === BG_WHITE ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)";
            const mx = Math.min(mq.x1, mq.x2), my = Math.min(mq.y1, mq.y2);
            const mw = Math.abs(mq.x2 - mq.x1), mh = Math.abs(mq.y2 - mq.y1);
            ctx.fillRect(mx, my, mw, mh); ctx.strokeRect(mx, my, mw, mh); ctx.setLineDash([]);
        }
        ctx.restore(); canvas.style.background = bg;
    }, []);

    useEffect(() => { redraw(preview); }, [shapes, pan, zoom, selectedId, selectedIds, preview, safeBg, editingTextId, editingLabelId, redraw]);

    useEffect(() => {
        const resize = () => {
            const c = canvasRef.current, ct = containerRef.current; if (!c || !ct) return;
            const dpr = window.devicePixelRatio || 1;
            c.width = ct.clientWidth * dpr; c.height = ct.clientHeight * dpr;
            c.style.width = ct.clientWidth + "px"; c.style.height = ct.clientHeight + "px";
            const ctx = c.getContext("2d"); if (ctx) { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
            redraw(null);
        };
        resize(); const obs = new ResizeObserver(resize); if (containerRef.current) obs.observe(containerRef.current); return () => obs.disconnect();
    }, [redraw]);

    const toCanvas = useCallback((e: { clientX: number; clientY: number }) => {
        const c = canvasRef.current; if (!c) return { x: 0, y: 0 }; const r = c.getBoundingClientRect(); const { zoom, pan } = stateRef.current;
        return { x: (e.clientX - r.left - pan.x) / zoom, y: (e.clientY - r.top - pan.y) / zoom };
    }, []);

    
    
    
    const pushHistory = useCallback((snap: DrawShape[]) => { setUndoStack(u => [...u.slice(-50), snap]); setRedoStack([]); }, []);

    const undo = useCallback(() => {
        setUndoStack(stack => {
            if (!stack.length) return stack;
            setRedoStack(r => [...r, stateRef.current.shapes]);
            setShapes(stack[stack.length - 1]); setSelectedId(null);
            return stack.slice(0, -1);
        });
    }, [setShapes]);

    const redo = useCallback(() => {
        setRedoStack(stack => {
            if (!stack.length) return stack;
            setUndoStack(u => [...u, stateRef.current.shapes]);
            setShapes(stack[stack.length - 1]);
            return stack.slice(0, -1);
        });
    }, [setShapes]);

    const commitText = useCallback(() => {
        const ti = textInput, val = textVal.trim();
        if (ti && val) {
            pushHistory(stateRef.current.shapes);
            setShapes(s => {
                const base = editingTextId ? s.filter(sh => sh.id !== editingTextId) : s;
                const fs = editingTextId ? (s.find(sh => sh.id === editingTextId)?.fontSize ?? 18) : (fontSize === "custom" ? customFontSize : fontSize);
                return [...base, { id: uid(), type: "text" as ShapeType, x: ti.x, y: ti.y, text: val, color: ink, fontSize: fs, opacity }];
            });
        } else if (editingTextId && !val) {
            pushHistory(stateRef.current.shapes); setShapes(s => s.filter(sh => sh.id !== editingTextId));
        }
        setTextInput(null); setTextVal(""); setEditingTextId(null);
    }, [textInput, textVal, ink, opacity, pushHistory, editingTextId, setShapes, fontSize, customFontSize]);

    const openTextEdit = useCallback((shape: DrawShape) => {
        setEditingTextId(shape.id); setTextInput({ x: shape.x ?? 0, y: shape.y ?? 0 }); setTextVal(shape.text ?? "");
        requestAnimationFrame(() => { textareaRef.current?.focus(); textareaRef.current?.select(); });
    }, []);

    const openLabelEdit = useCallback((shape: DrawShape) => {
        setEditingLabelId(shape.id);
        setLabelEditVal(shape.label ?? "");
        requestAnimationFrame(() => { labelTextareaRef.current?.focus(); labelTextareaRef.current?.select(); });
    }, []);

    const commitLabelEdit = useCallback(() => {
        if (editingLabelId == null) { return; }
        pushHistory(stateRef.current.shapes);
        const val = labelEditVal;
        setShapes(s => s.map(sh => sh.id === editingLabelId
            ? { ...sh, label: val ? val : undefined, labelFontSize: sh.labelFontSize ?? 14 }
            : sh));
        setEditingLabelId(null); setLabelEditVal("");
    }, [editingLabelId, labelEditVal, pushHistory, setShapes]);

    const cancelLabelEdit = useCallback(() => { setEditingLabelId(null); setLabelEditVal(""); }, []);

    const updateSelectedFill = useCallback((f: string) => { if (!stateRef.current.selectedId) return; pushHistory(stateRef.current.shapes); setShapes(s => s.map(sh => sh.id === stateRef.current.selectedId ? { ...sh, fill: f } : sh)); }, [pushHistory, setShapes]);
    const updateJustDrawnFill = useCallback((f: string) => { if (!justDrawnId) return; setFillColor(f); setShapes(s => s.map(sh => sh.id === justDrawnId ? { ...sh, fill: f } : sh)); }, [justDrawnId, setShapes]);
    const updateSelectedSW = useCallback((w: number) => { if (!stateRef.current.selectedId) return; pushHistory(stateRef.current.shapes); setShapes(s => s.map(sh => sh.id === stateRef.current.selectedId ? { ...sh, strokeWidth: w } : sh)); }, [pushHistory, setShapes]);
    const updateSelectedRounded = useCallback((r: boolean) => { if (!stateRef.current.selectedId) return; pushHistory(stateRef.current.shapes); setShapes(s => s.map(sh => sh.id === stateRef.current.selectedId ? { ...sh, rounded: r } : sh)); }, [pushHistory, setShapes]);
    const updateSelectedRoundedRadius = useCallback((r: number) => { if (!stateRef.current.selectedId) return; pushHistory(stateRef.current.shapes); setShapes(s => s.map(sh => sh.id === stateRef.current.selectedId ? { ...sh, roundedRadius: r } : sh)); }, [pushHistory, setShapes]);
    const updateSelectedFontSize = useCallback((s: number) => { if (!stateRef.current.selectedId) return; pushHistory(stateRef.current.shapes); setShapes(prev => prev.map(sh => { if (sh.id !== stateRef.current.selectedId) return sh; if (sh.type === "text") return { ...sh, fontSize: s }; if (isLabelEditableShape(sh)) return { ...sh, labelFontSize: s }; return sh; })); }, [pushHistory, setShapes]);

    
    
    
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (textActiveRef.current) return;
            const tag = (e.target as HTMLElement)?.tagName; if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
            const cmd = e.metaKey || e.ctrlKey;
            if (cmd && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
            if (cmd && e.shiftKey && e.key === "z") { e.preventDefault(); redo(); return; }
            if (cmd && e.key === "y") { e.preventDefault(); redo(); return; }
            if ((e.key === "Backspace" || e.key === "Delete") && (stateRef.current.selectedId || stateRef.current.selectedIds.size > 0)) {
                e.preventDefault();
                const ids = stateRef.current.selectedIds.size > 0 ? stateRef.current.selectedIds : new Set<number | string>([stateRef.current.selectedId!]);
                pushHistory(stateRef.current.shapes);
                setShapes(s => s.filter(sh => !ids.has(sh.id)).map(sh => {
                    if (sh.type !== "arrow") return sh;
                    const next = { ...sh };
                    if (next.startBinding && ids.has(next.startBinding.shapeId)) next.startBinding = undefined;
                    if (next.endBinding && ids.has(next.endBinding.shapeId)) next.endBinding = undefined;
                    return next;
                }));
                setSelectedId(null); setSelectedIds(new Set()); return;
            }
            if (!cmd) {
                const map: Record<string, Tool> = { v: TOOLS.SELECT, h: TOOLS.PAN, p: TOOLS.PEN, e: TOOLS.ERASER, l: TOOLS.LINE, a: TOOLS.ARROW, r: TOOLS.RECT, o: TOOLS.ELLIPSE, d: TOOLS.DIAMOND, t: TOOLS.TEXT };
                if (map[e.key]) { e.preventDefault(); setTool(map[e.key]); }
            }
        };
        window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
    }, [undo, redo, pushHistory, setShapes]);

    useEffect(() => {
        const el = canvasRef.current; if (!el) return;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            
            setZoom(z => Math.max(0.1, Math.min(20, z * Math.exp(-e.deltaY * 0.0015))));
        };
        el.addEventListener("wheel", onWheel, { passive: false }); return () => el.removeEventListener("wheel", onWheel);
    }, [setZoom]);

    
    
    
    const onDoubleClick = useCallback((e: ReactMouseEvent) => {
        const pos = toCanvas(e);
        const hit = [...stateRef.current.shapes].reverse().find(s => hitTest(s, pos.x, pos.y, stateRef.current.shapes));
        if (!hit) return;
        if (hit.type === "text") { setSelectedId(null); setSelectedIds(new Set()); openTextEdit(hit); return; }
        if (isLabelEditableShape(hit)) {
            setSelectedId(hit.id); setSelectedIds(new Set());
            openLabelEdit(hit); setTool(TOOLS.SELECT); return;
        }
        if (e.shiftKey) {
            setSelectedId(null);
            setSelectedIds(prev => { const next = new Set(prev); next.has(hit.id) ? next.delete(hit.id) : next.add(hit.id); return next; });
        } else { setSelectedId(hit.id); setSelectedIds(new Set()); }
        setTool(TOOLS.SELECT);
    }, [toCanvas, openTextEdit, openLabelEdit]);

    
    
    
    const getCanvasCursor = useCallback((pos: Point): string => {
        if (isPanning) return "grabbing";
        if (tool === TOOLS.PAN) return "grab";
        if (tool === TOOLS.ERASER) return "cell";
        if (tool === TOOLS.TEXT) return "text";
        if (tool === TOOLS.SELECT) {
            const { shapes, selectedId, zoom } = stateRef.current;
            if (selectedId) {
                const sel = shapes.find(s => s.id === selectedId);
                if (sel) {
                    if (sel.type === "arrow") {
                        const eh = getArrowEndpointHandleHit(sel, shapes, pos, zoom);
                        if (eh) return "move";
                    } else {
                        const rh = getResizeHandleHit(sel, pos.x, pos.y, zoom);
                        if (rh === "tl" || rh === "br") return "nwse-resize";
                        if (rh === "tr" || rh === "bl") return "nesw-resize";
                        const hp = getRotHandlePos(sel);
                        if (Math.hypot(pos.x - hp.x, pos.y - hp.y) < 18 / zoom) return "crosshair";
                    }
                }
            }
            return "default";
        }
        return "crosshair";
    }, [isPanning, tool]);

    
    
    
    const onMouseDown = useCallback((e: ReactMouseEvent) => {
        if (textActiveRef.current) return;
        setJustDrawnId(null); setShowDlMenu(false);
        if (e.button === 1 || (e.button === 0 && e.altKey) || tool === TOOLS.PAN) {
            setIsPanning(true); setPanStart({ x: e.clientX - stateRef.current.pan.x, y: e.clientY - stateRef.current.pan.y }); return;
        }
        const pos = toCanvas(e);

        if (tool === TOOLS.TEXT) {
            const ex = [...stateRef.current.shapes].reverse().find(s => s.type === "text" && hitTest(s, pos.x, pos.y, stateRef.current.shapes));
            if (ex) { openTextEdit(ex); return; }
            setEditingTextId(null); setTextInput(pos); setTextVal("");
            requestAnimationFrame(() => { textareaRef.current?.focus(); textareaRef.current?.select(); });
            return;
        }

        if (tool === TOOLS.SELECT) {
            const { shapes, selectedId, selectedIds, zoom } = stateRef.current;
            const activeIds: Set<number | string> = selectedIds.size > 0
                ? selectedIds
                : (selectedId ? new Set<number | string>([selectedId]) : new Set<number | string>());

            if (e.shiftKey) {
                const hit = [...shapes].reverse().find(s => hitTest(s, pos.x, pos.y, shapes));
                if (hit) {
                    setSelectedId(null);
                    setSelectedIds(prev => { const next = new Set(prev); next.has(hit.id) ? next.delete(hit.id) : next.add(hit.id); return next; });
                }
                return;
            }

            if (selectedId && !selectedIds.size) {
                const sel = shapes.find(s => s.id === selectedId);
                if (sel && sel.type === "arrow") {
                    const eh = getArrowEndpointHandleHit(sel, shapes, pos, zoom);
                    if (eh) {
                        preDragRef.current = [...shapes];
                        arrowEndpointDragRef.current = { arrowId: sel.id, handle: eh };
                        setSelMode("arrow-endpoint"); setSelStartPos(pos); setSelOrigShape({ ...sel });
                        return;
                    }
                }
            }

            if (selectedId && !selectedIds.size) {
                const sel = shapes.find(s => s.id === selectedId);
                if (sel && sel.type !== "arrow") {
                    const rh = getResizeHandleHit(sel, pos.x, pos.y, zoom);
                    if (rh) {
                        preDragRef.current = [...shapes];
                        setResizeHandle(rh); setSelMode("resize"); setSelStartPos(pos); setSelOrigShape({ ...sel });
                        return;
                    }
                    const hp = getRotHandlePos(sel);
                    if (Math.hypot(pos.x - hp.x, pos.y - hp.y) < 18 / zoom) {
                        preDragRef.current = [...shapes];
                        if (sel.type !== "eraser") {
                            const si = shapes.findIndex(s => s.id === sel.id);
                            attachedErasersRef.current = shapes
                                .filter((s, idx) => s.type === "eraser" && idx > si && boundsIntersect(getBounds(s), getBounds(sel)))
                                .map(s => ({ ...s }));
                        } else attachedErasersRef.current = [];
                        setSelMode("rotate"); setSelStartPos(pos); setSelOrigShape({ ...sel });
                        return;
                    }
                }
            }

            const clickedSel = [...activeIds].map(id => shapes.find(s => s && s.id === id)).find(s => s && hitTest(s, pos.x, pos.y, shapes));
            if (clickedSel && activeIds.size > 0) {
                preDragRef.current = [...shapes]; attachedErasersRef.current = [];
                const om = new Map<number | string, DrawShape>();
                activeIds.forEach(id => { const s = shapes.find(sh => sh.id === id); if (s) om.set(id, { ...s }); });
                origShapesRef.current = om;
                setSelMode("move"); setSelStartPos(pos); setSelOrigShape({ ...clickedSel });
                return;
            }

            const hit = [...shapes].reverse().find(s => hitTest(s, pos.x, pos.y, shapes));
            if (hit) {
                setSelectedId(hit.id); setSelectedIds(new Set());
                preDragRef.current = [...shapes];
                if (hit.type !== "eraser" && hit.type !== "arrow") {
                    const hi = shapes.findIndex(s => s.id === hit.id);
                    attachedErasersRef.current = shapes
                        .filter((s, idx) => s.type === "eraser" && idx > hi && boundsIntersect(getBounds(s), getBounds(hit)))
                        .map(s => ({ ...s }));
                } else attachedErasersRef.current = [];
                setSelMode("move"); setSelStartPos(pos); setSelOrigShape({ ...hit });
            } else {
                setSelectedId(null); setSelectedIds(new Set()); setSelMode(null);
                marqueeStartRef.current = pos; setMarquee({ x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y });
            }
            return;
        }

        
        setIsDrawing(true); setStartPos(pos);
        if (tool === TOOLS.PEN || tool === TOOLS.ERASER) setCurrentPath([pos]);
    }, [tool, toCanvas, openTextEdit]);

    
    
    
    const onMouseMove = useCallback((e: ReactMouseEvent) => {
        if (isPanning) { setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y }); return; }
        const pos = toCanvas(e);
        setCanvasCursor(getCanvasCursor(pos));

        if (tool === TOOLS.SELECT) {
            if (marqueeStartRef.current && !selMode) {
                const mq = { x1: marqueeStartRef.current.x, y1: marqueeStartRef.current.y, x2: pos.x, y2: pos.y };
                setMarquee(mq);
                const mx = Math.min(mq.x1, mq.x2), my = Math.min(mq.y1, mq.y2);
                const mw = Math.abs(mq.x2 - mq.x1), mh = Math.abs(mq.y2 - mq.y1);
                setSelectedIds(new Set(stateRef.current.shapes.filter(s => boundsIntersect(getBounds(s), { x: mx, y: my, w: mw, h: mh })).map(s => s.id)));
                setPreview({ id: "_mq", type: "rect", x1: mq.x1, y1: mq.y1, x2: mq.x2, y2: mq.y2, color: "transparent", strokeWidth: 0, _marquee: mq } as DrawShape & { _marquee: typeof mq });
                return;
            }
            if (selMode && selOrigShape && selStartPos) {
                const dx = pos.x - selStartPos.x, dy = pos.y - selStartPos.y;

                if (selMode === "move") {
                    const { selectedIds } = stateRef.current;
                    const aIds: Set<number | string> = selectedIds.size > 0 ? selectedIds : new Set<number | string>([selOrigShape.id]);
                    setShapes(s => s.map(sh => {
                        if (aIds.has(sh.id)) {
                            const orig = origShapesRef.current.get(sh.id) ?? (sh.id === selOrigShape.id ? selOrigShape : sh);
                            return moveShape(orig, dx, dy);
                        }
                        const origE = attachedErasersRef.current.find(er => er.id === sh.id);
                        if (origE) return moveShape(origE, dx, dy);
                        return sh;
                    }));
                } else if (selMode === "rotate") {
                    const c = getCenter(selOrigShape);
                    const delta = Math.atan2(pos.y - c.y, pos.x - c.x) - Math.atan2(selStartPos.y - c.y, selStartPos.x - c.x);
                    setShapes(s => s.map(sh => {
                        if (sh.id === selOrigShape.id) return { ...sh, rotation: (selOrigShape.rotation || 0) + delta };
                        const origE = attachedErasersRef.current.find(er => er.id === sh.id);
                        if (origE) return { ...sh, points: (origE.points ?? []).map(p => rotPt(p.x, p.y, c.x, c.y, delta)) };
                        return sh;
                    }));
                } else if (selMode === "resize" && resizeHandle && selOrigShape) {
                    const c = getCenter(selOrigShape);
                    const rot = selOrigShape.rotation || 0;
                    const localPos = rotPt(pos.x, pos.y, c.x, c.y, -rot);
                    const resized = resizeShape(selOrigShape, resizeHandle, localPos);
                    setShapes(s => s.map(sh => sh.id === selOrigShape.id ? resized : sh));
                } else if (selMode === "arrow-endpoint" && arrowEndpointDragRef.current && selOrigShape) {
                    const { handle } = arrowEndpointDragRef.current;
                    setShapes(s => s.map(sh => {
                        if (sh.id !== selOrigShape.id) return sh;
                        const next: DrawShape = { ...sh };
                        const target = findBindingTarget(stateRef.current.shapes, pos, sh.id);
                        if (handle === "start") {
                            if (target) { next.startBinding = { shapeId: target.shape.id, anchor: target.anchor }; next.x1 = target.point.x; next.y1 = target.point.y; }
                            else { next.startBinding = undefined; next.x1 = pos.x; next.y1 = pos.y; }
                        } else {
                            if (target) { next.endBinding = { shapeId: target.shape.id, anchor: target.anchor }; next.x2 = target.point.x; next.y2 = target.point.y; }
                            else { next.endBinding = undefined; next.x2 = pos.x; next.y2 = pos.y; }
                        }
                        return next;
                    }));
                }
            }
            return;
        }

        if (!isDrawing) return;
        if (tool === TOOLS.PEN || tool === TOOLS.ERASER) {
            setCurrentPath(p => {
                const next = [...p, pos];
                setPreview({ id: "preview", type: tool, points: next, color: ink, strokeWidth, opacity });
                return next;
            });
            return;
        }
        const base: DrawShape = { id: "preview", type: "line", color: ink, strokeWidth, fill: fillColor, opacity, rounded, roundedRadius, x1: startPos.x, y1: startPos.y, x2: pos.x, y2: pos.y };
        const tmap: Partial<Record<Tool, ShapeType>> = { [TOOLS.LINE]: "line", [TOOLS.ARROW]: "arrow", [TOOLS.RECT]: "rect", [TOOLS.ELLIPSE]: "ellipse", [TOOLS.DIAMOND]: "diamond" };
        if (tmap[tool]) {
            
            if (tool === TOOLS.ARROW) {
                const startTarget = findBindingTarget(stateRef.current.shapes, { x: startPos.x, y: startPos.y });
                const endTarget = findBindingTarget(stateRef.current.shapes, pos);
                setPreview({
                    ...base, type: "arrow",
                    startBinding: startTarget ? { shapeId: startTarget.shape.id, anchor: startTarget.anchor } : undefined,
                    endBinding: endTarget ? { shapeId: endTarget.shape.id, anchor: endTarget.anchor } : undefined,
                    x1: startTarget?.point.x ?? startPos.x, y1: startTarget?.point.y ?? startPos.y,
                    x2: endTarget?.point.x ?? pos.x, y2: endTarget?.point.y ?? pos.y,
                });
            } else {
                setPreview({ ...base, type: tmap[tool]! });
            }
        }
    }, [isPanning, panStart, tool, selMode, selOrigShape, selStartPos, resizeHandle, isDrawing, toCanvas, ink, strokeWidth, fillColor, opacity, rounded, roundedRadius, startPos, setPan, setShapes, getCanvasCursor]);

    
    
    
    const onMouseUp = useCallback((e: ReactMouseEvent) => {
        if (isPanning) { setIsPanning(false); return; }
        if (tool === TOOLS.SELECT) {
            if (marqueeStartRef.current) { marqueeStartRef.current = null; setMarquee(null); setPreview(null); return; }
            if (selMode) {
                if (preDragRef.current) {
                    const snap = preDragRef.current;
                    setUndoStack(u => [...u.slice(-50), snap]); setRedoStack([]);
                    preDragRef.current = null;
                }
                attachedErasersRef.current = []; origShapesRef.current = new Map();
                arrowEndpointDragRef.current = null;
                setSelMode(null); setSelOrigShape(null); setSelStartPos(null); setResizeHandle(null);
            }
            return;
        }
        if (!isDrawing) return;
        setIsDrawing(false); setPreview(null);
        const pos = toCanvas(e);
        pushHistory(stateRef.current.shapes);

        if (tool === TOOLS.PEN || tool === TOOLS.ERASER) {
            if (currentPath.length < 2) { setCurrentPath([]); return; }
            const nid = uid();
            setShapes(s => [...s, { id: nid, type: tool, points: currentPath, color: ink, strokeWidth, opacity }]);
            setJustDrawnId(nid); setCurrentPath([]); return;
        }
        if (Math.hypot(pos.x - startPos.x, pos.y - startPos.y) < 4) return;

        const baseId = uid();
        const base = { id: baseId, color: ink, strokeWidth, fill: fillColor, opacity, rounded, roundedRadius, x1: startPos.x, y1: startPos.y, x2: pos.x, y2: pos.y };
        const tmap: Partial<Record<Tool, ShapeType>> = { [TOOLS.LINE]: "line", [TOOLS.ARROW]: "arrow", [TOOLS.RECT]: "rect", [TOOLS.ELLIPSE]: "ellipse", [TOOLS.DIAMOND]: "diamond" };
        const st = tmap[tool];
        if (!st) return;

        if (st === "arrow") {
            const startTarget = findBindingTarget(stateRef.current.shapes, { x: startPos.x, y: startPos.y });
            const endTarget = findBindingTarget(stateRef.current.shapes, pos);
            const arrow: DrawShape = {
                ...base, type: "arrow",
                startBinding: startTarget ? { shapeId: startTarget.shape.id, anchor: startTarget.anchor } : undefined,
                endBinding: endTarget ? { shapeId: endTarget.shape.id, anchor: endTarget.anchor } : undefined,
                x1: startTarget?.point.x ?? startPos.x, y1: startTarget?.point.y ?? startPos.y,
                x2: endTarget?.point.x ?? pos.x, y2: endTarget?.point.y ?? pos.y,
            };
            setShapes(s => [...s, arrow]); setJustDrawnId(arrow.id); return;
        }

        setShapes(s => [...s, { ...base, type: st }]);
        setJustDrawnId(baseId);
    }, [isPanning, tool, selMode, isDrawing, toCanvas, pushHistory, currentPath, ink, strokeWidth, fillColor, opacity, rounded, roundedRadius, startPos, setShapes]);

    
    
    
    const buildExportCanvas = () => {
        const src = canvasRef.current; if (!src) return null;
        const out = document.createElement("canvas"); out.width = src.width; out.height = src.height;
        const ctx = out.getContext("2d")!; ctx.fillStyle = safeBg; ctx.fillRect(0, 0, out.width, out.height); ctx.drawImage(src, 0, 0);
        return out;
    };
    const exportPNG = () => { const out = buildExportCanvas(); if (!out) return; const a = document.createElement("a"); a.download = "drawing.png"; a.href = out.toDataURL(); a.click(); };
    const exportPDF = () => {
        const out = buildExportCanvas(); if (!out) return;
        const win = window.open("", "_blank"); if (!win) { alert("Allow popups."); return; }
        win.document.write(`<style>@page{margin:0;size:${out.width}px ${out.height}px;}*{margin:0;padding:0;}body{background:${safeBg};}img{display:block;max-width:100%;}</style><img src="${out.toDataURL()}"/>`);
        win.document.close();
    };
    const clearAll = useCallback(() => { pushHistory(stateRef.current.shapes); setShapes([]); setSelectedId(null); }, [pushHistory, setShapes]);

    
    
    
    const hasFill = ([TOOLS.RECT, TOOLS.ELLIPSE, TOOLS.DIAMOND] as Tool[]).includes(tool);
    const selShape = shapes.find(s => s.id === selectedId);
    const selHasFill = selShape && (selShape.type === "rect" || selShape.type === "ellipse" || selShape.type === "diamond");
    const jdShape = shapes.find(s => s.id === justDrawnId);

    const tools: { id: Tool; label: string }[] = [
        { id: TOOLS.SELECT, label: "Select  V" },
        { id: TOOLS.PEN, label: "Pen  P" },
        { id: TOOLS.ERASER, label: "Eraser  E" },
        { id: TOOLS.LINE, label: "Line  L" },
        { id: TOOLS.ARROW, label: "Arrow  A" },
        { id: TOOLS.RECT, label: "Rectangle  R" },
        { id: TOOLS.ELLIPSE, label: "Ellipse  O" },
        { id: TOOLS.DIAMOND, label: "Diamond  D" },
        { id: TOOLS.TEXT, label: "Text  T" },
        { id: TOOLS.PAN, label: "Pan  H" },
    ];

    
    const labelEditShape = editingLabelId != null ? shapes.find(x => x.id === editingLabelId) : null;
    let labelOverlay: { x: number; y: number; w: number; h: number; fs: number; isArrow: boolean } | null = null;
    if (labelEditShape) {
        const resolvedShape = labelEditShape.type === "arrow"
            ? (() => { const { start, end } = resolveArrowEndpoints(labelEditShape, shapes); return { ...labelEditShape, x1: start.x, y1: start.y, x2: end.x, y2: end.y }; })()
            : labelEditShape;
        const box = getShapeLabelBox(resolvedShape);
        const fs = labelEditShape.labelFontSize ?? 14;

        const lines = (labelEditVal ?? "").split("\n");
        const longest = Math.max(...lines.map(l => l.length), 4);
        const textW = Math.max(longest * fs * 0.6 + 16, 50);
        const textH = Math.max(lines.length, 1) * fs * 1.3 + 12;

        const cx = box.x + box.w / 2;
        const cy = box.y + box.h / 2;

        labelOverlay = {
            x: (cx - textW / 2) * zoom + pan.x,
            y: (cy - textH / 2) * zoom + pan.y,
            w: textW * zoom,
            h: textH * zoom,
            fs: fs * zoom, isArrow: labelEditShape.type === "arrow",
        };
    }

    const fillSwatches = safeBg === BG_WHITE
        ? ["none", "rgba(0,0,0,0.06)", "rgba(0,0,0,0.12)", "rgba(0,0,0,0.85)"]
        : ["none", "rgba(255,255,255,0.06)", "rgba(255,255,255,0.14)", "rgba(255,255,255,0.92)"];

    const panelStyle = glassPanel(safeBg);

    return (
        <div ref={containerRef} style={{
            position: "relative", width: "100%", height: "100vh",
            background: safeBg, overflow: "hidden",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif",
            color: ink,
        }}>
            <style>{`
                *{box-sizing:border-box}
                input[type=range]{-webkit-appearance:none;height:3px;border-radius:2px;background:${safeBg === BG_WHITE ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.18)"};outline:none;cursor:pointer}
                input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:50%;background:${ink};cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,0.25)}
                textarea{resize:none;outline:none;font-family:inherit}
            `}</style>

            {}
            <canvas
                ref={canvasRef}
                style={{ display: "block", width: "100%", height: "100%", cursor: canvasCursor }}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
                onDoubleClick={onDoubleClick}
            />

            {}
            <div style={{
                position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)",
                ...panelStyle, padding: 5, display: "flex", alignItems: "center", gap: 2, zIndex: 30,
            }}>
                {tools.map(t => (
                    <FloatingBtn key={t.id} active={tool === t.id} label={t.label} bg={safeBg} onClick={() => setTool(t.id)}>
                        {Ic[t.id]}
                    </FloatingBtn>
                ))}
            </div>

            {}
            <div style={{
                position: "absolute", top: 16, right: 16,
                ...panelStyle, padding: 5, display: "flex", alignItems: "center", gap: 2, zIndex: 30,
            }}>
                <FloatingBtn label={safeBg === BG_WHITE ? "Switch to dark" : "Switch to light"} bg={safeBg}
                    onClick={() => setBgColor(safeBg === BG_WHITE ? BG_BLACK : BG_WHITE)}>
                    {safeBg === BG_WHITE ? Ic.moon : Ic.sun}
                </FloatingBtn>
                <Divider bg={safeBg} vertical />
                <FloatingBtn label="Zoom out" bg={safeBg} onClick={() => setZoom(z => Math.max(0.1, z / 1.25))}>
                    <span style={{ fontSize: 16, lineHeight: 1 }}>−</span>
                </FloatingBtn>
                <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} style={{
                    background: "transparent", border: "none", color: ink, fontSize: 11, cursor: "pointer",
                    padding: "0 6px", minWidth: 44, fontFamily: "inherit", opacity: 0.7,
                }}>{Math.round(zoom * 100)}%</button>
                <FloatingBtn label="Zoom in" bg={safeBg} onClick={() => setZoom(z => Math.min(20, z * 1.25))}>
                    <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
                </FloatingBtn>
                <Divider bg={safeBg} vertical />
                <div style={{ position: "relative" }}>
                    <FloatingBtn label="Export" bg={safeBg} onClick={() => setShowDlMenu(m => !m)}>{Ic.download}</FloatingBtn>
                    {showDlMenu && (
                        <div style={{
                            position: "absolute", top: 42, right: 0, ...panelStyle, padding: 4, minWidth: 170, zIndex: 100,
                        }}>
                            <button onClick={() => { exportPNG(); setShowDlMenu(false); }} style={{
                                display: "flex", alignItems: "center", gap: 8, width: "100%", background: "transparent",
                                border: "none", color: ink, padding: "9px 12px", fontSize: 12, cursor: "pointer",
                                fontFamily: "inherit", textAlign: "left", borderRadius: 8,
                            }}>{Ic.download} Image (PNG)</button>
                            <button onClick={() => { exportPDF(); setShowDlMenu(false); }} style={{
                                display: "flex", alignItems: "center", gap: 8, width: "100%", background: "transparent",
                                border: "none", color: ink, padding: "9px 12px", fontSize: 12, cursor: "pointer",
                                fontFamily: "inherit", textAlign: "left", borderRadius: 8,
                            }}>{Ic.pdf} PDF Document</button>
                        </div>
                    )}
                </div>
            </div>

            {}
            <div style={{
                position: "absolute", top: 16, left: 16,
                ...panelStyle, padding: 5, display: "flex", alignItems: "center", gap: 2, zIndex: 30,
            }}>
                <FloatingBtn label="Back  ⌘W" bg={safeBg} onClick={() => navigate(`/dashboard`)}>{Ic.back}</FloatingBtn>
                <FloatingBtn label="Undo  ⌘Z" bg={safeBg} onClick={undo}>{Ic.undo}</FloatingBtn>
                <FloatingBtn label="Redo  ⌘⇧Z" bg={safeBg} onClick={redo}>{Ic.redo}</FloatingBtn>
                <Divider bg={safeBg} vertical />
                <FloatingBtn label="Clear" bg={safeBg} onClick={clearAll} danger>{Ic.trash}</FloatingBtn>
                <Divider bg={safeBg} vertical />
                <button onClick={onSave} style={{
                    background: savedToast ? "transparent" : "transparent",
                    border: "none", color: ink, padding: "6px 10px", borderRadius: 8,
                    fontSize: 11, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s", opacity: savedToast ? 1 : 0.78,
                }}>{savedToast ? "✓ Saved" : "Save"}</button>
                {hasLocalCache && (
                    <button onClick={onSync} style={{
                        background: "transparent", border: "none", color: ink, padding: "6px 10px",
                        borderRadius: 8, fontSize: 11, cursor: "pointer", fontFamily: "inherit", opacity: 0.78,
                    }}>↓ Sync</button>
                )}
            </div>

            {}
            {(selShape || jdShape || hasFill) && !textInput && editingLabelId == null && (
                <div style={{
                    position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)",
                    ...panelStyle, padding: "8px 12px", display: "flex", alignItems: "center", gap: 12, zIndex: 30,
                    fontSize: 11, maxWidth: "calc(100vw - 40px)",justifyContent: "center",
                }}>
                    <span style={{ color: muted, textTransform: "uppercase", letterSpacing: "0.08em", fontSize: 10 }}>
                        {selShape ? `Selected · ${selShape.type}` : jdShape ? `Drew · ${jdShape.type}` : `Tool · ${tool}`}
                    </span>
                    <Divider bg={safeBg} vertical />

                    {}
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ color: muted, fontSize: 10 }}>Stroke</span>
                        {STROKE_WIDTHS.map(w => {
                            const cur = selShape?.strokeWidth ?? jdShape?.strokeWidth ?? strokeWidth;
                            return (
                                <button key={w} onClick={() => {
                                    if (selShape) updateSelectedSW(w);
                                    else { setStrokeWidth(w); if (jdShape) setShapes(s => s.map(sh => sh.id === jdShape.id ? { ...sh, strokeWidth: w } : sh)); }
                                }} style={{
                                    width: 24, height: 24, padding: 0, borderRadius: 6, border: "none", cursor: "pointer",
                                    background: cur === w ? (safeBg === BG_WHITE ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.14)") : "transparent",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                }}>
                                    <span style={{ display: "inline-block", width: 14, height: w, background: ink, borderRadius: w / 2 }} />
                                </button>
                            );
                        })}
                    </div>

                    {}
                    {(selHasFill || (hasFill && !selShape)) && (
                        <>
                            <Divider bg={safeBg} vertical />
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <span style={{ color: muted, fontSize: 10 }}>Fill</span>
                                {fillSwatches.map(f => {
                                    const cur = selShape?.fill ?? jdShape?.fill ?? fillColor;
                                    const isSel = cur === f;
                                    return (
                                        <button key={f} onClick={() => {
                                            if (selShape) updateSelectedFill(f);
                                            else { setFillColor(f); if (jdShape) updateJustDrawnFill(f); }
                                        }} style={{
                                            width: 22, height: 22, borderRadius: 6, cursor: "pointer",
                                            border: isSel ? `1.5px solid ${ink}` : `1px solid ${safeBg === BG_WHITE ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.18)"}`,
                                            background: f === "none"
                                                ? `repeating-linear-gradient(45deg, transparent 0 4px, ${safeBg === BG_WHITE ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.22)"} 4px 5px)`
                                                : f,
                                        }} />
                                    );
                                })}
                            </div>
                        </>
                    )}

                    {}
                    {((tool === TOOLS.RECT && !selShape) || (selShape?.type === "rect")) && (
                        <>
                            <Divider bg={safeBg} vertical />
                            <label style={{ display: "flex", alignItems: "center", gap: 6, color: muted, fontSize: 11, cursor: "pointer" }}>
                                <input type="checkbox" checked={selShape ? !!selShape.rounded : rounded} onChange={e => {
                                    if (selShape) updateSelectedRounded(e.target.checked);
                                    else setRounded(e.target.checked);
                                }} />
                                Rounded
                            </label>
                            {(selShape ? selShape.rounded : rounded) && (
                                <input type="range" min={2} max={40} step={1} value={selShape ? (selShape.roundedRadius ?? 8) : roundedRadius}
                                    onChange={e => {
                                        if (selShape) updateSelectedRoundedRadius(parseInt(e.target.value));
                                        else setRoundedRadius(parseInt(e.target.value));
                                    }} style={{ width: 70 }} />
                            )}
                        </>
                    )}

                    {}
                   {((tool === TOOLS.TEXT && !selShape) || (selShape?.type === "text") || (selShape && isLabelEditableShape(selShape))) && (() => {
                        const currentSize = selShape ? (selShape.type === "text" ? selShape.fontSize : selShape.labelFontSize) ?? 18 : fontSize;
                        const selectValue = (currentSize === 14 || currentSize === 18 || currentSize === 24) ? currentSize.toString() : "18";
                        
                        return (
                            <>
                                <Divider bg={safeBg} vertical/>
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    <span style={{ color: muted, fontSize: 10 }}>Font</span>
                                    <select 
                                        value={selectValue}
                                        onChange={e => {
                                            const num = parseInt(e.target.value);
                                            if (selShape) updateSelectedFontSize(num);
                                            else setFontSize(num);
                                        }}
                                        style={{ background: "transparent", color: ink, border: "none", fontSize: 11, cursor: "pointer", outline: "none" }}
                                    >
                                        <option value="14" style={{ color: "#000" }}>Small</option>
                                        <option value="18" style={{ color: "#000" }}>Medium</option>
                                        <option value="24" style={{ color: "#000" }}>Large</option>
                                    </select>
                                </div>
                            </>
                        );
                    })()}

                    {}
                    {}

                    {}
                    <Divider bg={safeBg} vertical />
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ color: muted, fontSize: 10 }}>Opacity</span>
                        <input type="range" min={0.1} max={1} step={0.05} value={opacity}
                            onChange={e => setOpacity(parseFloat(e.target.value))} style={{ width: 70 }} />
                    </div>
                </div>
            )}

            {}
            {textInput && (() => {
                const fs = editingTextId ? (stateRef.current.shapes.find(s => s.id === editingTextId)?.fontSize ?? 18) : (fontSize === "custom" ? customFontSize : fontSize);
                const lines = (textVal ?? "").split("\n");
                const longest = Math.max(...lines.map(l => l.length), 4);
                const textW = Math.max(longest * fs * 0.6 + 16, 50);
                const textH = Math.max(lines.length, 1) * fs * 1.3 + 12;

                return (
                    <textarea
                        ref={textareaRef}
                        value={textVal}
                        onChange={e => setTextVal(e.target.value)}
                        onBlur={commitText}
                        onKeyDown={e => {
                            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitText(); }
                            else if (e.key === "Escape") { e.preventDefault(); setTextInput(null); setTextVal(""); setEditingTextId(null); }
                        }}
                        onMouseDown={e => e.stopPropagation()}
                        onClick={e => e.stopPropagation()}
                        placeholder="Type…"
                        style={{
                            position: "absolute",
                            left: textInput.x * zoom + pan.x,
                            top: (textInput.y - fs) * zoom + pan.y,
                            minWidth: 100, width: textW * zoom,
                            minHeight: fs * 1.4 * zoom, height: textH * zoom,
                            fontSize: fs * zoom,
                            color: ink, background: "transparent",
                            border: `1px dashed ${ink}`, padding: 2, zIndex: 50,
                            fontFamily: "inherit",
                        }}
                    />
                );
            })()}

            {}
            {labelOverlay && (
                <textarea
                    ref={labelTextareaRef}
                    value={labelEditVal}
                    onChange={e => setLabelEditVal(e.target.value)}
                    onBlur={commitLabelEdit}
                    onKeyDown={e => {
                        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitLabelEdit(); }
                        else if (e.key === "Escape") { e.preventDefault(); cancelLabelEdit(); }
                    }}
                    onMouseDown={e => e.stopPropagation()}
                    onClick={e => e.stopPropagation()}
                    placeholder="Label…"
                    style={{
                        position: "absolute",
                        left: labelOverlay.x, top: labelOverlay.y,
                        width: labelOverlay.w, height: labelOverlay.h,
                        fontSize: labelOverlay.fs,
                        fontFamily: "inherit",
                        textAlign: "center",
                        color: ink,
                        background: labelOverlay.isArrow ? safeBg : "transparent",
                        border: `1px dashed ${ink}`,
                        padding: 2, zIndex: 60,
                    }}
                />
            )}
        </div>
    );
}
