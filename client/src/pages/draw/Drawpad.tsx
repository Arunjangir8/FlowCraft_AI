import {
    useState, useRef, useEffect, useCallback,
    type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode
} from "react";

// ============================================================================
// CONSTANTS
// ============================================================================

export const TOOLS = {
    SELECT: "select", PAN: "pan", PEN: "pen", ERASER: "eraser",
    LINE: "line", ARROW: "arrow", RECT: "rect", ELLIPSE: "ellipse",
    DIAMOND: "diamond", TEXT: "text",
} as const;

export const COLORS = [
    "#f8fafc", "#f87171", "#fb923c", "#fbbf24",
    "#a3e635", "#34d399", "#38bdf8", "#818cf8",
    "#e879f9", "#f472b6", "#94a3b8", "#1e293b",
];

const BG_PRESETS = [
    { label: "Dark",   value: "#0d1117" }, { label: "Navy",   value: "#0a1628" },
    { label: "Slate",  value: "#1e293b" }, { label: "White",  value: "#ffffff" },
    { label: "Cream",  value: "#fefce8" }, { label: "Paper",  value: "#f8fafc" },
    { label: "Forest", value: "#052e16" }, { label: "Wine",   value: "#1a0a0a" },
];

const STROKE_WIDTHS = [1, 2, 4, 8];
let _uid = 0;
export const uid = () => ++_uid;

// ============================================================================
// TYPES
// ============================================================================

export type Point     = { x: number; y: number };
export type Tool      = typeof TOOLS[keyof typeof TOOLS];
export type ShapeType = "pen" | "eraser" | "line" | "arrow" | "rect" | "ellipse" | "diamond" | "text";
type SelMode          = "move" | "rotate" | "resize" | "arrow-endpoint";
type ResizeHandle     = "tl" | "tr" | "bl" | "br";
type ArrowEndpointHandle = "start" | "end" | "bend";

export type AnchorSide   = "top" | "right" | "bottom" | "left" | "center";
export type ConnectorType = "straight" | "elbow";
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

    // embedded label
    label?: string;
    labelFontSize?: number;
    labelColor?: string;
    labelAlign?: "center";
    labelOffset?: { x: number; y: number };

    // arrow connector fields
    startBinding?: ArrowBinding;
    endBinding?: ArrowBinding;
    connectorType?: ConnectorType;
    waypoint?: Point;
};

type Bounds       = { x: number; y: number; w: number; h: number };
type DrawStateRef = {
    shapes: DrawShape[]; zoom: number; pan: Point;
    selectedId: number | string | null; selectedIds: Set<number | string>;
};

export interface DrawingPadProps {
    shapes:       DrawShape[];
    setShapes:    React.Dispatch<React.SetStateAction<DrawShape[]>>;
    bgColor:      string;
    setBgColor:   (c: string) => void;
    zoom:         number;
    setZoom:      React.Dispatch<React.SetStateAction<number>>;
    pan:          Point;
    setPan:       React.Dispatch<React.SetStateAction<Point>>;
    onSave:        () => Promise<void>;
    onSync:        () => Promise<void>;
    savedToast:    boolean;
    hasLocalCache: boolean;
}

// ============================================================================
// GEOMETRY HELPERS
// ============================================================================

export function getBounds(shape: DrawShape): Bounds {
    if (shape.type === "pen" || shape.type === "eraser") {
        if (!shape.points?.length) return { x: 0, y: 0, w: 4, h: 4 };
        const sw   = shape.type === "eraser" ? (shape.strokeWidth ?? 2) * 3 : (shape.strokeWidth ?? 2) / 2;
        const xs   = shape.points.map(p => p.x);
        const ys   = shape.points.map(p => p.y);
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
        ["tl", b.x - pad,       b.y - pad],
        ["tr", b.x + b.w + pad, b.y - pad],
        ["bl", b.x - pad,       b.y + b.h + pad],
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
    const moved: DrawShape = { ...shape, x1: (shape.x1 ?? 0) + dx, y1: (shape.y1 ?? 0) + dy, x2: (shape.x2 ?? 0) + dx, y2: (shape.y2 ?? 0) + dy };
    if (shape.waypoint) moved.waypoint = { x: shape.waypoint.x + dx, y: shape.waypoint.y + dy };
    return moved;
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

// ============================================================================
// LABEL HELPERS
// ============================================================================

export function isLabelEditableShape(s: DrawShape): boolean {
    return s.type === "rect" || s.type === "ellipse" || s.type === "diamond" || s.type === "arrow";
}

export function getShapeLabelBox(shape: DrawShape): Bounds {
    if (shape.type === "arrow") {
        const seg = getArrowMidSegment(shape);
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

function drawShapeLabelInner(ctx: CanvasRenderingContext2D, shape: DrawShape) {
    if (!shape.label) return;
    const box = getShapeLabelBox(shape);
    const fs = shape.labelFontSize ?? 14;
    ctx.save();
    ctx.fillStyle = shape.labelColor ?? shape.color ?? "#f8fafc";
    ctx.globalAlpha = shape.opacity ?? 1;
    ctx.font = `${fs}px 'JetBrains Mono',monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const lines = shape.label.split("\n");
    const cx = box.x + box.w / 2;
    const totalH = lines.length * fs * 1.3;
    let y = box.y + box.h / 2 - totalH / 2 + fs * 0.65;
    for (const line of lines) { ctx.fillText(line, cx, y); y += fs * 1.3; }
    ctx.restore();
}

// ============================================================================
// ARROW / CONNECTOR HELPERS
// ============================================================================

export function getShapeAnchorPoints(shape: DrawShape): Record<AnchorSide, Point> {
    const b = getBounds(shape);
    const c = getCenter(shape);
    const raw: Record<AnchorSide, Point> = {
        top:    { x: b.x + b.w / 2, y: b.y },
        right:  { x: b.x + b.w,     y: b.y + b.h / 2 },
        bottom: { x: b.x + b.w / 2, y: b.y + b.h },
        left:   { x: b.x,           y: b.y + b.h / 2 },
        center: { x: c.x,           y: c.y },
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
    let best: { anchor: AnchorSide; point: Point; d: number } | null = null;
    (Object.keys(anchors) as AnchorSide[]).forEach(k => {
        if (k === "center") return;
        const d = Math.hypot(p.x - anchors[k].x, p.y - anchors[k].y);
        if (!best || d < best.d) best = { anchor: k, point: anchors[k], d };
    });
    return best && best.d <= threshold ? { anchor: best.anchor, point: best.point } : null;
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
    let end:   Point = { x: arrow.x2 ?? 0, y: arrow.y2 ?? 0 };
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

export function getArrowPath(arrow: DrawShape, all: DrawShape[]): Point[] {
    const { start, end } = resolveArrowEndpoints(arrow, all);
    if (arrow.connectorType === "elbow") {
        const bend = arrow.waypoint ?? { x: end.x, y: start.y };
        return [start, { x: bend.x, y: start.y }, { x: bend.x, y: end.y }, end];
    }
    return [start, end];
}

export function getArrowMidSegment(arrow: DrawShape): { a: Point; b: Point } {
    if (arrow.connectorType === "elbow" && arrow.waypoint) {
        const start = { x: arrow.x1 ?? 0, y: arrow.y1 ?? 0 };
        const end   = { x: arrow.x2 ?? 0, y: arrow.y2 ?? 0 };
        return { a: { x: arrow.waypoint.x, y: start.y }, b: { x: arrow.waypoint.x, y: end.y } };
    }
    return { a: { x: arrow.x1 ?? 0, y: arrow.y1 ?? 0 }, b: { x: arrow.x2 ?? 0, y: arrow.y2 ?? 0 } };
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
    if (arrow.connectorType === "elbow" && arrow.waypoint) {
        if (Math.hypot(p.x - arrow.waypoint.x, p.y - arrow.waypoint.y) <= r) return "bend";
    }
    return null;
}

// ============================================================================
// HIT TESTING
// ============================================================================

function hitTest(shape: DrawShape, px: number, py: number, all?: DrawShape[]): boolean {
    if (shape.type === "arrow") {
        return hitTestArrow(shape, all ?? [shape], { x: px, y: py }, 12);
    }
    const c  = getCenter(shape);
    const lp = rotPt(px, py, c.x, c.y, -(shape.rotation || 0));
    const b  = getBounds(shape), pad = 8;
    return lp.x >= b.x - pad && lp.x <= b.x + b.w + pad && lp.y >= b.y - pad && lp.y <= b.y + b.h + pad;
}

// ============================================================================
// DRAWING
// ============================================================================

function drawShape(ctx: CanvasRenderingContext2D, shape: DrawShape): void {
    ctx.save();
    applyShapeRotation(ctx, shape);
    ctx.globalAlpha = shape.opacity ?? 1;
    ctx.strokeStyle = shape.color ?? "#f8fafc";
    ctx.lineWidth   = shape.strokeWidth ?? 2;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    switch (shape.type) {
        case "pen": {
            const pts = shape.points; if (!pts || pts.length < 2) break;
            ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) {
                const mid = { x: (pts[i-1].x + pts[i].x) / 2, y: (pts[i-1].y + pts[i].y) / 2 };
                ctx.quadraticCurveTo(pts[i-1].x, pts[i-1].y, mid.x, mid.y);
            }
            ctx.lineTo(pts[pts.length-1].x, pts[pts.length-1].y); ctx.stroke(); break;
        }
        case "eraser": {
            const pts = shape.points; if (!pts || pts.length < 2) break;
            ctx.globalCompositeOperation = "destination-out"; ctx.strokeStyle = "rgba(0,0,0,1)"; ctx.lineWidth = (shape.strokeWidth ?? 2) * 6;
            ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
            ctx.stroke(); break;
        }
        case "line": ctx.beginPath(); ctx.moveTo(shape.x1??0,shape.y1??0); ctx.lineTo(shape.x2??0,shape.y2??0); ctx.stroke(); break;
        case "arrow": {
            // path from current x1/y1/x2/y2 (caller pre-resolves bindings), with optional elbow waypoint
            const path: Point[] = shape.connectorType === "elbow" && shape.waypoint
                ? [{ x: shape.x1 ?? 0, y: shape.y1 ?? 0 },
                   { x: shape.waypoint.x, y: shape.y1 ?? 0 },
                   { x: shape.waypoint.x, y: shape.y2 ?? 0 },
                   { x: shape.x2 ?? 0, y: shape.y2 ?? 0 }]
                : [{ x: shape.x1 ?? 0, y: shape.y1 ?? 0 }, { x: shape.x2 ?? 0, y: shape.y2 ?? 0 }];

            ctx.beginPath();
            ctx.moveTo(path[0].x, path[0].y);
            for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
            ctx.stroke();

            const p1 = path[path.length - 2], p2 = path[path.length - 1];
            const dx = p2.x - p1.x, dy = p2.y - p1.y;
            const angle = Math.atan2(dy, dx);
            const head = Math.min(18, Math.sqrt(dx * dx + dy * dy) * 0.35);
            ctx.beginPath();
            ctx.moveTo(p2.x, p2.y);
            ctx.lineTo(p2.x - head * Math.cos(angle - Math.PI / 6), p2.y - head * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(p2.x - head * Math.cos(angle + Math.PI / 6), p2.y - head * Math.sin(angle + Math.PI / 6));
            ctx.closePath();
            ctx.fillStyle = shape.color ?? "#f8fafc";
            ctx.fill();
            break;
        }
        case "rect": {
            const x1=shape.x1??0,y1=shape.y1??0,x2=shape.x2??0,y2=shape.y2??0;
            const x=Math.min(x1,x2),y=Math.min(y1,y2),w=Math.abs(x2-x1),h=Math.abs(y2-y1);
            ctx.beginPath();
            if(shape.rounded && (ctx as CanvasRenderingContext2D & { roundRect?: (x:number,y:number,w:number,h:number,r:number)=>void }).roundRect) {
                (ctx as CanvasRenderingContext2D & { roundRect: (x:number,y:number,w:number,h:number,r:number)=>void }).roundRect(x,y,w,h,shape.roundedRadius??8);
            } else ctx.rect(x,y,w,h);
            if(shape.fill&&shape.fill!=="none"){ctx.fillStyle=shape.fill;ctx.fill();} ctx.stroke(); break;
        }
        case "ellipse": {
            const x1=shape.x1??0,y1=shape.y1??0,x2=shape.x2??0,y2=shape.y2??0;
            const cx=(x1+x2)/2,cy=(y1+y2)/2,rx=Math.abs(x2-x1)/2,ry=Math.abs(y2-y1)/2;
            ctx.beginPath(); ctx.ellipse(cx,cy,Math.max(rx,1),Math.max(ry,1),0,0,Math.PI*2);
            if(shape.fill&&shape.fill!=="none"){ctx.fillStyle=shape.fill;ctx.fill();} ctx.stroke(); break;
        }
        case "diamond": {
            const x1=shape.x1??0,y1=shape.y1??0,x2=shape.x2??0,y2=shape.y2??0;
            const cx=(x1+x2)/2,cy=(y1+y2)/2,rx=Math.abs(x2-x1)/2,ry=Math.abs(y2-y1)/2;
            ctx.beginPath(); ctx.moveTo(cx,cy-ry); ctx.lineTo(cx+rx,cy); ctx.lineTo(cx,cy+ry); ctx.lineTo(cx-rx,cy); ctx.closePath();
            if(shape.fill&&shape.fill!=="none"){ctx.fillStyle=shape.fill;ctx.fill();} ctx.stroke(); break;
        }
        case "text": {
            const fs=shape.fontSize??18; ctx.font=`${fs}px 'JetBrains Mono',monospace`; ctx.fillStyle=shape.color?? "#f8fafc"; ctx.globalAlpha=shape.opacity??1;
            (shape.text??"").split("\n").forEach((line,i)=>ctx.fillText(line,shape.x??0,(shape.y??0)+i*fs*1.3)); break;
        }
    }
    // embedded label (rotates with shape) for rect/ellipse/diamond
    if (shape.label && (shape.type === "rect" || shape.type === "ellipse" || shape.type === "diamond")) {
        drawShapeLabelInner(ctx, shape);
    }
    ctx.restore();
}

function drawEraserGhost(ctx: CanvasRenderingContext2D, shape: DrawShape, zoom: number): void {
    const pts = shape.points; if (!pts || pts.length < 2) return;
    ctx.save(); applyShapeRotation(ctx, shape);
    ctx.strokeStyle="#fb923c"; ctx.lineWidth=(shape.strokeWidth??2)*6; ctx.lineCap="round"; ctx.lineJoin="round"; ctx.globalAlpha=0.5; ctx.setLineDash([10/zoom,7/zoom]);
    ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y); for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x,pts[i].y); ctx.stroke();
    ctx.restore();
}

function drawSelectionOverlay(ctx: CanvasRenderingContext2D, shape: DrawShape, zoom: number, allShapes?: DrawShape[]): void {
    // arrow gets dedicated endpoint handles
    if (shape.type === "arrow") {
        const all = allShapes ?? [shape];
        const { start, end } = resolveArrowEndpoints(shape, all);
        const r = 7 / zoom;
        ctx.save();
        ctx.fillStyle = "#fff";
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 2 / zoom;
        ctx.shadowColor = "#3b82f6"; ctx.shadowBlur = 4 / zoom;
        [start, end].forEach(pt => {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();
        });
        if (shape.connectorType === "elbow" && shape.waypoint) {
            ctx.fillStyle = "#fbbf24";
            ctx.beginPath();
            ctx.arc(shape.waypoint.x, shape.waypoint.y, r, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();
        }
        ctx.restore();
        return;
    }

    ctx.save();
    applyShapeRotation(ctx, shape);
    const b = getBounds(shape), c = getCenter(shape);
    const pad = 8, hw = 5/zoom, lw = 1.5/zoom;
    ctx.strokeStyle="#3b82f6"; ctx.lineWidth=lw; ctx.setLineDash([6/zoom,4/zoom]);
    ctx.strokeRect(b.x-pad,b.y-pad,b.w+pad*2,b.h+pad*2); ctx.setLineDash([]);
    const corners: [number,number][] = [
        [b.x-pad, b.y-pad], [b.x+b.w+pad, b.y-pad],
        [b.x-pad, b.y+b.h+pad], [b.x+b.w+pad, b.y+b.h+pad],
    ];
    corners.forEach(([hx,hy])=>{
        ctx.fillStyle="#fff"; ctx.shadowColor="#3b82f6"; ctx.shadowBlur=4/zoom;
        ctx.fillRect(hx-hw,hy-hw,hw*2,hw*2); ctx.shadowBlur=0;
        ctx.strokeStyle="#3b82f6"; ctx.lineWidth=lw; ctx.strokeRect(hx-hw,hy-hw,hw*2,hw*2);
    });
    const hY=b.y-45/zoom;
    ctx.strokeStyle="#3b82f6"; ctx.lineWidth=lw*1.5; ctx.lineCap="round"; ctx.shadowColor="#3b82f6"; ctx.shadowBlur=6/zoom;
    ctx.beginPath(); ctx.moveTo(c.x,b.y-pad); ctx.lineTo(c.x,hY); ctx.stroke(); ctx.shadowBlur=0;
    ctx.beginPath(); ctx.arc(c.x,hY,10/zoom,0,Math.PI*2); ctx.fillStyle="#3b82f6"; ctx.fill();
    ctx.strokeStyle="#fff"; ctx.lineWidth=2/zoom; ctx.stroke();
    ctx.restore();
}

function drawDotGrid(ctx: CanvasRenderingContext2D, w: number, h: number, pan: Point, bgColor: string): void {
    ctx.fillStyle=bgColor; ctx.fillRect(0,0,w,h);
    const spacing=28, ox=((pan.x%spacing)+spacing)%spacing, oy=((pan.y%spacing)+spacing)%spacing;
    const hex=bgColor.replace("#",""), r=parseInt(hex.slice(0,2),16)||0, g=parseInt(hex.slice(2,4),16)||0, b=parseInt(hex.slice(4,6),16)||0;
    ctx.fillStyle=(0.2126*r+0.7152*g+0.0722*b)>128?"rgba(0,0,0,0.15)":"rgba(255,255,255,0.12)";
    for(let x=ox;x<w;x+=spacing) for(let y=oy;y<h;y+=spacing){ctx.beginPath();ctx.arc(x,y,1,0,Math.PI*2);ctx.fill();}
}

// ============================================================================
// ICONS
// ============================================================================

const Ic: Record<string, ReactNode> = {
    select:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51z"/></svg>,
    pan:      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/></svg>,
    pen:      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19l7-7 3 3-7 7-3-3z M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z M2 2l7.586 7.586"/></svg>,
    eraser:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 20H7l-4-4 8-8 12 12-3 0M14 6l8 8"/></svg>,
    line:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 19L19 5"/></svg>,
    arrow:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>,
    rect:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>,
    ellipse:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/></svg>,
    diamond:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L22 12 12 22 2 12z"/></svg>,
    text:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg>,
    undo:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v6h6M3 13a9 9 0 1 0 3-7.7L3 8"/></svg>,
    redo:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 7v6h-6M21 13a9 9 0 1 1-3-7.7L21 8"/></svg>,
    trash:    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>,
    download: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>,
    pdf:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6"/></svg>,
    edit:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>,
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

type ToolBtnProps = { active?: boolean; label: string; onClick: () => void; danger?: boolean; children: ReactNode };
function ToolBtn({ active, label, onClick, danger, children }: ToolBtnProps) {
    const [hov, setHov] = useState(false);
    return (
        <button onClick={onClick} title={label} aria-label={label}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{ width:36, height:36, display:"flex", alignItems:"center", justifyContent:"center", borderRadius:8, border:"none", cursor:"pointer", transition:"all 0.12s",
                background: active?"#2563eb":hov?"#1e293b":"transparent",
                color: danger?(hov?"#fca5a5":"#f87171"):active?"#fff":hov?"#f1f5f9":"#64748b",
                boxShadow: active?"0 0 0 1px #3b82f644,0 2px 8px #1d4ed840":"none" }}>
            {children}
        </button>
    );
}

function SwatchGrid({ value, onChange }: { value: string; onChange: (c: string) => void }) {
    return (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:5 }}>
            {COLORS.map(c => <button key={c} onClick={() => onChange(c)} style={{ width:"100%", aspectRatio:"1", borderRadius:5, border:"none", cursor:"pointer", background:c, outline:value===c?"2px solid #3b82f6":"1px solid rgba(255,255,255,0.06)", outlineOffset:1, transform:value===c?"scale(1.15)":"scale(1)", transition:"all 0.1s" }}/>)}
        </div>
    );
}

function ColorHexRow({ value, onChange }: { value: string; onChange: (c: string) => void }) {
    return (
        <div style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 6px", background:"#0f1f35", borderRadius:5, marginTop:6 }}>
            <input type="color" value={value} onChange={e => onChange(e.target.value)} style={{ width:22, height:22, border:"1px solid #1e293b", borderRadius:4, padding:0, cursor:"pointer", background:"transparent" }}/>
            <span style={{ fontSize:9, color:"#64748b", fontFamily:"monospace" }}>{value}</span>
        </div>
    );
}

function Dot({ color }: { color: string }) { return <span style={{ display:"inline-block", width:8, height:8, borderRadius:"50%", background:color }}/>; }

const SEC_LABEL: CSSProperties = { fontSize:9, letterSpacing:"0.13em", textTransform:"uppercase", color:"#334155", fontWeight:700, marginBottom:8, display:"flex", alignItems:"center", gap:6 };

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function DrawingPad({ shapes, setShapes, bgColor, setBgColor, zoom, setZoom, pan, setPan, onSave, onSync, savedToast, hasLocalCache }: DrawingPadProps) {
    const canvasRef    = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const textareaRef  = useRef<HTMLTextAreaElement>(null);
    const labelTextareaRef = useRef<HTMLTextAreaElement>(null);
    const stateRef     = useRef<DrawStateRef>({ shapes:[], zoom:1, pan:{x:0,y:0}, selectedId:null, selectedIds:new Set() });
    const textActiveRef    = useRef(false);
    const preDragRef       = useRef<DrawShape[] | null>(null);
    const origShapesRef    = useRef<Map<number | string, DrawShape>>(new Map());
    const bgColorRef       = useRef(bgColor);
    const attachedErasersRef = useRef<DrawShape[]>([]);
    const marqueeStartRef  = useRef<Point | null>(null);
    const arrowEndpointDragRef = useRef<{ arrowId: number | string; handle: ArrowEndpointHandle } | null>(null);

    const [tool,          setTool]          = useState<Tool>(TOOLS.PEN);
    const [color,         setColor]         = useState("#f8fafc");
    const [strokeWidth,   setStrokeWidth]   = useState(2);
    const [fillColor,     setFillColor]     = useState("none");
    const [opacity,       setOpacity]       = useState(1);
    const [rounded,       setRounded]       = useState(false);
    const [roundedRadius, setRoundedRadius] = useState(8);
    const [, setUndoStack] = useState<DrawShape[][]>([]);
    const [, setRedoStack] = useState<DrawShape[][]>([]);
    const [preview,       setPreview]       = useState<DrawShape | null>(null);
    const [isDrawing,     setIsDrawing]     = useState(false);
    const [startPos,      setStartPos]      = useState<Point>({x:0,y:0});
    const [currentPath,   setCurrentPath]   = useState<Point[]>([]);
    const [isPanning,     setIsPanning]     = useState(false);
    const [panStart,      setPanStart]      = useState<Point>({x:0,y:0});
    const [textInput,     setTextInput]     = useState<Point | null>(null);
    const [textVal,       setTextVal]       = useState("");
    const [editingTextId, setEditingTextId] = useState<number | string | null>(null);
    const [editingLabelId,setEditingLabelId]= useState<number | string | null>(null);
    const [labelEditVal,  setLabelEditVal]  = useState("");
    const [selectedId,    setSelectedId]    = useState<number | string | null>(null);
    const [selectedIds,   setSelectedIds]   = useState<Set<number | string>>(new Set());
    const [,              setMarquee]       = useState<{x1:number;y1:number;x2:number;y2:number}|null>(null);
    const [selMode,       setSelMode]       = useState<SelMode | null>(null);
    const [selStartPos,   setSelStartPos]   = useState<Point | null>(null);
    const [selOrigShape,  setSelOrigShape]  = useState<DrawShape | null>(null);
    const [resizeHandle,  setResizeHandle]  = useState<ResizeHandle | null>(null);
    const [justDrawnId,   setJustDrawnId]   = useState<number | string | null>(null);
    const [showDlMenu,    setShowDlMenu]    = useState(false);
    const [showBgPicker,  setShowBgPicker]  = useState(false);
    const [canvasCursor,  setCanvasCursor]  = useState("crosshair");

    useEffect(() => { stateRef.current  = { shapes, zoom, pan, selectedId, selectedIds }; }, [shapes, zoom, pan, selectedId, selectedIds]);
    useEffect(() => { bgColorRef.current = bgColor; }, [bgColor]);
    useEffect(() => { textActiveRef.current = textInput !== null || editingLabelId !== null; }, [textInput, editingLabelId]);
    useEffect(() => { if (!textInput || !textareaRef.current) return; requestAnimationFrame(() => { textareaRef.current?.focus(); textareaRef.current?.select(); }); }, [textInput]);
    useEffect(() => { if (editingLabelId == null || !labelTextareaRef.current) return; requestAnimationFrame(() => { labelTextareaRef.current?.focus(); labelTextareaRef.current?.select(); }); }, [editingLabelId]);

    // ------------------------------------------------------------------------
    // REDRAW
    // ------------------------------------------------------------------------
    const redraw = useCallback((previewShape: DrawShape | null) => {
        const canvas = canvasRef.current; if (!canvas) return;
        const ctx = canvas.getContext("2d"); if (!ctx) return;
        const { shapes, zoom, pan, selectedId, selectedIds } = stateRef.current;
        drawDotGrid(ctx, canvas.width, canvas.height, pan, bgColorRef.current);

        const off = document.createElement("canvas"); off.width = canvas.width; off.height = canvas.height;
        const octx = off.getContext("2d")!;
        octx.save(); octx.translate(pan.x, pan.y); octx.scale(zoom, zoom);

        // resolve bound arrow endpoints once for this frame
        const resolved = shapes.map(s => {
            if (s.type !== "arrow") return s;
            const { start, end } = resolveArrowEndpoints(s, shapes);
            return { ...s, x1: start.x, y1: start.y, x2: end.x, y2: end.y };
        });
        resolved.forEach(s => drawShape(octx, s));

        // arrow labels (drawn after path, no rotation, with bg pill)
        resolved.forEach(s => {
            if (s.type === "arrow" && s.label) {
                const seg = getArrowMidSegment(s);
                const mx = (seg.a.x + seg.b.x) / 2, my = (seg.a.y + seg.b.y) / 2;
                const fs = s.labelFontSize ?? 14;
                const lines = s.label.split("\n");
                octx.save();
                octx.font = `${fs}px 'JetBrains Mono',monospace`;
                octx.textAlign = "center";
                octx.textBaseline = "middle";
                lines.forEach((line, i) => {
                    const w = octx.measureText(line).width + 12;
                    const ly = my + (i - (lines.length - 1) / 2) * fs * 1.3;
                    octx.fillStyle = bgColorRef.current;
                    octx.fillRect(mx - w / 2, ly - fs * 0.65, w, fs * 1.25);
                    octx.fillStyle = s.labelColor ?? s.color ?? "#f8fafc";
                    octx.fillText(line, mx, ly);
                });
                octx.restore();
            }
        });

        if (previewShape) drawShape(octx, previewShape);
        octx.restore();
        ctx.drawImage(off, 0, 0);

        // selection overlays in screen space (still scaled)
        ctx.save(); ctx.translate(pan.x, pan.y); ctx.scale(zoom, zoom);
        const activeIds: Set<number | string> = selectedIds.size > 0
            ? selectedIds
            : (selectedId ? new Set<number | string>([selectedId]) : new Set<number | string>());
        activeIds.forEach(id => {
            const sel = resolved.find(s => s.id === id);
            if (!sel) return;
            if (sel.type === "eraser") drawEraserGhost(ctx, sel, zoom);
            else drawSelectionOverlay(ctx, sel, zoom, resolved);
        });
        const mq = (previewShape as DrawShape & { _marquee?: {x1:number;y1:number;x2:number;y2:number} } | null)?._marquee;
        if (mq) {
            ctx.strokeStyle = "#3b82f6"; ctx.lineWidth = 1 / zoom; ctx.setLineDash([5/zoom, 3/zoom]); ctx.fillStyle = "rgba(59,130,246,0.08)";
            const mx = Math.min(mq.x1, mq.x2), my = Math.min(mq.y1, mq.y2);
            const mw = Math.abs(mq.x2 - mq.x1), mh = Math.abs(mq.y2 - mq.y1);
            ctx.fillRect(mx, my, mw, mh); ctx.strokeRect(mx, my, mw, mh); ctx.setLineDash([]);
        }
        ctx.restore(); canvas.style.background = bgColorRef.current;
    }, []);

    useEffect(() => { redraw(preview); }, [shapes, pan, zoom, selectedId, selectedIds, preview, bgColor, redraw]);

    useEffect(() => {
    const resize = () => {
        const c = canvasRef.current;
        const ct = containerRef.current;
        if (!c || !ct) return;

        const dpr = window.devicePixelRatio || 1;

        c.width = ct.clientWidth * dpr;
        c.height = ct.clientHeight * dpr;

        c.style.width = ct.clientWidth + "px";
        c.style.height = ct.clientHeight + "px";

        const ctx = c.getContext("2d");
        ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);

        redraw(null);
    };

    resize();
    const obs = new ResizeObserver(resize);
    if (containerRef.current) obs.observe(containerRef.current);

    return () => obs.disconnect();
}, [redraw]);

    const toCanvas = useCallback((e: { clientX: number; clientY: number }) => {
        const c = canvasRef.current; if (!c) return { x: 0, y: 0 }; const r = c.getBoundingClientRect(); const { zoom, pan } = stateRef.current;
        return { x: (e.clientX - r.left - pan.x) / zoom, y: (e.clientY - r.top - pan.y) / zoom };
    }, []);

    // ------------------------------------------------------------------------
    // HISTORY + EDITS
    // ------------------------------------------------------------------------
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
                return [...base, { id: uid(), type: "text" as ShapeType, x: ti.x, y: ti.y, text: val, color, fontSize: 14 + strokeWidth * 2, opacity }];
            });
        } else if (editingTextId && !val) {
            pushHistory(stateRef.current.shapes); setShapes(s => s.filter(sh => sh.id !== editingTextId));
        }
        setTextInput(null); setTextVal(""); setEditingTextId(null);
    }, [textInput, textVal, color, strokeWidth, opacity, pushHistory, editingTextId, setShapes]);

    const openTextEdit = useCallback((shape: DrawShape) => {
        setEditingTextId(shape.id); setTextInput({ x: shape.x ?? 0, y: shape.y ?? 0 }); setTextVal(shape.text ?? "");
        requestAnimationFrame(() => { textareaRef.current?.focus(); textareaRef.current?.select(); });
    }, []);

    // label editing on shapes (rect/ellipse/diamond/arrow)
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

    const updateSelectedColor = useCallback((c: string) => { if (!stateRef.current.selectedId) return; pushHistory(stateRef.current.shapes); setShapes(s => s.map(sh => sh.id === stateRef.current.selectedId ? { ...sh, color: c } : sh)); }, [pushHistory, setShapes]);
    const updateSelectedFill  = useCallback((f: string) => { if (!stateRef.current.selectedId) return; pushHistory(stateRef.current.shapes); setShapes(s => s.map(sh => sh.id === stateRef.current.selectedId ? { ...sh, fill: f } : sh)); }, [pushHistory, setShapes]);
    const updateJustDrawnColor = useCallback((c: string) => { if (!justDrawnId) return; setColor(c); setShapes(s => s.map(sh => sh.id === justDrawnId ? { ...sh, color: c } : sh)); }, [justDrawnId, setShapes]);
    const updateJustDrawnFill  = useCallback((f: string) => { if (!justDrawnId) return; setFillColor(f); setShapes(s => s.map(sh => sh.id === justDrawnId ? { ...sh, fill: f } : sh)); }, [justDrawnId, setShapes]);
    const updateJustDrawnSW    = useCallback((w: number) => { if (!justDrawnId) return; setStrokeWidth(w); setShapes(s => s.map(sh => sh.id === justDrawnId ? { ...sh, strokeWidth: w } : sh)); }, [justDrawnId, setShapes]);
    const updateJustDrawnRR    = useCallback((r: number) => { if (!justDrawnId) return; setRoundedRadius(r); setShapes(s => s.map(sh => sh.id === justDrawnId ? { ...sh, roundedRadius: r } : sh)); }, [justDrawnId, setShapes]);

    // ------------------------------------------------------------------------
    // KEYBOARD
    // ------------------------------------------------------------------------
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
                // also remove arrows whose bindings reference removed shapes? keep them as free arrows instead
                setShapes(s => s.filter(sh => !ids.has(sh.id)).map(sh => {
                    if (sh.type !== "arrow") return sh;
                    const next = { ...sh };
                    if (next.startBinding && ids.has(next.startBinding.shapeId)) next.startBinding = undefined;
                    if (next.endBinding && ids.has(next.endBinding.shapeId)) next.endBinding = undefined;
                    return next;
                }));
                setSelectedId(null); setSelectedIds(new Set()); return;
            }
            if (cmd) {
                const map: Record<string, Tool> = { "1": TOOLS.SELECT, "2": TOOLS.PAN, "3": TOOLS.PEN, "4": TOOLS.ERASER, "5": TOOLS.LINE, "6": TOOLS.ARROW, "7": TOOLS.RECT, "8": TOOLS.ELLIPSE, "9": TOOLS.DIAMOND, "0": TOOLS.TEXT };
                if (map[e.key]) { e.preventDefault(); setTool(map[e.key]); }
            }
        };
        window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
    }, [undo, redo, pushHistory, setShapes]);

    useEffect(() => {
        const el = canvasRef.current; if (!el) return;
        const onWheel = (e: WheelEvent) => { e.preventDefault(); const zoomSpeed = 0.0015; const delta = -e.deltaY * zoomSpeed; setZoom(z => { const next = z + delta; return Math.min(20, Math.max(0.1, next)); }); };
        el.addEventListener("wheel", onWheel, { passive: false }); return () => el.removeEventListener("wheel", onWheel);
    }, [setZoom]);

    // ------------------------------------------------------------------------
    // DOUBLE CLICK -> label/text edit
    // ------------------------------------------------------------------------
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

    // ------------------------------------------------------------------------
    // CURSOR
    // ------------------------------------------------------------------------
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

    // ------------------------------------------------------------------------
    // MOUSE DOWN
    // ------------------------------------------------------------------------
    const onMouseDown = useCallback((e: ReactMouseEvent) => {
        if (textActiveRef.current) return;
        setJustDrawnId(null); setShowDlMenu(false); setShowBgPicker(false);
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

            // arrow endpoint handles take priority for currently-selected arrow
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

            // resize / rotate handles for non-arrow shapes
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

            // move existing selection
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

        // drawing tool
        setIsDrawing(true); setStartPos(pos);
        if (tool === TOOLS.PEN || tool === TOOLS.ERASER) setCurrentPath([pos]);
    }, [tool, toCanvas, openTextEdit]);

    // ------------------------------------------------------------------------
    // MOUSE MOVE
    // ------------------------------------------------------------------------
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
                        if (handle === "bend") {
                            next.waypoint = { x: pos.x, y: pos.y };
                            return next;
                        }
                        const target = findBindingTarget(stateRef.current.shapes, pos, sh.id);
                        if (handle === "start") {
                            if (target) { next.startBinding = { shapeId: target.shape.id, anchor: target.anchor }; next.x1 = target.point.x; next.y1 = target.point.y; }
                            else        { next.startBinding = undefined; next.x1 = pos.x; next.y1 = pos.y; }
                        } else {
                            if (target) { next.endBinding = { shapeId: target.shape.id, anchor: target.anchor }; next.x2 = target.point.x; next.y2 = target.point.y; }
                            else        { next.endBinding = undefined; next.x2 = pos.x; next.y2 = pos.y; }
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
                setPreview({ id: "preview", type: tool, points: next, color, strokeWidth, opacity });
                return next;
            });
            return;
        }
        const base: DrawShape = { id: "preview", type: "line", color, strokeWidth, fill: fillColor, opacity, rounded, roundedRadius, x1: startPos.x, y1: startPos.y, x2: pos.x, y2: pos.y };
        const tmap: Partial<Record<Tool, ShapeType>> = { [TOOLS.LINE]: "line", [TOOLS.ARROW]: "arrow", [TOOLS.RECT]: "rect", [TOOLS.ELLIPSE]: "ellipse", [TOOLS.DIAMOND]: "diamond" };
        if (tmap[tool]) setPreview({ ...base, type: tmap[tool]! });
    }, [isPanning, panStart, tool, selMode, selOrigShape, selStartPos, resizeHandle, isDrawing, toCanvas, color, strokeWidth, fillColor, opacity, rounded, roundedRadius, startPos, setPan, setShapes, getCanvasCursor]);

    // ------------------------------------------------------------------------
    // MOUSE UP
    // ------------------------------------------------------------------------
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
            setShapes(s => [...s, { id: nid, type: tool, points: currentPath, color, strokeWidth, opacity }]);
            setJustDrawnId(nid); setCurrentPath([]); return;
        }
        if (Math.hypot(pos.x - startPos.x, pos.y - startPos.y) < 4) return;

        const baseId = uid();
        const base = { id: baseId, color, strokeWidth, fill: fillColor, opacity, rounded, roundedRadius, x1: startPos.x, y1: startPos.y, x2: pos.x, y2: pos.y };
        const tmap: Partial<Record<Tool, ShapeType>> = { [TOOLS.LINE]: "line", [TOOLS.ARROW]: "arrow", [TOOLS.RECT]: "rect", [TOOLS.ELLIPSE]: "ellipse", [TOOLS.DIAMOND]: "diamond" };
        const st = tmap[tool];
        if (!st) return;

        if (st === "arrow") {
            const startTarget = findBindingTarget(stateRef.current.shapes, { x: startPos.x, y: startPos.y });
            const endTarget   = findBindingTarget(stateRef.current.shapes, pos);
            const arrow: DrawShape = {
                ...base, type: "arrow", connectorType: "straight",
                startBinding: startTarget ? { shapeId: startTarget.shape.id, anchor: startTarget.anchor } : undefined,
                endBinding:   endTarget   ? { shapeId: endTarget.shape.id,   anchor: endTarget.anchor }   : undefined,
                x1: startTarget?.point.x ?? startPos.x, y1: startTarget?.point.y ?? startPos.y,
                x2: endTarget?.point.x   ?? pos.x,      y2: endTarget?.point.y   ?? pos.y,
            };
            setShapes(s => [...s, arrow]); setJustDrawnId(arrow.id); return;
        }

        setShapes(s => [...s, { ...base, type: st }]);
        setJustDrawnId(baseId);
    }, [isPanning, tool, selMode, isDrawing, toCanvas, pushHistory, currentPath, color, strokeWidth, fillColor, opacity, rounded, roundedRadius, startPos, setShapes]);

    // ------------------------------------------------------------------------
    // EXPORT
    // ------------------------------------------------------------------------
    const buildExportCanvas = () => {
        const src = canvasRef.current; if (!src) return null;
        const out = document.createElement("canvas"); out.width = src.width; out.height = src.height;
        const ctx = out.getContext("2d")!; ctx.fillStyle = bgColor; ctx.fillRect(0, 0, out.width, out.height); ctx.drawImage(src, 0, 0);
        return out;
    };
    const exportPNG = () => { const out = buildExportCanvas(); if (!out) return; const a = document.createElement("a"); a.download = "drawing.png"; a.href = out.toDataURL(); a.click(); };
    const exportPDF = () => {
        const out = buildExportCanvas(); if (!out) return;
        const win = window.open("", "_blank"); if (!win) { alert("Allow popups."); return; }
        win.document.write(`<style>@page{margin:0;size:${out.width}px ${out.height}px;}*{margin:0;padding:0;}body{background:${bgColor};}img{display:block;max-width:100%;}.tip{position:fixed;top:12px;right:12px;background:#1e293b;color:#94a3b8;font:12px monospace;padding:8px 14px;border-radius:8px;}@media print{.tip{display:none;}}</style><div class="tip">⌘P to save as PDF</div><img src="${out.toDataURL()}"/>`);
        win.document.close();
    };
    const clearAll = useCallback(() => { pushHistory(stateRef.current.shapes); setShapes([]); setSelectedId(null); }, [pushHistory, setShapes]);

    // ------------------------------------------------------------------------
    // PANEL DERIVED VALUES
    // ------------------------------------------------------------------------
    const hasFill = ([TOOLS.RECT, TOOLS.ELLIPSE, TOOLS.DIAMOND] as Tool[]).includes(tool);
    const selShape = shapes.find(s => s.id === selectedId);
    const rotDeg   = selShape ? Math.round(((selShape.rotation || 0) * 180 / Math.PI + 360) % 360) : 0;
    const selHasFill = selShape && (selShape.type === "rect" || selShape.type === "ellipse" || selShape.type === "diamond");
    const jdShape  = shapes.find(s => s.id === justDrawnId);
    const jdHasFill = jdShape && (jdShape.type === "rect" || jdShape.type === "ellipse" || jdShape.type === "diamond");
    const jdIsRect  = jdShape?.type === "rect";

    const toolGroups = [
        [{ id: TOOLS.SELECT, label: "Select  ⌘1" }, { id: TOOLS.PAN, label: "Pan  ⌘2" }],
        [{ id: TOOLS.PEN, label: "Pen  ⌘3" }, { id: TOOLS.ERASER, label: "Eraser  ⌘4" }],
        [{ id: TOOLS.LINE, label: "Line  ⌘5" }, { id: TOOLS.ARROW, label: "Arrow  ⌘6" }],
        [{ id: TOOLS.RECT, label: "Rect  ⌘7" }, { id: TOOLS.ELLIPSE, label: "Ellipse  ⌘8" }, { id: TOOLS.DIAMOND, label: "Diamond  ⌘9" }],
        [{ id: TOOLS.TEXT, label: "Text  ⌘0" }],
    ];

    // label edit overlay positioning
    const labelEditShape = editingLabelId != null ? shapes.find(x => x.id === editingLabelId) : null;
    let labelOverlay: { x: number; y: number; w: number; h: number; fs: number; isArrow: boolean; color: string } | null = null;
    if (labelEditShape) {
        // for bound arrows, resolve before computing label box
        const resolvedShape = labelEditShape.type === "arrow"
            ? (() => { const { start, end } = resolveArrowEndpoints(labelEditShape, shapes); return { ...labelEditShape, x1: start.x, y1: start.y, x2: end.x, y2: end.y }; })()
            : labelEditShape;
        const box = getShapeLabelBox(resolvedShape);
        const fs = labelEditShape.labelFontSize ?? 14;
        labelOverlay = {
            x: box.x * zoom + pan.x, y: box.y * zoom + pan.y,
            w: Math.max(box.w * zoom, 60), h: Math.max(box.h * zoom, fs * 1.5 * zoom),
            fs: fs * zoom, isArrow: labelEditShape.type === "arrow",
            color: labelEditShape.labelColor ?? labelEditShape.color ?? "#f8fafc",
        };
    }

    return (
        <div ref={containerRef} style={{ position: "relative", width: "100%", height: "100vh", display: "flex", background: "#0d1117", overflow: "hidden", fontFamily: "'JetBrains Mono', monospace" }}>
            <style>{`@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500&display=swap');*{box-sizing:border-box}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#1e293b;border-radius:4px}input[type=range]{-webkit-appearance:none;width:100%;height:4px;border-radius:2px;background:#1e293b;outline:none;cursor:pointer}input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:50%;background:#3b82f6;cursor:pointer}input[type=color]{-webkit-appearance:none;width:22px;height:22px;border:none;border-radius:4px;padding:0;cursor:pointer;background:transparent}input[type=color]::-webkit-color-swatch-wrapper{padding:0;border-radius:4px}input[type=color]::-webkit-color-swatch{border:none;border-radius:4px}textarea{resize:none;outline:none;font-family:inherit}textarea::placeholder{color:#334155}.panel-sec{padding:12px 14px;border-bottom:1px solid #0f1f35;}.panel-sec:last-child{border-bottom:none;}`}</style>

            {/* TOOLBAR */}
            <div style={{ width: 56, background: "#0a0f1a", borderRight: "1px solid #0f1f35", display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 0", gap: 4 }}>
                {toolGroups.map((group, gi) => (
                    <div key={gi} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {gi > 0 && <div style={{ height: 1, width: 28, background: "#0f1f35", margin: "4px auto" }}/>}
                        {group.map(t => (
                            <ToolBtn key={t.id} active={tool === t.id} label={t.label} onClick={() => setTool(t.id)}>{Ic[t.id]}</ToolBtn>
                        ))}
                    </div>
                ))}
                <div style={{ flex: 1 }}/>
                <ToolBtn label="Undo  ⌘Z" onClick={undo}>{Ic.undo}</ToolBtn>
                <ToolBtn label="Redo  ⌘⇧Z" onClick={redo}>{Ic.redo}</ToolBtn>
                <ToolBtn label="Clear all" onClick={clearAll} danger>{Ic.trash}</ToolBtn>
            </div>

            {/* MAIN AREA */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
                {/* HEADER */}
                <div style={{ height: 48, background: "#0a0f1a", borderBottom: "1px solid #0f1f35", padding: "0 14px", display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 18, height: 18, borderRadius: 4, background: "linear-gradient(135deg,#3b82f6,#1d4ed8)" }}/>
                        <span style={{ fontSize: 13, color: "#f1f5f9", fontWeight: 500 }}>DrawPad</span>
                        {selShape && <span style={{ fontSize: 10, color: "#475569", marginLeft: 6 }}>{selShape.type} · {rotDeg}° · drag ■ to resize · drag ● to rotate</span>}
                    </div>
                    <div style={{ flex: 1 }}/>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative" }}>
                        <span style={{ fontSize: 9, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em" }}>Canvas</span>
                        <button onClick={() => setShowBgPicker(p => !p)} style={{ width: 24, height: 24, borderRadius: 5, border: "1px solid #334155", background: bgColor, cursor: "pointer", position: "relative", flexShrink: 0, transition: "transform 0.1s", transform: showBgPicker ? "scale(1.1)" : "scale(1)" }}/>
                        {showBgPicker && (
                            <div onClick={e => e.stopPropagation()} style={{ position: "absolute", top: 32, right: 0, background: "#0a0f1a", border: "1px solid #1e293b", borderRadius: 8, padding: 10, zIndex: 100, width: 200, boxShadow: "0 12px 30px rgba(0,0,0,0.5)" }}>
                                <div style={SEC_LABEL}>Background</div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 5 }}>
                                    {BG_PRESETS.map(({ label, value }) => (
                                        <button key={value} onClick={() => { setBgColor(value); setShowBgPicker(false); }} style={{ height: 28, borderRadius: 6, cursor: "pointer", border: "none", background: value, outline: bgColor === value ? "2px solid #3b82f6" : "1px solid rgba(255,255,255,0.1)", outlineOffset: 2, transform: bgColor === value ? "scale(1.06)" : "scale(1)", transition: "all 0.12s", fontSize: 7, color: ["#ffffff", "#fefce8", "#f8fafc"].includes(value) ? "#475569" : "#64748b", fontFamily: "inherit" }}>{label}</button>
                                    ))}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 0 0", marginTop: 8, borderTop: "1px solid #1e293b" }}>
                                    <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} style={{ width: 22, height: 22, border: "1px solid #334155", borderRadius: 4, cursor: "pointer" }}/>
                                    <span style={{ fontSize: 9, color: "#64748b", fontFamily: "monospace" }}>{bgColor}</span>
                                </div>
                            </div>
                        )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <button onClick={() => setZoom(z => Math.max(0.1, z / 1.25))} style={{ background: "#1e293b", border: "none", color: "#94a3b8", width: 26, height: 26, borderRadius: 6, cursor: "pointer", fontSize: 16, lineHeight: 1, fontFamily: "inherit" }}>−</button>
                        <span style={{ fontSize: 11, color: "#64748b", minWidth: 42, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
                        <button onClick={() => setZoom(z => Math.min(20, z * 1.25))} style={{ background: "#1e293b", border: "none", color: "#94a3b8", width: 26, height: 26, borderRadius: 6, cursor: "pointer", fontSize: 16, lineHeight: 1, fontFamily: "inherit" }}>+</button>
                        <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} style={{ background: "transparent", border: "none", color: "#475569", fontSize: 10, cursor: "pointer", padding: "0 4px", fontFamily: "inherit" }}>Reset</button>
                        <div style={{ width: 1, height: 18, background: "#1e293b", margin: "0 4px" }}/>
                        <button onClick={onSave} style={{ background: savedToast ? "#16a34a" : "#1e293b", border: "none", color: "#fff", padding: "5px 11px", borderRadius: 6, fontSize: 11, cursor: "pointer", fontFamily: "inherit", transition: "background 0.15s" }}>{savedToast ? "✓ Saved" : "Save"}</button>
                        {hasLocalCache && <button onClick={onSync} style={{ background: "#7c3aed", border: "none", color: "#fff", padding: "5px 11px", borderRadius: 6, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>↓ Sync DB</button>}
                        <div style={{ position: "relative" }}>
                            <button onClick={() => setShowDlMenu(m => !m)} style={{ display: "flex", alignItems: "center", gap: 5, background: "#1d4ed8", border: "none", color: "#fff", padding: "5px 11px", borderRadius: 6, fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>{Ic.download} Download ▾</button>
                            {showDlMenu && (
                                <div style={{ position: "absolute", top: 32, right: 0, background: "#0a0f1a", border: "1px solid #1e293b", borderRadius: 8, padding: 4, zIndex: 100, minWidth: 160, boxShadow: "0 12px 30px rgba(0,0,0,0.5)" }}>
                                    <button onClick={() => { exportPNG(); setShowDlMenu(false); }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "transparent", border: "none", color: "#94a3b8", padding: "9px 14px", fontSize: 11, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>{Ic.download} Image (PNG)</button>
                                    <div style={{ height: 1, background: "#1e293b", margin: "2px 0" }}/>
                                    <button onClick={() => { exportPDF(); setShowDlMenu(false); }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "transparent", border: "none", color: "#94a3b8", padding: "9px 14px", fontSize: 11, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>{Ic.pdf} PDF Document</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* CANVAS */}
                <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
                    <canvas
                        ref={canvasRef}
                        style={{ display: "block", width: "100%", height: "100%", cursor: canvasCursor }}
                        onMouseDown={onMouseDown}
                        onMouseMove={onMouseMove}
                        onMouseUp={onMouseUp}
                        onMouseLeave={onMouseUp}
                        onDoubleClick={onDoubleClick}
                    />

                    {/* standalone text input overlay */}
                    {textInput && (
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
                                top: (textInput.y - (14 + strokeWidth * 2)) * zoom + pan.y,
                                minWidth: 100, minHeight: (14 + strokeWidth * 2) * 1.4 * zoom,
                                fontSize: (14 + strokeWidth * 2) * zoom,
                                color, background: "transparent",
                                border: "1px dashed #3b82f6", padding: 2, zIndex: 50,
                                fontFamily: "'JetBrains Mono', monospace",
                            }}
                        />
                    )}

                    {/* shape label edit overlay */}
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
                                fontFamily: "'JetBrains Mono', monospace",
                                textAlign: "center",
                                color: labelOverlay.color,
                                background: labelOverlay.isArrow ? "rgba(13,17,23,0.92)" : "transparent",
                                border: "1px dashed #3b82f6",
                                padding: 2, zIndex: 60,
                            }}
                        />
                    )}
                </div>
            </div>

            {/* RIGHT PANEL */}
            <div style={{ width: 220, background: "#0a0f1a", borderLeft: "1px solid #0f1f35", overflowY: "auto", flexShrink: 0 }}>
                {/* ACTIVE TOOL STYLE */}
                {!selShape && !jdShape && (
                    <div className="panel-sec">
                        <div style={SEC_LABEL}><Dot color="#3b82f6"/> Tool · {tool}</div>
                        <SwatchGrid value={color} onChange={setColor}/>
                        <ColorHexRow value={color} onChange={setColor}/>
                        <div style={{ marginTop: 12 }}>
                            <div style={{ fontSize: 9, color: "#475569", marginBottom: 6 }}>Stroke width</div>
                            <div style={{ display: "flex", gap: 4 }}>
                                {STROKE_WIDTHS.map(w => (
                                    <button key={w} onClick={() => setStrokeWidth(w)} style={{ flex: 1, padding: "6px 0", borderRadius: 5, border: "none", cursor: "pointer", background: strokeWidth === w ? "#2563eb" : "#1e293b", color: "#f1f5f9", fontSize: 10, fontFamily: "inherit" }}>{w}px</button>
                                ))}
                            </div>
                        </div>
                        {hasFill && (
                            <div style={{ marginTop: 12 }}>
                                <div style={{ fontSize: 9, color: "#475569", marginBottom: 6 }}>Fill</div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 5 }}>
                                    <button onClick={() => setFillColor("none")} style={{ aspectRatio: "1", borderRadius: 5, cursor: "pointer", border: "none", background: "repeating-linear-gradient(45deg,#1e293b,#1e293b 4px,#0f172a 4px,#0f172a 8px)", outline: fillColor === "none" ? "2px solid #3b82f6" : "1px solid rgba(255,255,255,0.06)" }}/>
                                    {COLORS.slice(0, 11).map(c => <button key={c} onClick={() => setFillColor(c)} style={{ aspectRatio: "1", borderRadius: 5, cursor: "pointer", border: "none", background: c, outline: fillColor === c ? "2px solid #3b82f6" : "1px solid rgba(255,255,255,0.06)" }}/>)}
                                </div>
                            </div>
                        )}
                        <div style={{ marginTop: 12 }}>
                            <div style={{ fontSize: 9, color: "#475569", marginBottom: 6, display: "flex", justifyContent: "space-between" }}><span>Opacity</span><span>{Math.round(opacity * 100)}%</span></div>
                            <input type="range" min={0.1} max={1} step={0.05} value={opacity} onChange={e => setOpacity(parseFloat(e.target.value))}/>
                        </div>
                        {tool === TOOLS.RECT && (
                            <div style={{ marginTop: 12 }}>
                                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "#94a3b8", cursor: "pointer" }}>
                                    <input type="checkbox" checked={rounded} onChange={e => setRounded(e.target.checked)}/>
                                    Rounded corners
                                </label>
                                {rounded && (
                                    <div style={{ marginTop: 8 }}>
                                        <div style={{ fontSize: 9, color: "#475569", marginBottom: 4, display: "flex", justifyContent: "space-between" }}><span>Radius</span><span>{roundedRadius}px</span></div>
                                        <input type="range" min={2} max={40} step={1} value={roundedRadius} onChange={e => setRoundedRadius(parseInt(e.target.value))}/>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* JUST DRAWN STYLE */}
                {!selShape && jdShape && (
                    <div className="panel-sec">
                        <div style={SEC_LABEL}><Dot color="#fbbf24"/> Just drawn · {jdShape.type}</div>
                        <SwatchGrid value={jdShape.color ?? color} onChange={updateJustDrawnColor}/>
                        <ColorHexRow value={jdShape.color ?? color} onChange={updateJustDrawnColor}/>
                        <div style={{ marginTop: 12 }}>
                            <div style={{ fontSize: 9, color: "#475569", marginBottom: 6 }}>Stroke width</div>
                            <div style={{ display: "flex", gap: 4 }}>
                                {STROKE_WIDTHS.map(w => <button key={w} onClick={() => updateJustDrawnSW(w)} style={{ flex: 1, padding: "6px 0", borderRadius: 5, border: "none", cursor: "pointer", background: jdShape.strokeWidth === w ? "#2563eb" : "#1e293b", color: "#f1f5f9", fontSize: 10, fontFamily: "inherit" }}>{w}px</button>)}
                            </div>
                        </div>
                        {jdHasFill && (
                            <div style={{ marginTop: 12 }}>
                                <div style={{ fontSize: 9, color: "#475569", marginBottom: 6 }}>Fill</div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 5 }}>
                                    <button onClick={() => updateJustDrawnFill("none")} style={{ aspectRatio: "1", borderRadius: 5, cursor: "pointer", border: "none", background: "repeating-linear-gradient(45deg,#1e293b,#1e293b 4px,#0f172a 4px,#0f172a 8px)", outline: jdShape.fill === "none" ? "2px solid #3b82f6" : "1px solid rgba(255,255,255,0.06)" }}/>
                                    {COLORS.slice(0, 11).map(c => <button key={c} onClick={() => updateJustDrawnFill(c)} style={{ aspectRatio: "1", borderRadius: 5, cursor: "pointer", border: "none", background: c, outline: jdShape.fill === c ? "2px solid #3b82f6" : "1px solid rgba(255,255,255,0.06)" }}/>)}
                                </div>
                            </div>
                        )}
                        {jdIsRect && jdShape.rounded && (
                            <div style={{ marginTop: 12 }}>
                                <div style={{ fontSize: 9, color: "#475569", marginBottom: 4, display: "flex", justifyContent: "space-between" }}><span>Radius</span><span>{jdShape.roundedRadius ?? 8}px</span></div>
                                <input type="range" min={2} max={40} step={1} value={jdShape.roundedRadius ?? 8} onChange={e => updateJustDrawnRR(parseInt(e.target.value))}/>
                            </div>
                        )}
                    </div>
                )}

                {/* SELECTION PANEL */}
                {selShape && (
                    <div className="panel-sec">
                        <div style={SEC_LABEL}><Dot color="#22c55e"/> Selected · {selShape.type}</div>
                        <SwatchGrid value={selShape.color ?? color} onChange={updateSelectedColor}/>
                        <ColorHexRow value={selShape.color ?? color} onChange={updateSelectedColor}/>
                        {selHasFill && (
                            <div style={{ marginTop: 12 }}>
                                <div style={{ fontSize: 9, color: "#475569", marginBottom: 6 }}>Fill</div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 5 }}>
                                    <button onClick={() => updateSelectedFill("none")} style={{ aspectRatio: "1", borderRadius: 5, cursor: "pointer", border: "none", background: "repeating-linear-gradient(45deg,#1e293b,#1e293b 4px,#0f172a 4px,#0f172a 8px)", outline: selShape.fill === "none" ? "2px solid #3b82f6" : "1px solid rgba(255,255,255,0.06)" }}/>
                                    {COLORS.slice(0, 11).map(c => <button key={c} onClick={() => updateSelectedFill(c)} style={{ aspectRatio: "1", borderRadius: 5, cursor: "pointer", border: "none", background: c, outline: selShape.fill === c ? "2px solid #3b82f6" : "1px solid rgba(255,255,255,0.06)" }}/>)}
                                </div>
                            </div>
                        )}
                        {/* Connector type for arrows */}
                        {selShape.type === "arrow" && (
                            <div style={{ marginTop: 12 }}>
                                <div style={{ fontSize: 9, color: "#475569", marginBottom: 6 }}>Connector</div>
                                <div style={{ display: "flex", gap: 6 }}>
                                    {(["straight", "elbow"] as ConnectorType[]).map(ct => (
                                        <button key={ct} onClick={() => {
                                            pushHistory(stateRef.current.shapes);
                                            setShapes(s => s.map(sh => sh.id === selShape.id
                                                ? { ...sh, connectorType: ct, waypoint: ct === "elbow"
                                                    ? (sh.waypoint ?? { x: ((sh.x1 ?? 0) + (sh.x2 ?? 0)) / 2, y: ((sh.y1 ?? 0) + (sh.y2 ?? 0)) / 2 })
                                                    : undefined }
                                                : sh));
                                        }} style={{ flex: 1, padding: "5px 8px", fontSize: 10, borderRadius: 5, background: (selShape.connectorType ?? "straight") === ct ? "#2563eb" : "#1e293b", color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit" }}>{ct}</button>
                                    ))}
                                </div>
                            </div>
                        )}
                        {/* Edit label button for label-editable shapes */}
                        {isLabelEditableShape(selShape) && (
                            <div style={{ marginTop: 12 }}>
                                <button onClick={() => openLabelEdit(selShape)} style={{ width: "100%", padding: "7px 10px", borderRadius: 6, background: "#1e293b", color: "#94a3b8", border: "none", cursor: "pointer", fontSize: 11, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                                    {Ic.edit} {selShape.label ? "Edit label" : "Add label"}
                                </button>
                                {selShape.label && <div style={{ marginTop: 6, fontSize: 10, color: "#475569", textAlign: "center", fontStyle: "italic" }}>"{selShape.label.length > 24 ? selShape.label.slice(0, 24) + "…" : selShape.label}"</div>}
                            </div>
                        )}
                        <div style={{ marginTop: 12, fontSize: 10, color: "#475569" }}>Double-click shape to edit label</div>
                    </div>
                )}
            </div>
        </div>
    );
}
