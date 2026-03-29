/* eslint-disable */
import {
    useState, useRef, useEffect, useCallback,
    type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode
} from "react";
import { useParams } from "react-router-dom";
import { http } from "../../services/http";
import { useNavigate } from "react-router-dom";

// ── Constants 
const TOOLS = {
    SELECT: "select", PAN: "pan", PEN: "pen", ERASER: "eraser",
    LINE: "line", ARROW: "arrow", RECT: "rect", ELLIPSE: "ellipse",
    DIAMOND: "diamond", TEXT: "text",
} as const;

const COLORS = [
    "#f8fafc", "#f87171", "#fb923c", "#fbbf24",
    "#a3e635", "#34d399", "#38bdf8", "#818cf8",
    "#e879f9", "#f472b6", "#94a3b8", "#1e293b",
];

const BG_PRESETS = [
    { label: "Dark", value: "#0d1117" },
    { label: "Navy", value: "#0a1628" },
    { label: "Slate", value: "#1e293b" },
    { label: "White", value: "#ffffff" },
    { label: "Cream", value: "#fefce8" },
    { label: "Paper", value: "#f8fafc" },
    { label: "Forest", value: "#052e16" },
    { label: "Wine", value: "#1a0a0a" },
];

const STROKE_WIDTHS = [1, 2, 4, 8];
let _uid = 0;
const uid = () => ++_uid;

type Point = { x: number; y: number };
type Tool = typeof TOOLS[keyof typeof TOOLS];
type ShapeType = "pen" | "eraser" | "line" | "arrow" | "rect" | "ellipse" | "diamond" | "text";
type SelMode = "move" | "rotate";

type DrawShape = {
    id: number | string;
    type: ShapeType;
    points?: Point[];
    x?: number; y?: number;
    text?: string; fontSize?: number;
    x1?: number; y1?: number; x2?: number; y2?: number;
    color?: string; strokeWidth?: number; fill?: string;
    opacity?: number; rounded?: boolean; roundedRadius?: number; rotation?: number;
};

type Bounds = { x: number; y: number; w: number; h: number };
type DrawStateRef = { shapes: DrawShape[]; zoom: number; pan: Point; selectedId: number | string | null; selectedIds: Set<number | string> };

// ── Geometry Helpers 
function getBounds(shape: DrawShape): Bounds {
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
    const x = Math.min(x1, x2), y = Math.min(y1, y2);
    return { x, y, w: Math.max(Math.abs(x2 - x1), 4), h: Math.max(Math.abs(y2 - y1), 4) };
}

function getCenter(shape: DrawShape): Point {
    const b = getBounds(shape); return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

function rotPt(px: number, py: number, cx: number, cy: number, angle: number): Point {
    const cos = Math.cos(angle), sin = Math.sin(angle);
    return { x: cx + cos * (px - cx) - sin * (py - cy), y: cy + sin * (px - cx) + cos * (py - cy) };
}

function getRotHandlePos(shape: DrawShape): Point {
    const b = getBounds(shape), c = getCenter(shape);
    return rotPt(c.x, b.y - 34, c.x, c.y, shape.rotation || 0);
}

function hitTest(shape: DrawShape, px: number, py: number): boolean {
    const c = getCenter(shape);
    const lp = rotPt(px, py, c.x, c.y, -(shape.rotation || 0));
    const b = getBounds(shape), pad = 8;
    return lp.x >= b.x - pad && lp.x <= b.x + b.w + pad && lp.y >= b.y - pad && lp.y <= b.y + b.h + pad;
}

function moveShape(shape: DrawShape, dx: number, dy: number): DrawShape {
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
    ctx.translate(c.x, c.y);
    ctx.rotate(shape.rotation);
    ctx.translate(-c.x, -c.y);
}

// ── Shape Renderer 
function drawShape(ctx: CanvasRenderingContext2D, shape: DrawShape): void {
    ctx.save();
    applyShapeRotation(ctx, shape);
    ctx.globalAlpha = shape.opacity ?? 1;
    ctx.strokeStyle = shape.color ?? "#f8fafc";
    ctx.lineWidth = shape.strokeWidth ?? 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    switch (shape.type) {
        case "pen": {
            const pts = shape.points;
            if (!pts || pts.length < 2) break;
            ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) {
                const mid = { x: (pts[i - 1].x + pts[i].x) / 2, y: (pts[i - 1].y + pts[i].y) / 2 };
                ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, mid.x, mid.y);
            }
            ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
            ctx.stroke(); break;
        }
        case "eraser": {
            const pts = shape.points;
            if (!pts || pts.length < 2) break;
            ctx.globalCompositeOperation = "destination-out";
            ctx.strokeStyle = "rgba(0,0,0,1)";
            ctx.lineWidth = (shape.strokeWidth ?? 2) * 6;
            ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
            ctx.stroke();
            break;
        }
        case "line":
            ctx.beginPath(); ctx.moveTo(shape.x1 ?? 0, shape.y1 ?? 0); ctx.lineTo(shape.x2 ?? 0, shape.y2 ?? 0); ctx.stroke(); break;
        case "arrow": {
            const x1 = shape.x1 ?? 0, y1 = shape.y1 ?? 0, x2 = shape.x2 ?? 0, y2 = shape.y2 ?? 0;
            const dx = x2 - x1, dy = y2 - y1, angle = Math.atan2(dy, dx);
            const head = Math.min(18, Math.sqrt(dx * dx + dy * dy) * 0.35);
            ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x2, y2);
            ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6));
            ctx.closePath(); ctx.fillStyle = shape.color ?? "#f8fafc"; ctx.fill(); break;
        }
        case "rect": {
            const x1 = shape.x1 ?? 0, y1 = shape.y1 ?? 0, x2 = shape.x2 ?? 0, y2 = shape.y2 ?? 0;
            const x = Math.min(x1, x2), y = Math.min(y1, y2), w = Math.abs(x2 - x1), h = Math.abs(y2 - y1);
            ctx.beginPath();
            if (shape.rounded && ctx.roundRect) ctx.roundRect(x, y, w, h, shape.roundedRadius ?? 8); else ctx.rect(x, y, w, h);
            if (shape.fill && shape.fill !== "none") { ctx.fillStyle = shape.fill; ctx.fill(); }
            ctx.stroke(); break;
        }
        case "ellipse": {
            const x1 = shape.x1 ?? 0, y1 = shape.y1 ?? 0, x2 = shape.x2 ?? 0, y2 = shape.y2 ?? 0;
            const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2, rx = Math.abs(x2 - x1) / 2, ry = Math.abs(y2 - y1) / 2;
            ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(rx, 1), Math.max(ry, 1), 0, 0, Math.PI * 2);
            if (shape.fill && shape.fill !== "none") { ctx.fillStyle = shape.fill; ctx.fill(); }
            ctx.stroke(); break;
        }
        case "diamond": {
            const x1 = shape.x1 ?? 0, y1 = shape.y1 ?? 0, x2 = shape.x2 ?? 0, y2 = shape.y2 ?? 0;
            const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2, rx = Math.abs(x2 - x1) / 2, ry = Math.abs(y2 - y1) / 2;
            ctx.beginPath();
            ctx.moveTo(cx, cy - ry); ctx.lineTo(cx + rx, cy); ctx.lineTo(cx, cy + ry); ctx.lineTo(cx - rx, cy);
            ctx.closePath();
            if (shape.fill && shape.fill !== "none") { ctx.fillStyle = shape.fill; ctx.fill(); }
            ctx.stroke(); break;
        }
        case "text": {
            const fs = shape.fontSize ?? 18;
            ctx.font = `${fs}px 'JetBrains Mono',monospace`;
            ctx.fillStyle = shape.color ?? "#f8fafc";
            ctx.globalAlpha = shape.opacity ?? 1;
            (shape.text ?? "").split("\n").forEach((line, i) => ctx.fillText(line, shape.x ?? 0, (shape.y ?? 0) + i * fs * 1.3));
            break;
        }
    }
    ctx.restore();
}

function drawEraserGhost(ctx: CanvasRenderingContext2D, shape: DrawShape, zoom: number): void {
    const pts = shape.points;
    if (!pts || pts.length < 2) return;
    ctx.save();
    applyShapeRotation(ctx, shape);
    ctx.strokeStyle = "#fb923c";
    ctx.lineWidth = (shape.strokeWidth ?? 2) * 6;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.globalAlpha = 0.5;
    ctx.setLineDash([10 / zoom, 7 / zoom]);
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
}

function drawSelectionOverlay(ctx: CanvasRenderingContext2D, shape: DrawShape, zoom: number): void {
    const b = getBounds(shape), c = getCenter(shape);
    const rot = shape.rotation || 0, pad = 12, lw = 2 / zoom;

    ctx.save();
    ctx.translate(c.x, c.y); ctx.rotate(rot); ctx.translate(-c.x, -c.y);

    ctx.strokeStyle = "#3b82f6"; ctx.lineWidth = lw;
    ctx.setLineDash([6 / zoom, 4 / zoom]);
    ctx.strokeRect(b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2);
    ctx.setLineDash([]);

    const hw = 6 / zoom;
    const handles: [number, number][] = [
        [b.x - pad, b.y - pad], [b.x + b.w + pad, b.y - pad],
        [b.x - pad, b.y + b.h + pad], [b.x + b.w + pad, b.y + b.h + pad],
    ];
    handles.forEach(([hx, hy]) => {
        ctx.fillStyle = "#fff"; ctx.shadowColor = "#3b82f6"; ctx.shadowBlur = 4 / zoom;
        ctx.fillRect(hx - hw, hy - hw, hw * 2, hw * 2);
        ctx.shadowBlur = 0; ctx.strokeStyle = "#3b82f6"; ctx.lineWidth = lw;
        ctx.strokeRect(hx - hw, hy - hw, hw * 2, hw * 2);
    });

    const handleDist = 45 / zoom, handleX = c.x, handleY = b.y - handleDist;
    ctx.strokeStyle = "#3b82f6"; ctx.lineWidth = lw * 1.5; ctx.lineCap = "round";
    ctx.shadowColor = "#3b82f6"; ctx.shadowBlur = 6 / zoom;
    ctx.beginPath(); ctx.moveTo(c.x, b.y - pad); ctx.lineTo(handleX, handleY); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(handleX, handleY, 10 / zoom, 0, Math.PI * 2);
    ctx.fillStyle = "#3b82f6"; ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2 / zoom; ctx.stroke();

    ctx.restore();
}

function drawDotGrid(ctx: CanvasRenderingContext2D, w: number, h: number, pan: Point, bgColor: string): void {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);
    const spacing = 28;
    const ox = ((pan.x % spacing) + spacing) % spacing;
    const oy = ((pan.y % spacing) + spacing) % spacing;
    const hex = bgColor.replace("#", "");
    const r = parseInt(hex.slice(0, 2), 16) || 0, g = parseInt(hex.slice(2, 4), 16) || 0, b = parseInt(hex.slice(4, 6), 16) || 0;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    ctx.fillStyle = lum > 128 ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.12)";
    for (let x = ox; x < w; x += spacing)
        for (let y = oy; y < h; y += spacing)
            ctx.fillRect(x - 1, y - 1, 2, 2);
}

// ── Icons 
const Ic: Record<string, ReactNode> = {
    select: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 2l5 12 2-5 5-2z" /></svg>,
    pan: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="8" cy="8" r="1.5" fill="currentColor" /><path d="M8 2v2M8 12v2M2 8h2M12 8h2" /></svg>,
    pen: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 14l3-1L13 5l-3-3L2 11z" /></svg>,
    eraser: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 13h10M11 4L5 10l2 2 6-6-2-2zM5 10l-2 2 2 1" /></svg>,
    line: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><line x1="3" y1="13" x2="13" y2="3" /></svg>,
    arrow: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><line x1="3" y1="13" x2="13" y2="3" /><path d="M13 3l-5 1 4 4 1-5z" fill="currentColor" stroke="none" /></svg>,
    rect: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="2" y="4" width="12" height="8" rx="1" /></svg>,
    ellipse: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><ellipse cx="8" cy="8" rx="6" ry="4" /></svg>,
    diamond: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M8 2l6 6-6 6-6-6 6-6z" /></svg>,
    text: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 4h10M8 4v9M6 13h4" /></svg>,
    undo: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 8a5 5 0 1 0 1.5-3.5L2 7" /><path d="M2 4v3h3" /></svg>,
    redo: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M13 8a5 5 0 1 1-1.5-3.5L14 7" /><path d="M14 4v3h-3" /></svg>,
    trash: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 4h12M6 4V2h4v2M5 4v9h6V4" /></svg>,
    download: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M8 3v7M5 8l3 3 3-3M3 13h10" /></svg>,
    pdf: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="2" y="1" width="9" height="14" rx="1" /><path d="M11 1l3 3v11M5 6h4M5 9h4M5 12h2" /><path d="M11 1v3h3" strokeLinejoin="round" /></svg>,
    edit: <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M11 2l3 3-9 9H2v-3z" /></svg>,
    palette: <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6" /><circle cx="5.5" cy="6" r="1" fill="currentColor" stroke="none" /><circle cx="10.5" cy="6" r="1" fill="currentColor" stroke="none" /><circle cx="8" cy="10.5" r="1" fill="currentColor" stroke="none" /></svg>,
};

type ToolBtnProps = { active?: boolean; label: string; onClick: () => void; danger?: boolean; children: ReactNode };
function ToolBtn({ active, label, onClick, danger, children }: ToolBtnProps) {
    const [hov, setHov] = useState(false);
    return (
        <button title={label} onClick={onClick}
            onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{
                width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, border: "none", cursor: "pointer", transition: "all 0.12s",
                background: active ? "#2563eb" : hov ? "#1e293b" : "transparent",
                color: danger ? (hov ? "#fca5a5" : "#f87171") : active ? "#fff" : hov ? "#f1f5f9" : "#64748b",
                boxShadow: active ? "0 0 0 1px #3b82f644,0 2px 8px #1d4ed840" : "none"
            }}>
            {children}
        </button>
    );
}

// ── Color Swatch Grid 
function SwatchGrid({ value, onChange }: { value: string; onChange: (c: string) => void }) {
    return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 4, marginBottom: 8 }}>
            {COLORS.map(c => (
                <button key={c} onClick={() => onChange(c)} style={{
                    width: "100%", aspectRatio: "1", borderRadius: 5, border: "none", cursor: "pointer",
                    background: c,
                    outline: value === c ? "2px solid #3b82f6" : "1px solid rgba(255,255,255,0.06)",
                    outlineOffset: 1, transform: value === c ? "scale(1.15)" : "scale(1)", transition: "all 0.1s",
                }} />
            ))}
        </div>
    );
}

function ColorHexRow({ value, onChange }: { value: string; onChange: (c: string) => void }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="color" value={value.match(/^#[0-9a-f]{6}$/i) ? value : "#f8fafc"} onChange={e => onChange(e.target.value)}
                style={{ width: 22, height: 22, border: "1px solid #1e293b", borderRadius: 4, padding: 0, cursor: "pointer", background: "transparent" }} />
            <span style={{ fontSize: 9, color: "#475569", fontFamily: "monospace", flex: 1 }}>{value}</span>
        </div>
    );
}

function Dot({ color }: { color: string }) {
    return <div style={{ width: 3, height: 12, borderRadius: 2, background: color, flexShrink: 0 }} />;
}

const SEC_LABEL: CSSProperties = { fontSize: 9, letterSpacing: "0.13em", textTransform: "uppercase", color: "#334155", fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 };

// ── Main Component 
export default function DrawingPad() {
    const { fileId } = useParams<{ fileId: string }>();
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const stateRef = useRef<DrawStateRef>({ shapes: [], zoom: 1, pan: { x: 0, y: 0 }, selectedId: null, selectedIds: new Set() });
    const textActiveRef = useRef(false);
    const preDragRef = useRef<DrawShape[] | null>(null);
    const origShapesRef = useRef<Map<number | string, DrawShape>>(new Map());
    const bgColorRef = useRef("#0d1117");
    const attachedErasersRef = useRef<DrawShape[]>([]);

    // ── Load from localStorage (per-file key)
    const _localKey = fileId ? `drawpad_file_${fileId}` : "drawpad_v1";
    const _saved = (() => { try { return JSON.parse(localStorage.getItem(_localKey) ?? "{}"); } catch { return {}; } })();
    const _hasLocal = !!_saved.shapes;

    const [tool, setTool] = useState<Tool>(TOOLS.PEN);
    const [color, setColor] = useState(_saved.color ?? "#f8fafc");
    const [strokeWidth, setStrokeWidth] = useState(_saved.strokeWidth ?? 2);
    const [fillColor, setFillColor] = useState(_saved.fillColor ?? "none");
    const [opacity, setOpacity] = useState(_saved.opacity ?? 1);
    const [rounded, setRounded] = useState(_saved.rounded ?? false);
    const [roundedRadius, setRoundedRadius] = useState(_saved.roundedRadius ?? 8);
    const [bgColor, setBgColor] = useState(_saved.bgColor ?? "#0d1117");

    const [shapes, setShapes] = useState<DrawShape[]>(_saved.shapes ?? []);
    const [hasLocalCache, setHasLocalCache] = useState(_hasLocal);
    const [, setUndoStack] = useState<DrawShape[][]>([]);
    const [, setRedoStack] = useState<DrawShape[][]>([]);
    const [preview, setPreview] = useState<DrawShape | null>(null);

    const [isDrawing, setIsDrawing] = useState(false);
    const [startPos, setStartPos] = useState<Point>({ x: 0, y: 0 });
    const [currentPath, setCurrentPath] = useState<Point[]>([]);

    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState<Point>({ x: 0, y: 0 });

    const [textInput, setTextInput] = useState<Point | null>(null);
    const [textVal, setTextVal] = useState("");
    const [editingTextId, setEditingTextId] = useState<number | string | null>(null);

    const [selectedId, setSelectedId] = useState<number | string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<number | string>>(new Set());
    const [marquee, setMarquee] = useState<{ x1: number, y1: number, x2: number, y2: number } | null>(null);
    const marqueeStartRef = useRef<Point | null>(null);
    const [selMode, setSelMode] = useState<SelMode | null>(null);
    const [selStartPos, setSelStartPos] = useState<Point | null>(null);
    const [selOrigShape, setSelOrigShape] = useState<DrawShape | null>(null);
    const [justDrawnId, setJustDrawnId] = useState<number | string | null>(null);
    const [showDlMenu, setShowDlMenu] = useState(false);
    const [showBgPicker, setShowBgPicker] = useState(false);
    const [savedToast, setSavedToast] = useState(false);
    const navigate = useNavigate();

    const saveToLocal = useCallback(() => {
        try {
            localStorage.setItem(_localKey, JSON.stringify({ shapes, color, strokeWidth, fillColor, opacity, rounded, roundedRadius, bgColor }));
            setSavedToast(true);
            setTimeout(() => setSavedToast(false), 2000);
        } catch { /* quota exceeded, ignore */ }
    }, [shapes, color, strokeWidth, fillColor, opacity, rounded, roundedRadius, bgColor, _localKey]);

    const saveToServer = async () => {
        await http.private.post("/drawing/save", { fileId, shapes, bgColor, zoom, panX: pan.x, panY: pan.y, canvasWidth: canvasRef.current?.width, canvasHeight: canvasRef.current?.height });
        try { localStorage.setItem(_localKey, JSON.stringify({ shapes, color, strokeWidth, fillColor, opacity, rounded, roundedRadius, bgColor })); } catch { }
        setSavedToast(true);
        setTimeout(() => setSavedToast(false), 2000);
    }

    const fetchDrawing = async () => {
        if (!fileId) return;
        const res = await http.private.get<{ success: boolean; data: any }>(`/drawing/file/${fileId}`);
        const drawing = res.data;
        if (!drawing) return;
        setShapes(drawing.shapesJson || []);
        setBgColor(drawing.bgColor || "#0d1117");
        setZoom(drawing.zoom || 1);
        setPan({ x: drawing.panX || 0, y: drawing.panY || 0 });
        try { localStorage.setItem(_localKey, JSON.stringify({ shapes: drawing.shapesJson || [], color, strokeWidth, fillColor, opacity, rounded, roundedRadius, bgColor: drawing.bgColor || "#0d1117" })); } catch { }
        setHasLocalCache(true);
    };

    const createNewFile = async () => {
        try {
            const res = await http.private.get<{ success: boolean; data: any }>(`/drawing/create`);

            const newFileId = res.data?.data?.id;

            if (!newFileId) return;

            // 👉 redirect to new file
            navigate(`/file/${newFileId}`, { replace: true });

        } catch (err) {
            console.error("Failed to create file", err);
        }
    };

    useEffect(() => {
        if (!fileId) { createNewFile(); return; }
        if (_hasLocal) return; // local cache exists, skip DB fetch
        fetchDrawing();
    }, [fileId]);

    // ── Auto-save to localStorage on every change 
    useEffect(() => {
        try { localStorage.setItem(_localKey, JSON.stringify({ shapes, color, strokeWidth, fillColor, opacity, rounded, roundedRadius, bgColor })); }
        catch { /* quota exceeded, ignore */ }
    }, [shapes, color, strokeWidth, fillColor, opacity, rounded, roundedRadius, bgColor, _localKey]);

    useEffect(() => { bgColorRef.current = bgColor; }, [bgColor]);
    useEffect(() => { stateRef.current = { shapes, zoom, pan, selectedId, selectedIds }; }, [shapes, zoom, pan, selectedId, selectedIds]);
    useEffect(() => { textActiveRef.current = textInput !== null; }, [textInput]);
    useEffect(() => {
        if (!textInput || !textareaRef.current) return;
        requestAnimationFrame(() => { textareaRef.current?.focus(); textareaRef.current?.select(); });
    }, [textInput]);

    // ── Redraw 
    const redraw = useCallback((previewShape: DrawShape | null) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const { shapes, zoom, pan, selectedId, selectedIds } = stateRef.current;
        const bg = bgColorRef.current;

        drawDotGrid(ctx, canvas.width, canvas.height, pan, bg);

        const off = document.createElement("canvas");
        off.width = canvas.width; off.height = canvas.height;
        const octx = off.getContext("2d")!;
        octx.save();
        octx.translate(pan.x, pan.y);
        octx.scale(zoom, zoom);
        shapes.forEach(s => drawShape(octx, s));
        if (previewShape) drawShape(octx, previewShape);
        octx.restore();
        ctx.drawImage(off, 0, 0);

        ctx.save();
        ctx.translate(pan.x, pan.y);
        ctx.scale(zoom, zoom);
        // Draw overlays for all selected shapes
        const activeIds = selectedIds.size > 0 ? selectedIds : (selectedId ? new Set([selectedId]) : new Set());
        activeIds.forEach(id => {
            const sel = shapes.find(s => s.id === id);
            if (sel?.type === "eraser") drawEraserGhost(ctx, sel, zoom);
            if (sel && sel.type !== "eraser") drawSelectionOverlay(ctx, sel, zoom);
        });
        // Draw marquee
        const mq = (previewShape as any)?._marquee;
        if (mq) {
            ctx.strokeStyle = "#3b82f6"; ctx.lineWidth = 1 / zoom; ctx.setLineDash([5 / zoom, 3 / zoom]);
            ctx.fillStyle = "rgba(59,130,246,0.08)";
            const mx = Math.min(mq.x1, mq.x2), my = Math.min(mq.y1, mq.y2), mw = Math.abs(mq.x2 - mq.x1), mh = Math.abs(mq.y2 - mq.y1);
            ctx.fillRect(mx, my, mw, mh); ctx.strokeRect(mx, my, mw, mh); ctx.setLineDash([]);
        }
        ctx.restore();

        canvas.style.background = bg;
    }, []);

    useEffect(() => { redraw(preview); }, [shapes, pan, zoom, selectedId, selectedIds, preview, bgColor, redraw]);

    // ── Resize 
    useEffect(() => {
        const resize = () => {
            const canvas = canvasRef.current, container = containerRef.current;
            if (!canvas || !container) return;
            canvas.width = container.clientWidth; canvas.height = container.clientHeight;
            redraw(null);
        };
        resize();
        const obs = new ResizeObserver(resize);
        if (containerRef.current) obs.observe(containerRef.current);
        return () => obs.disconnect();
    }, [redraw]);

    const toCanvas = useCallback((e: { clientX: number; clientY: number }) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const { zoom, pan } = stateRef.current;
        return { x: (e.clientX - rect.left - pan.x) / zoom, y: (e.clientY - rect.top - pan.y) / zoom };
    }, []);

    // ── History 
    const pushHistory = useCallback((snap: DrawShape[]) => { setUndoStack(u => [...u.slice(-50), snap]); setRedoStack([]); }, []);
    const undo = useCallback(() => {
        setUndoStack(stack => { if (!stack.length) return stack; setRedoStack(r => [...r, stateRef.current.shapes]); setShapes(stack[stack.length - 1]); setSelectedId(null); return stack.slice(0, -1); });
    }, []);
    const redo = useCallback(() => {
        setRedoStack(stack => { if (!stack.length) return stack; setUndoStack(u => [...u, stateRef.current.shapes]); setShapes(stack[stack.length - 1]); return stack.slice(0, -1); });
    }, []);

    // ── Text commit 
    const commitText = useCallback(() => {
        const ti = textInput, val = textVal.trim();
        if (ti && val) {
            pushHistory(stateRef.current.shapes);
            setShapes(s => { const base = editingTextId ? s.filter(sh => sh.id !== editingTextId) : s; return [...base, { id: uid(), type: "text" as ShapeType, x: ti.x, y: ti.y, text: val, color, fontSize: 14 + strokeWidth * 2, opacity }]; });
        } else if (editingTextId && !val) { pushHistory(stateRef.current.shapes); setShapes(s => s.filter(sh => sh.id !== editingTextId)); }
        setTextInput(null); setTextVal(""); setEditingTextId(null);
    }, [textInput, textVal, color, strokeWidth, opacity, pushHistory, editingTextId]);

    const openTextEdit = useCallback((shape: DrawShape) => {
        setEditingTextId(shape.id); setTextInput({ x: shape.x ?? 0, y: shape.y ?? 0 }); setTextVal(shape.text ?? "");
        requestAnimationFrame(() => { textareaRef.current?.focus(); textareaRef.current?.select(); });
    }, []);

    // ── Selected shape colour / fill 
    const updateSelectedColor = useCallback((c: string) => {
        if (!stateRef.current.selectedId) return;
        pushHistory(stateRef.current.shapes);
        setShapes(s => s.map(sh => sh.id === stateRef.current.selectedId ? { ...sh, color: c } : sh));
    }, [pushHistory]);

    const updateSelectedFill = useCallback((f: string) => {
        if (!stateRef.current.selectedId) return;
        pushHistory(stateRef.current.shapes);
        setShapes(s => s.map(sh => sh.id === stateRef.current.selectedId ? { ...sh, fill: f } : sh));
    }, [pushHistory]);

    // Live-tweak last drawn shape color
    const updateJustDrawnColor = useCallback((c: string) => {
        if (!justDrawnId) return;
        setColor(c);
        setShapes(s => s.map(sh => sh.id === justDrawnId ? { ...sh, color: c } : sh));
    }, [justDrawnId]);

    // Live-tweak last drawn shape fill (for fill-capable shapes)
    const updateJustDrawnFill = useCallback((f: string) => {
        if (!justDrawnId) return;
        setFillColor(f);
        setShapes(s => s.map(sh => sh.id === justDrawnId ? { ...sh, fill: f } : sh));
    }, [justDrawnId]);

    // Live-tweak last drawn shape stroke width
    const updateJustDrawnStrokeWidth = useCallback((w: number) => {
        if (!justDrawnId) return;
        setStrokeWidth(w);
        setShapes(s => s.map(sh => sh.id === justDrawnId ? { ...sh, strokeWidth: w } : sh));
    }, [justDrawnId]);

    // Live-tweak last drawn shape rounded radius
    const updateJustDrawnRoundedRadius = useCallback((r: number) => {
        if (!justDrawnId) return;
        setRoundedRadius(r);
        setShapes(s => s.map(sh => sh.id === justDrawnId ? { ...sh, roundedRadius: r } : sh));
    }, [justDrawnId]);

    // ── Keyboard 
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (textActiveRef.current) return;
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
            const cmd = e.metaKey || e.ctrlKey;
            if (cmd && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
            if (cmd && e.shiftKey && e.key === "z") { e.preventDefault(); redo(); return; }
            if (cmd && e.key === "y") { e.preventDefault(); redo(); return; }
            if ((e.key === "Backspace" || e.key === "Delete") && (stateRef.current.selectedId || stateRef.current.selectedIds.size > 0)) {
                e.preventDefault();
                const ids = stateRef.current.selectedIds.size > 0 ? stateRef.current.selectedIds : new Set([stateRef.current.selectedId!]);
                pushHistory(stateRef.current.shapes);
                setShapes(s => s.filter(sh => !ids.has(sh.id)));
                setSelectedId(null); setSelectedIds(new Set()); return;
            }
            if (cmd) {
                const map: Record<string, Tool> = { "1": TOOLS.SELECT, "2": TOOLS.PAN, "3": TOOLS.PEN, "4": TOOLS.ERASER, "5": TOOLS.LINE, "6": TOOLS.ARROW, "7": TOOLS.RECT, "8": TOOLS.ELLIPSE, "9": TOOLS.DIAMOND, "0": TOOLS.TEXT };
                if (map[e.key]) { e.preventDefault(); setTool(map[e.key]); }
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [undo, redo, pushHistory]);

    // ── Wheel zoom 
    useEffect(() => {
        const el = canvasRef.current; if (!el) return;
        const onWheel = (e: WheelEvent) => { e.preventDefault(); setZoom(z => Math.max(0.1, Math.min(20, z * (e.deltaY > 0 ? 0.92 : 1.08)))); };
        el.addEventListener("wheel", onWheel, { passive: false });
        return () => el.removeEventListener("wheel", onWheel);
    }, []);

    const onDoubleClick = useCallback((e: ReactMouseEvent<HTMLCanvasElement>) => {
        const pos = toCanvas(e);
        const hit = [...stateRef.current.shapes].reverse().find(s => hitTest(s, pos.x, pos.y));
        if (!hit) return;
        if (hit.type === "text") { setSelectedId(null); setSelectedIds(new Set()); openTextEdit(hit); return; }
        if (e.shiftKey) {
            setSelectedId(null);
            setSelectedIds(prev => { const next = new Set(prev); next.has(hit.id) ? next.delete(hit.id) : next.add(hit.id); return next; });
        } else {
            setSelectedId(hit.id); setSelectedIds(new Set());
        }
        setTool(TOOLS.SELECT);
    }, [toCanvas, openTextEdit]);

    // ── Mouse Down 
    const onMouseDown = useCallback((e: ReactMouseEvent<HTMLCanvasElement>) => {
        if (textActiveRef.current) return;
        setJustDrawnId(null);
        setShowDlMenu(false);
        setShowBgPicker(false);
        if (e.button === 1 || (e.button === 0 && e.altKey) || tool === TOOLS.PAN) {
            setIsPanning(true); setPanStart({ x: e.clientX - stateRef.current.pan.x, y: e.clientY - stateRef.current.pan.y }); return;
        }
        const pos = toCanvas(e);
        if (tool === TOOLS.TEXT) {
            const existing = [...stateRef.current.shapes].reverse().find(s => s.type === "text" && hitTest(s, pos.x, pos.y));
            if (existing) { openTextEdit(existing); return; }
            setEditingTextId(null); setTextInput(pos); setTextVal("");
            requestAnimationFrame(() => { textareaRef.current?.focus(); textareaRef.current?.select(); });
            return;
        }
        if (tool === TOOLS.SELECT) {
            const { shapes, selectedId, selectedIds, zoom } = stateRef.current;
            const activeIds = selectedIds.size > 0 ? selectedIds : (selectedId ? new Set([selectedId]) : new Set<number | string>());

            // Shift+click: toggle shape in/out of multi-selection
            if (e.shiftKey) {
                const hit = [...shapes].reverse().find(s => hitTest(s, pos.x, pos.y));
                if (hit) {
                    setSelectedId(null);
                    setSelectedIds(prev => { const next = new Set(prev); next.has(hit.id) ? next.delete(hit.id) : next.add(hit.id); return next; });
                }
                return;
            }

            // Check rotate handle on single selection
            if (selectedId && !selectedIds.size) {
                const sel = shapes.find(s => s.id === selectedId);
                if (sel) {
                    const hp = getRotHandlePos(sel);
                    if (Math.hypot(pos.x - hp.x, pos.y - hp.y) < 18 / zoom) {
                        preDragRef.current = [...shapes];
                        if (sel.type !== "eraser") {
                            const selIdx = shapes.findIndex(s => s.id === sel.id);
                            attachedErasersRef.current = shapes.filter((s, idx) => s.type === "eraser" && idx > selIdx && boundsIntersect(getBounds(s), getBounds(sel))).map(s => ({ ...s }));
                        } else { attachedErasersRef.current = []; }
                        setSelMode("rotate"); setSelStartPos(pos); setSelOrigShape({ ...sel }); return;
                    }
                }
            }

            // Check if clicking inside any active selected shape → move all
            const clickedSelected = [...activeIds].map(id => shapes.find(s => s.id === id)).find(s => s && hitTest(s, pos.x, pos.y));
            if (clickedSelected && activeIds.size > 0) {
                preDragRef.current = [...shapes];
                attachedErasersRef.current = [];
                // Store originals of ALL selected shapes
                const origMap = new Map<number | string, DrawShape>();
                activeIds.forEach(id => { const s = shapes.find(sh => sh.id === id); if (s) origMap.set(id, { ...s }); });
                origShapesRef.current = origMap;
                setSelMode("move"); setSelStartPos(pos);
                setSelOrigShape({ ...clickedSelected }); return;
            }

            // Click on unselected shape → select it (single)
            const hit = [...shapes].reverse().find(s => hitTest(s, pos.x, pos.y));
            if (hit) {
                setSelectedId(hit.id); setSelectedIds(new Set());
                preDragRef.current = [...shapes];
                if (hit.type !== "eraser") {
                    const hitIdx = shapes.findIndex(s => s.id === hit.id);
                    attachedErasersRef.current = shapes.filter((s, idx) => s.type === "eraser" && idx > hitIdx && boundsIntersect(getBounds(s), getBounds(hit))).map(s => ({ ...s }));
                } else { attachedErasersRef.current = []; }
                setSelMode("move"); setSelStartPos(pos); setSelOrigShape({ ...hit });
            } else {
                // Empty space → start marquee
                setSelectedId(null); setSelectedIds(new Set()); setSelMode(null);
                marqueeStartRef.current = pos;
                setMarquee({ x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y });
            }
            return;
        }
        setIsDrawing(true); setStartPos(pos);
        if (tool === TOOLS.PEN || tool === TOOLS.ERASER) setCurrentPath([pos]);
    }, [tool, toCanvas, openTextEdit]);

    // ── Mouse Move 
    const onMouseMove = useCallback((e: ReactMouseEvent<HTMLCanvasElement>) => {
        if (isPanning) { setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y }); return; }
        const pos = toCanvas(e);
        if (tool === TOOLS.SELECT) {
            // Marquee drag
            if (marqueeStartRef.current && !selMode) {
                const mq = { x1: marqueeStartRef.current.x, y1: marqueeStartRef.current.y, x2: pos.x, y2: pos.y };
                setMarquee(mq);
                // Live-select shapes inside marquee
                const mx = Math.min(mq.x1, mq.x2), my = Math.min(mq.y1, mq.y2), mw = Math.abs(mq.x2 - mq.x1), mh = Math.abs(mq.y2 - mq.y1);
                const mqBounds = { x: mx, y: my, w: mw, h: mh };
                const inside = new Set<number | string>(stateRef.current.shapes.filter(s => boundsIntersect(getBounds(s), mqBounds)).map(s => s.id));
                setSelectedIds(inside);
                // Trigger redraw with marquee info piggy-backed on preview
                setPreview({ id: "_mq", type: "rect", x1: mq.x1, y1: mq.y1, x2: mq.x2, y2: mq.y2, color: "transparent", strokeWidth: 0, _marquee: mq } as any);
                return;
            }
            if (selMode && selOrigShape && selStartPos) {
                const dx = pos.x - selStartPos.x, dy = pos.y - selStartPos.y;
                if (selMode === "move") {
                    const { selectedIds } = stateRef.current;
                    const activeIds = selectedIds.size > 0 ? selectedIds : new Set([selOrigShape.id]);
                    setShapes(s => s.map(sh => {
                        if (activeIds.has(sh.id)) {
                            const orig = origShapesRef.current.get(sh.id) ?? (sh.id === selOrigShape.id ? selOrigShape : sh);
                            return moveShape(orig, dx, dy);
                        }
                        const origE = attachedErasersRef.current.find(e => e.id === sh.id);
                        if (origE) return moveShape(origE, dx, dy);
                        return sh;
                    }));
                } else if (selMode === "rotate") {
                    const c = getCenter(selOrigShape);
                    const delta = Math.atan2(pos.y - c.y, pos.x - c.x) - Math.atan2(selStartPos.y - c.y, selStartPos.x - c.x);
                    setShapes(s => s.map(sh => {
                        if (sh.id === selOrigShape.id) return { ...sh, rotation: (selOrigShape.rotation || 0) + delta };
                        const origE = attachedErasersRef.current.find(e => e.id === sh.id);
                        if (origE) return { ...sh, points: (origE.points ?? []).map(p => rotPt(p.x, p.y, c.x, c.y, delta)) };
                        return sh;
                    }));
                }
            }
            return;
        }
        if (!isDrawing) return;
        if (tool === TOOLS.PEN || tool === TOOLS.ERASER) {
            setCurrentPath(p => { const next = [...p, pos]; setPreview({ id: "preview", type: tool, points: next, color, strokeWidth, opacity }); return next; });
            return;
        }
        const base = { id: "preview", color, strokeWidth, fill: fillColor, opacity, rounded, roundedRadius, x1: startPos.x, y1: startPos.y, x2: pos.x, y2: pos.y };
        const tmap: Partial<Record<Tool, ShapeType>> = { [TOOLS.LINE]: "line", [TOOLS.ARROW]: "arrow", [TOOLS.RECT]: "rect", [TOOLS.ELLIPSE]: "ellipse", [TOOLS.DIAMOND]: "diamond" };
        if (tmap[tool]) setPreview({ ...base, type: tmap[tool] });
    }, [isPanning, panStart, tool, selMode, selOrigShape, selStartPos, isDrawing, toCanvas, color, strokeWidth, fillColor, opacity, rounded, roundedRadius, startPos]);

    // ── Mouse Up 
    const onMouseUp = useCallback((e: ReactMouseEvent<HTMLCanvasElement>) => {
        if (isPanning) { setIsPanning(false); return; }
        if (tool === TOOLS.SELECT) {
            // Finalize marquee
            if (marqueeStartRef.current) {
                marqueeStartRef.current = null;
                setMarquee(null);
                setPreview(null);
                return;
            }
            if (selMode) {
                if (preDragRef.current) { const snap = preDragRef.current; setUndoStack(u => [...u.slice(-50), snap]); setRedoStack([]); preDragRef.current = null; }
                attachedErasersRef.current = [];
                origShapesRef.current = new Map();
                setSelMode(null); setSelOrigShape(null); setSelStartPos(null); return;
            }
            return;
        }
        if (!isDrawing) return;
        setIsDrawing(false); setPreview(null);
        const pos = toCanvas(e); pushHistory(stateRef.current.shapes);
        if (tool === TOOLS.PEN || tool === TOOLS.ERASER) {
            if (currentPath.length < 2) { setCurrentPath([]); return; }
            const nid = uid();
            setShapes(s => [...s, { id: nid, type: tool, points: currentPath, color, strokeWidth, opacity }]);
            setJustDrawnId(nid);
            setCurrentPath([]); return;
        }
        if (Math.hypot(pos.x - startPos.x, pos.y - startPos.y) < 4) return;
        const base = { id: uid(), color, strokeWidth, fill: fillColor, opacity, rounded, roundedRadius, x1: startPos.x, y1: startPos.y, x2: pos.x, y2: pos.y };
        const tmap: Partial<Record<Tool, ShapeType>> = { [TOOLS.LINE]: "line", [TOOLS.ARROW]: "arrow", [TOOLS.RECT]: "rect", [TOOLS.ELLIPSE]: "ellipse", [TOOLS.DIAMOND]: "diamond" };
        const st = tmap[tool];
        if (st) { const nid = base.id; setShapes(s => [...s, { ...base, type: st }]); setJustDrawnId(nid); }
    }, [isPanning, tool, selMode, isDrawing, toCanvas, pushHistory, currentPath, color, strokeWidth, fillColor, opacity, rounded, startPos]);

    // ── Export helpers 
    const buildExportCanvas = () => {
        const src = canvasRef.current; if (!src) return null;
        const out = document.createElement("canvas");
        out.width = src.width; out.height = src.height;
        const ctx = out.getContext("2d")!;
        ctx.fillStyle = bgColor; ctx.fillRect(0, 0, out.width, out.height);
        ctx.drawImage(src, 0, 0);
        return out;
    };
    const exportPNG = () => {
        const out = buildExportCanvas(); if (!out) return;
        const a = document.createElement("a"); a.download = "drawing.png"; a.href = out.toDataURL(); a.click();
    };
    const exportPDF = () => {
        const out = buildExportCanvas(); if (!out) return;
        const imgData = out.toDataURL("image/png");
        const win = window.open("", "_blank");
        if (!win) { alert("Allow popups to export PDF."); return; }
        win.document.write(`<!DOCTYPE html><html><head><title>DrawPad Export</title>
<style>@page{margin:0;size:${out.width}px ${out.height}px;}*{margin:0;padding:0;}body{background:${bgColor};}img{display:block;max-width:100%;}
.tip{position:fixed;top:12px;right:12px;background:#1e293b;color:#94a3b8;font:12px monospace;padding:8px 14px;border-radius:8px;}
@media print{.tip{display:none;}}</style></head>
<body><div class="tip">Ctrl+P / ⌘P to save as PDF</div>
<img src="${imgData}" onload="setTimeout(()=>window.print(),400)"></body></html>`);
        win.document.close();
    };

    const clearAll = () => { pushHistory(stateRef.current.shapes); setShapes([]); setSelectedId(null); };

    // ── Computed state 
    const cursor = isPanning ? "grabbing" : tool === TOOLS.PAN ? "grab" : tool === TOOLS.ERASER ? "cell" : tool === TOOLS.TEXT ? "text" : tool === TOOLS.SELECT ? "default" : "crosshair";
    const hasFill = ([TOOLS.RECT, TOOLS.ELLIPSE, TOOLS.DIAMOND] as Tool[]).includes(tool);
    const selShape = shapes.find(s => s.id === selectedId);
    const rotDeg = selShape ? Math.round(((selShape.rotation || 0) * 180 / Math.PI + 360) % 360) : 0;
    const selHasFill = selShape && (selShape.type === "rect" || selShape.type === "ellipse" || selShape.type === "diamond");

    // What does the just-drawn shape support?
    const justDrawnShape = shapes.find(s => s.id === justDrawnId);
    const justDrawnHasFill = justDrawnShape && (justDrawnShape.type === "rect" || justDrawnShape.type === "ellipse" || justDrawnShape.type === "diamond");
    const justDrawnIsRect = justDrawnShape?.type === "rect";

    const toolGroups = [
        [{ id: TOOLS.SELECT, label: "Select  ⌘1" }, { id: TOOLS.PAN, label: "Pan  ⌘2" }],
        [{ id: TOOLS.PEN, label: "Pen  ⌘3" }, { id: TOOLS.ERASER, label: "Eraser  ⌘4" }],
        [{ id: TOOLS.LINE, label: "Line  ⌘5" }, { id: TOOLS.ARROW, label: "Arrow  ⌘6" }],
        [{ id: TOOLS.RECT, label: "Rect  ⌘7" }, { id: TOOLS.ELLIPSE, label: "Ellipse  ⌘8" }, { id: TOOLS.DIAMOND, label: "Diamond  ⌘9" }],
        [{ id: TOOLS.TEXT, label: "Text  ⌘0" }],
    ];

    return (
        <div style={{ display: "flex", width: "100vw", height: "100vh", background: "#0d1117", color: "#f8fafc", fontFamily: "'JetBrains Mono',monospace", overflow: "hidden", userSelect: "none" }}>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500&display=swap');
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#1e293b;border-radius:4px}
        input[type=range]{-webkit-appearance:none;width:100%;height:4px;border-radius:2px;background:#1e293b;outline:none;cursor:pointer}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:50%;background:#3b82f6;cursor:pointer}
        input[type=color]{-webkit-appearance:none;width:22px;height:22px;border:none;border-radius:4px;padding:0;cursor:pointer;background:transparent}
        input[type=color]::-webkit-color-swatch-wrapper{padding:0;border-radius:4px}
        input[type=color]::-webkit-color-swatch{border:none;border-radius:4px}
        textarea{resize:none;outline:none;font-family:inherit}
        textarea::placeholder{color:#334155}
        select{-webkit-appearance:none;appearance:none;outline:none;cursor:pointer;}
        .panel-sec{padding:12px 14px;border-bottom:1px solid #0f1f35;}
        .panel-sec:last-child{border-bottom:none;}
      `}</style>

            {/* ── Left Toolbar ── */}
            <div style={{ width: 52, display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 6px", background: "#0d1117", borderRight: "1px solid #1e293b", gap: 3, zIndex: 10, flexShrink: 0 }}>
                {toolGroups.map((group, gi) => (
                    <div key={gi} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, width: "100%" }}>
                        {gi > 0 && <div style={{ width: 28, height: 1, background: "#1e293b", margin: "3px 0" }} />}
                        {group.map(t => <ToolBtn key={t.id} active={tool === t.id} label={t.label} onClick={() => setTool(t.id)}>{Ic[t.id]}</ToolBtn>)}
                    </div>
                ))}
                <div style={{ flex: 1 }} />
                <div style={{ width: 28, height: 1, background: "#1e293b", margin: "3px 0" }} />
                <ToolBtn label="Undo  ⌘Z" onClick={undo}>{Ic.undo}</ToolBtn>
                <ToolBtn label="Redo  ⌘⇧Z" onClick={redo}>{Ic.redo}</ToolBtn>
                <ToolBtn label="Clear all" onClick={clearAll} danger>{Ic.trash}</ToolBtn>
            </div>

            {/* ── Main Area ── */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

                {/* ── Top bar ── */}
                <div style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", background: "#0d1117", borderBottom: "1px solid #1e293b", flexShrink: 0, gap: 8 }}>

                    {/* Left: logo + info */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
                        {/* <div style={{width:22,height:22,borderRadius:6,background:"linear-gradient(135deg,#3b82f6,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0}}>D</div> */}
                        <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500, flexShrink: 0 }}>DrawPad</span>
                        {selShape && <span style={{ fontSize: 10, color: "#60a5fa", background: "#172554", padding: "2px 8px", borderRadius: 4, marginLeft: 4, whiteSpace: "nowrap" }}>{selShape.type} · {rotDeg}° · drag ● to rotate</span>}
                    </div>

                    {/* Centre: bg color picker */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, position: "relative" }}>
                        <span style={{ fontSize: 9, color: "#475569", letterSpacing: "0.1em", textTransform: "uppercase" }}>Canvas</span>
                        {/* Color dot that opens picker */}
                        <button onClick={() => setShowBgPicker(p => !p)} title="Canvas background"
                            style={{ width: 24, height: 24, borderRadius: 5, border: "1px solid #334155", background: bgColor, cursor: "pointer", position: "relative", flexShrink: 0, transition: "transform 0.1s", transform: showBgPicker ? "scale(1.1)" : "scale(1)" }}>
                            {showBgPicker && <span style={{ position: "absolute", top: 2, right: 2, width: 5, height: 5, borderRadius: "50%", background: "#3b82f6" }} />}
                        </button>
                        {/* Dropdown picker */}
                        {showBgPicker && (
                            <div style={{ position: "absolute", top: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)", background: "#111827", border: "1px solid #1e293b", borderRadius: 10, padding: 10, zIndex: 200, boxShadow: "0 12px 32px rgba(0,0,0,0.6)", width: 180 }}
                                onMouseDown={e => e.stopPropagation()}>
                                <div style={{ fontSize: 9, color: "#334155", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Background</div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 5, marginBottom: 8 }}>
                                    {BG_PRESETS.map(({ label, value }) => (
                                        <button key={value} title={label} onClick={() => { setBgColor(value); setShowBgPicker(false); }} style={{
                                            height: 28, borderRadius: 6, cursor: "pointer", border: "none", background: value,
                                            outline: bgColor === value ? "2px solid #3b82f6" : "1px solid rgba(255,255,255,0.1)",
                                            outlineOffset: 2, transform: bgColor === value ? "scale(1.06)" : "scale(1)", transition: "all 0.12s",
                                            fontSize: 7, color: value === "#ffffff" || value === "#fefce8" || value === "#f8fafc" ? "#475569" : "#64748b",
                                            fontFamily: "inherit",
                                        }}>{label}</button>
                                    ))}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <input type="color" value={bgColor.match(/^#[0-9a-f]{6}$/i) ? bgColor : "#0d1117"} onChange={e => setBgColor(e.target.value)}
                                        style={{ width: 22, height: 22, border: "1px solid #334155", borderRadius: 4, cursor: "pointer" }} />
                                    <span style={{ fontSize: 9, color: "#475569", fontFamily: "monospace" }}>{bgColor}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right: zoom + download */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                        <button onClick={() => setZoom(z => Math.max(0.1, z / 1.25))} style={{ background: "#1e293b", border: "none", color: "#94a3b8", width: 26, height: 26, borderRadius: 6, cursor: "pointer", fontSize: 16, lineHeight: 1, fontFamily: "inherit" }}>−</button>
                        <span style={{ fontSize: 11, color: "#475569", width: 42, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
                        <button onClick={() => setZoom(z => Math.min(20, z * 1.25))} style={{ background: "#1e293b", border: "none", color: "#94a3b8", width: 26, height: 26, borderRadius: 6, cursor: "pointer", fontSize: 16, lineHeight: 1, fontFamily: "inherit" }}>+</button>
                        <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} style={{ background: "transparent", border: "none", color: "#475569", fontSize: 10, cursor: "pointer", padding: "0 4px", fontFamily: "inherit" }}>Reset</button>
                        <div style={{ width: 1, height: 20, background: "#1e293b", margin: "0 2px" }} />
                        <button onClick={saveToServer} style={{ display: "flex", alignItems: "center", gap: 5, background: savedToast ? "#166534" : "#0f172a", border: `1px solid ${savedToast ? "#16a34a" : "#1e293b"}`, color: savedToast ? "#4ade80" : "#64748b", padding: "5px 11px", borderRadius: 6, fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: 500, transition: "all 0.2s" }}>
                            {savedToast ? "✓ Saved" : "Save"}
                        </button>
                        {hasLocalCache && (
                            <button onClick={fetchDrawing} title="Discard local changes and load from server" style={{ background: "transparent", border: "1px solid #1e293b", color: "#475569", padding: "5px 11px", borderRadius: 6, fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>
                                ↓ Sync DB
                            </button>
                        )}
                        <div style={{ position: "relative" }}>
                            <button onClick={() => setShowDlMenu(m => !m)} style={{ display: "flex", alignItems: "center", gap: 5, background: "#1d4ed8", border: "none", color: "#fff", padding: "5px 11px", borderRadius: 6, fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>
                                {Ic.download} Download ▾
                            </button>
                            {showDlMenu && (
                                <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: "#1e293b", border: "1px solid #334155", borderRadius: 8, overflow: "hidden", zIndex: 100, minWidth: 150, boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
                                    <button onClick={() => { exportPNG(); setShowDlMenu(false); }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "transparent", border: "none", color: "#94a3b8", padding: "9px 14px", fontSize: 11, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                                        {Ic.download} Image (PNG)
                                    </button>
                                    <div style={{ height: 1, background: "#334155" }} />
                                    <button onClick={() => { exportPDF(); setShowDlMenu(false); }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "transparent", border: "none", color: "#94a3b8", padding: "9px 14px", fontSize: 11, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                                        {Ic.pdf} PDF Document
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Canvas ── */}
                <div ref={containerRef} style={{ flex: 1, position: "relative", overflow: "hidden" }}>
                    <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, cursor }}
                        onMouseDown={onMouseDown} onMouseMove={onMouseMove}
                        onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
                        onDoubleClick={onDoubleClick} />

                    {/* Text Input */}
                    {textInput && (
                        <div style={{ position: "absolute", left: `${textInput.x * zoom + pan.x}px`, top: `${(textInput.y - (14 + strokeWidth * 2)) * zoom + pan.y}px`, zIndex: 1000, pointerEvents: "auto", transform: "translate(-50%,-50%)" }}
                            onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
                            <textarea ref={textareaRef} value={textVal} onChange={e => setTextVal(e.target.value)}
                                onBlur={commitText}
                                onKeyDown={e => {
                                    e.stopPropagation();
                                    if (e.key === "Escape") { e.preventDefault(); setTextInput(null); setTextVal(""); setEditingTextId(null); }
                                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitText(); }
                                }}
                                placeholder="Type your text here…" rows={3}
                                style={{ display: "block", background: "rgba(13,17,23,0.98)", border: `2px solid ${editingTextId ? "#8b5cf6" : "#3b82f6"}`, color: color || "#f8fafc", fontSize: `${14 + strokeWidth * 2}px`, fontFamily: "'JetBrains Mono',monospace", padding: "10px 14px", borderRadius: 8, minWidth: 260, width: 320, maxWidth: "calc(100vw - 300px)", backdropFilter: "blur(20px)", lineHeight: 1.4, caretColor: editingTextId ? "#8b5cf6" : "#3b82f6", resize: "vertical", outline: "none", boxShadow: "0 10px 40px rgba(0,0,0,0.6)", fontWeight: 400 }} />
                            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8, padding: "6px 10px", background: "rgba(30,41,59,0.9)", borderRadius: 6, textAlign: "center" }}>
                                {editingTextId ? "✏️ Editing · " : ""}↵ save · ⇧↵ new line · Esc cancel
                            </div>
                        </div>
                    )}
                    <div style={{ position: "absolute", bottom: 10, left: 12, fontSize: 10, display: "flex", gap: 14, pointerEvents: "none" }}>
                        <span style={{ color: "#334155" }}>{shapes.length} elements</span>
                        <span style={{ color: "#1e2a3a" }}>Scroll to zoom · Alt+drag to pan</span>
                        {selectedId && <span style={{ color: "#1d4ed8" }}>⌫ Delete · drag to move · drag ● to rotate</span>}
                    </div>
                </div>
            </div>

            {/* ── Right Panel ── */}
            <div style={{ width: 220, background: "#080e18", borderLeft: "1px solid #0f1f35", display: "flex", flexDirection: "column", overflowY: "auto", overflowX: "hidden", zIndex: 10, flexShrink: 0 }}>

                {/* ── SELECTED SHAPE section ── */}
                {selShape && (
                    <div className="panel-sec">
                        <div style={{ ...SEC_LABEL }}><Dot color="#3b82f6" />{selShape.type} selected · {rotDeg}°</div>

                        {/* Stroke/border color */}
                        <div style={{ fontSize: 9, color: "#475569", marginBottom: 5 }}>Border Color</div>
                        <SwatchGrid value={selShape.color ?? "#f8fafc"} onChange={updateSelectedColor} />
                        <ColorHexRow value={selShape.color ?? "#f8fafc"} onChange={updateSelectedColor} />

                        {/* Fill color (only for fill-capable shapes) */}
                        {selHasFill && (
                            <>
                                <div style={{ fontSize: 9, color: "#475569", margin: "10px 0 5px" }}>Fill Color</div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 4, marginBottom: 6 }}>
                                    <button onClick={() => updateSelectedFill("none")} title="No fill" style={{ aspectRatio: "1", borderRadius: 5, border: "1px dashed #334155", cursor: "pointer", background: "transparent", color: "#475569", fontSize: 9, outline: (selShape.fill ?? "none") === "none" ? "2px solid #3b82f6" : "none", outlineOffset: 1 }}>∅</button>
                                    {COLORS.slice(0, 11).map(c => (
                                        <button key={c} onClick={() => updateSelectedFill(c)} style={{ width: "100%", aspectRatio: "1", borderRadius: 5, border: "none", cursor: "pointer", background: c, outline: (selShape.fill ?? "none") === c ? "2px solid #3b82f6" : "1px solid rgba(255,255,255,0.06)", outlineOffset: 1, opacity: (selShape.fill ?? "none") === c ? 1 : 0.6, transform: (selShape.fill ?? "none") === c ? "scale(1.15)" : "scale(1)", transition: "all 0.1s" }} />
                                    ))}
                                </div>
                            </>
                        )}

                        {/* Stroke width */}
                        <div style={{ fontSize: 9, color: "#475569", margin: "10px 0 5px" }}>Stroke Width</div>
                        <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
                            {STROKE_WIDTHS.map(w => (
                                <button key={w} onClick={() => { pushHistory(stateRef.current.shapes); setShapes(s => s.map(sh => sh.id === selectedId ? { ...sh, strokeWidth: w } : sh)); setStrokeWidth(w); }} style={{ flex: 1, height: 30, border: "none", cursor: "pointer", background: ((selShape.strokeWidth ?? 2) === w) ? "#162032" : "#0a1220", borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", outline: ((selShape.strokeWidth ?? 2) === w) ? "1px solid #3b82f6" : "1px solid #0f1f35", transition: "all 0.12s" }}>
                                    <div style={{ background: ((selShape.strokeWidth ?? 2) === w) ? "#93c5fd" : "#475569", borderRadius: 3, width: "65%", height: Math.min(w * 2, 8) }} />
                                </button>
                            ))}
                        </div>

                        {/* Rounded corners (only for rect) */}
                        {selShape.type === "rect" && (
                            <>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                                    <span style={{ fontSize: 9, color: "#475569" }}>Rounded Corners</span>
                                    <button onClick={() => { const next = !(selShape.rounded); pushHistory(stateRef.current.shapes); setShapes(s => s.map(sh => sh.id === selectedId ? { ...sh, rounded: next } : sh)); setRounded(next); }} style={{ width: 34, height: 18, borderRadius: 9, background: (selShape.rounded) ? "#2563eb" : "#0f1f35", border: `1px solid ${(selShape.rounded) ? "#3b82f6" : "#1e293b"}`, cursor: "pointer", position: "relative", transition: "all 0.2s", padding: 0, flexShrink: 0 }}>
                                        <div style={{ position: "absolute", top: 2, left: (selShape.rounded) ? 15 : 2, width: 12, height: 12, borderRadius: "50%", background: "#fff", transition: "left 0.18s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
                                    </button>
                                </div>
                                {selShape.rounded && (
                                    <div style={{ marginBottom: 10 }}>
                                        <div style={{ fontSize: 9, color: "#475569", marginBottom: 5 }}>Radius · {selShape.roundedRadius ?? 8}px</div>
                                        <input type="range" min="2" max="48" step="1" value={selShape.roundedRadius ?? 8} onChange={e => { const v = parseInt(e.target.value); setShapes(s => s.map(sh => sh.id === selectedId ? { ...sh, roundedRadius: v } : sh)); setRoundedRadius(v); }}
                                            style={{ width: "100%", height: 4, borderRadius: 2, background: `linear-gradient(to right,#3b82f6 ${(((selShape.roundedRadius ?? 8) - 2) / 46) * 100}%,#1e293b ${(((selShape.roundedRadius ?? 8) - 2) / 46) * 100}%)`, outline: "none", cursor: "pointer", appearance: "none" }} />
                                    </div>
                                )}
                            </>
                        )}

                        {/* Text edit button */}
                        {selShape.type === "text" && (
                            <button onClick={() => openTextEdit(selShape)} style={{ width: "100%", background: "#1e1b4b", border: "1px solid #4c1d95", color: "#a78bfa", borderRadius: 5, padding: "5px 0", fontSize: 10, cursor: "pointer", fontFamily: "inherit", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                                {Ic.edit} Edit Text
                            </button>
                        )}

                        {/* Rotation controls */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, marginBottom: 8 }}>
                            {([["Reset°", 0], ["−90°", -Math.PI / 2], ["+90°", Math.PI / 2]] as [string, number][]).map(([lbl, delta]) => (
                                <button key={lbl} onClick={() => { pushHistory(stateRef.current.shapes); setShapes(s => s.map(sh => sh.id === selectedId ? { ...sh, rotation: delta === 0 ? 0 : (selShape.rotation || 0) + delta } : sh)); }}
                                    style={{ background: "#0f172a", border: "1px solid #1e293b", color: "#64748b", borderRadius: 5, padding: "5px 0", fontSize: 9, cursor: "pointer", fontFamily: "inherit" }}>
                                    {lbl}
                                </button>
                            ))}
                        </div>

                        {/* Delete */}
                        <button onClick={() => { pushHistory(stateRef.current.shapes); setShapes(s => s.filter(sh => sh.id !== selectedId)); setSelectedId(null); }}
                            style={{ width: "100%", background: "#1a0a0a", border: "1px solid #7f1d1d", color: "#f87171", borderRadius: 5, padding: "6px 0", fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>
                            ⌫ Delete Shape
                        </button>
                    </div>
                )}

                {/* ── JUST-DRAWN: live tweak ── */}
                {justDrawnId && !selShape && (
                    <div className="panel-sec">
                        <div style={{ ...SEC_LABEL }}><Dot color="#22d3ee" />Just drawn</div>
                        <div style={{ fontSize: 9, color: "#0e7490", marginBottom: 8, background: "#083344", padding: "4px 8px", borderRadius: 4, lineHeight: 1.4 }}>
                            Tweak before clicking elsewhere
                        </div>

                        {/* Border color */}
                        <div style={{ fontSize: 9, color: "#475569", marginBottom: 5 }}>Border Color</div>
                        <SwatchGrid value={color} onChange={updateJustDrawnColor} />
                        <ColorHexRow value={color} onChange={updateJustDrawnColor} />

                        {/* Fill (only if fill-capable) */}
                        {justDrawnHasFill && (
                            <>
                                <div style={{ fontSize: 9, color: "#475569", margin: "10px 0 5px" }}>Fill Color</div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 4 }}>
                                    <button onClick={() => updateJustDrawnFill("none")} title="No fill" style={{ aspectRatio: "1", borderRadius: 5, border: "1px dashed #334155", cursor: "pointer", background: "transparent", color: "#475569", fontSize: 9, outline: fillColor === "none" ? "2px solid #3b82f6" : "none", outlineOffset: 1 }}>∅</button>
                                    {COLORS.slice(0, 11).map(c => (
                                        <button key={c} onClick={() => updateJustDrawnFill(c)} style={{ width: "100%", aspectRatio: "1", borderRadius: 5, border: "none", cursor: "pointer", background: c, outline: fillColor === c ? "2px solid #3b82f6" : "1px solid rgba(255,255,255,0.06)", outlineOffset: 1, opacity: fillColor === c ? 1 : 0.55, transform: fillColor === c ? "scale(1.15)" : "scale(1)", transition: "all 0.1s" }} />
                                    ))}
                                </div>
                            </>
                        )}

                        {/* Stroke width */}
                        <div style={{ fontSize: 9, color: "#475569", margin: "10px 0 5px" }}>Stroke Width</div>
                        <div style={{ display: "flex", gap: 4 }}>
                            {STROKE_WIDTHS.map(w => (
                                <button key={w} onClick={() => updateJustDrawnStrokeWidth(w)} style={{ flex: 1, height: 30, border: "none", cursor: "pointer", background: strokeWidth === w ? "#162032" : "#0a1220", borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", outline: strokeWidth === w ? "1px solid #3b82f6" : "1px solid #0f1f35", transition: "all 0.12s" }}>
                                    <div style={{ background: strokeWidth === w ? "#93c5fd" : "#475569", borderRadius: 3, width: "65%", height: Math.min(w * 2, 8) }} />
                                </button>
                            ))}
                        </div>

                        {/* Rounded corners (only for rect) */}
                        {justDrawnIsRect && (
                            <>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
                                    <span style={{ fontSize: 9, color: "#475569" }}>Rounded Corners</span>
                                    <button onClick={() => { const next = !rounded; setRounded(next); setShapes(s => s.map(sh => sh.id === justDrawnId ? { ...sh, rounded: next } : sh)); }} style={{ width: 34, height: 18, borderRadius: 9, background: rounded ? "#2563eb" : "#0f1f35", border: `1px solid ${rounded ? "#3b82f6" : "#1e293b"}`, cursor: "pointer", position: "relative", transition: "all 0.2s", padding: 0, flexShrink: 0 }}>
                                        <div style={{ position: "absolute", top: 2, left: rounded ? 15 : 2, width: 12, height: 12, borderRadius: "50%", background: "#fff", transition: "left 0.18s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
                                    </button>
                                </div>
                                {rounded && (
                                    <div style={{ marginTop: 8 }}>
                                        <div style={{ fontSize: 9, color: "#475569", marginBottom: 5 }}>Radius · {roundedRadius}px</div>
                                        <input type="range" min="2" max="48" step="1" value={roundedRadius} onChange={e => updateJustDrawnRoundedRadius(parseInt(e.target.value))}
                                            style={{ width: "100%", height: 4, borderRadius: 2, background: `linear-gradient(to right,#3b82f6 ${((roundedRadius - 2) / 46) * 100}%,#1e293b ${((roundedRadius - 2) / 46) * 100}%)`, outline: "none", cursor: "pointer", appearance: "none" }} />
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* ── DRAWING DEFAULTS (shown when nothing is selected / just drawn) ── */}
                {!selShape && !justDrawnId && (
                    <div className="panel-sec">
                        <div style={{ ...SEC_LABEL }}><Dot color="#f8fafc" />Border Color</div>
                        <SwatchGrid value={color} onChange={setColor} />
                        <ColorHexRow value={color} onChange={setColor} />

                        {hasFill && (
                            <>
                                <div style={{ fontSize: 9, color: "#475569", margin: "10px 0 5px" }}>Fill Color</div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 4 }}>
                                    <button onClick={() => setFillColor("none")} title="No fill" style={{ aspectRatio: "1", borderRadius: 5, border: "1px dashed #334155", cursor: "pointer", background: "transparent", color: "#475569", fontSize: 9, outline: fillColor === "none" ? "2px solid #3b82f6" : "none", outlineOffset: 1 }}>∅</button>
                                    {COLORS.slice(0, 11).map(c => (
                                        <button key={c} onClick={() => setFillColor(c)} style={{ width: "100%", aspectRatio: "1", borderRadius: 5, border: "none", cursor: "pointer", background: c, outline: fillColor === c ? "2px solid #3b82f6" : "1px solid rgba(255,255,255,0.06)", outlineOffset: 1, opacity: fillColor === c ? 1 : 0.55, transform: fillColor === c ? "scale(1.15)" : "scale(1)", transition: "all 0.1s" }} />
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* ── STROKE WIDTH + OPACITY (shown when idle, not when just drawn or selected) ── */}
                {!selShape && !justDrawnId && (
                    <div className="panel-sec">
                        <div style={{ ...SEC_LABEL }}><Dot color="#94a3b8" />Stroke Width</div>
                        <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
                            {STROKE_WIDTHS.map(w => (
                                <button key={w} onClick={() => setStrokeWidth(w)} style={{ flex: 1, height: 32, border: "none", cursor: "pointer", background: strokeWidth === w ? "#162032" : "#0a1220", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", outline: strokeWidth === w ? "1px solid #3b82f6" : "1px solid #0f1f35", transition: "all 0.12s" }}>
                                    <div style={{ background: strokeWidth === w ? "#93c5fd" : "#475569", borderRadius: 3, width: "65%", height: Math.min(w * 2, 10) }} />
                                </button>
                            ))}
                        </div>

                        <div style={{ ...SEC_LABEL }}><Dot color="#94a3b8" />Opacity · {Math.round(opacity * 100)}%</div>
                        <input type="range" min="0.05" max="1" step="0.05" value={opacity} onChange={e => setOpacity(parseFloat(e.target.value))}
                            style={{ width: "100%", height: 4, borderRadius: 2, background: `linear-gradient(to right,#3b82f6 ${opacity * 100}%,#1e293b ${opacity * 100}%)`, outline: "none", cursor: "pointer", appearance: "none" }} />

                        {/* Rounded corners toggle for rect */}
                        {tool === TOOLS.RECT && (
                            <>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
                                    <span style={{ fontSize: 9, color: "#475569" }}>Rounded Corners</span>
                                    <button onClick={() => setRounded((r: boolean) => !r)} style={{ width: 34, height: 18, borderRadius: 9, background: rounded ? "#2563eb" : "#0f1f35", border: `1px solid ${rounded ? "#3b82f6" : "#1e293b"}`, cursor: "pointer", position: "relative", transition: "all 0.2s", padding: 0, flexShrink: 0 }}>
                                        <div style={{ position: "absolute", top: 2, left: rounded ? 15 : 2, width: 12, height: 12, borderRadius: "50%", background: "#fff", transition: "left 0.18s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
                                    </button>
                                </div>
                                {rounded && (
                                    <div style={{ marginTop: 8 }}>
                                        <div style={{ ...SEC_LABEL, marginBottom: 5 }}><Dot color="#94a3b8" />Radius · {roundedRadius}px</div>
                                        <input type="range" min="2" max="48" step="1" value={roundedRadius} onChange={e => setRoundedRadius(parseInt(e.target.value))}
                                            style={{ width: "100%", height: 4, borderRadius: 2, background: `linear-gradient(to right,#3b82f6 ${((roundedRadius - 2) / 46) * 100}%,#1e293b ${((roundedRadius - 2) / 46) * 100}%)`, outline: "none", cursor: "pointer", appearance: "none" }} />
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* ── SHORTCUTS ── */}
                <div className="panel-sec" style={{ marginTop: "auto" }}>
                    <div style={{ ...SEC_LABEL }}><Dot color="#334155" />Shortcuts</div>
                    {[
                        ["⌘1-0", "Tools"], ["⌘Z", "Undo"], ["⌘⇧Z", "Redo"],
                        ["⌫", "Delete sel."], ["Dbl-click", "Select/Edit"], ["Scroll", "Zoom"], ["Alt+drag", "Pan"],
                    ].map(([k, v]) => (
                        <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 0", borderBottom: "1px solid #0a1220" }}>
                            <span style={{ fontSize: 9, color: "#334155" }}>{v}</span>
                            <kbd style={{ fontSize: 8, background: "#0f1f35", color: "#475569", padding: "2px 5px", borderRadius: 3, fontFamily: "inherit", border: "1px solid #1e293b" }}>{k}</kbd>
                        </div>
                    ))}
                </div>

            </div>
        </div>
    );
}