import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { http } from "../../services/http";
import { env } from "../../config/env";
import DrawingPad from "./Drawpad";
import type { DrawShape, Point } from "./Drawpad";

function useIsMobile() {
    const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
    useEffect(() => {
        const mq = window.matchMedia("(max-width: 767px)");
        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, []);
    return isMobile;
}

export default function DrawingPadPage() {
    const isMobile = useIsMobile();
    const { fileId } = useParams<{ fileId: string }>();
    const navigate = useNavigate();
    const creatingFileRef = useRef(false);

    const _localKey = fileId ? `drawpad_file_${fileId}` : "drawpad_temp";
    // Memoized: parsing the whole drawing from localStorage on every render is expensive
    const _saved = useMemo(() => {
        try { return JSON.parse(localStorage.getItem(_localKey) ?? "{}"); } catch { return {}; }
    }, [_localKey]);
    const _hasLocal = !!_saved.shapes?.length;

    const [shapes,        setShapes]        = useState<DrawShape[]>(_saved.shapes  ?? []);
    const [bgColor,       setBgColor]       = useState<string>     (_saved.bgColor ?? "#0d1117");
    const [zoom,          setZoom]          = useState<number>     (_saved.zoom    ?? 1);
    const [pan,           setPan]           = useState<Point>      (_saved.pan     ?? { x: 0, y: 0 });
    const [savedToast,    setSavedToast]    = useState(false);
    const [hasLocalCache, setHasLocalCache] = useState(!!_saved.shapes);

    const shapesRef  = useRef(shapes);
    const bgColorRef = useRef(bgColor);
    const zoomRef    = useRef(zoom);
    const panRef     = useRef(pan);
    const esRef      = useRef<EventSource | null>(null);
    // Lets the initial-load sync detect if the user toggled the theme
    // before the fetch resolved, so it doesn't stomp their choice.
    const initialBgRef = useRef(bgColor);

    useEffect(() => { shapesRef.current  = shapes;  }, [shapes]);
    useEffect(() => { bgColorRef.current = bgColor; }, [bgColor]);
    useEffect(() => { zoomRef.current    = zoom;    }, [zoom]);
    useEffect(() => { panRef.current     = pan;     }, [pan]);

    const persistLocal = useCallback((overrides?: Partial<{ shapes: DrawShape[]; bgColor: string; zoom: number; pan: Point }>) => {
        try {
            localStorage.setItem(_localKey, JSON.stringify({
                shapes:  overrides?.shapes  ?? shapesRef.current,
                bgColor: overrides?.bgColor ?? bgColorRef.current,
                zoom:    overrides?.zoom    ?? zoomRef.current,
                pan:     overrides?.pan     ?? panRef.current,
            }));
        } catch {}
    }, [_localKey]);


    useEffect(() => {
        if (!fileId) return;

        const token = localStorage.getItem("token");
        if (!token) return;

        const params = new URLSearchParams({ token, fileId });
        const url    = `${env.apiBaseUrl}/events?${params.toString()}`;
        const es     = new EventSource(url);
        esRef.current = es;

        es.addEventListener("connected", (e) => {
            console.log("[SSE] Connected", JSON.parse(e.data));
        });

        
        es.addEventListener("ai:shapes_ready", (e) => {
            const data = JSON.parse(e.data);
            if (data.shapes?.length) {
                setShapes(data.shapes);
                persistLocal({ shapes: data.shapes });
            }
        });

        
        es.addEventListener("canvas:updated", (e) => {
            const data = JSON.parse(e.data);
            if (data.shapes?.length) {
                setShapes(data.shapes);
                persistLocal({ shapes: data.shapes });
            }
        });

        es.onerror = () => {
            console.warn("[SSE] Connection lost, browser will retry...");
        };

        return () => {
            es.close();
            esRef.current = null;
        };
    }, [fileId, persistLocal]);

    const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = setTimeout(() => {
            persistLocal({ shapes, bgColor, zoom, pan });
        }, 800);
        return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
    }, [shapes, bgColor, zoom, pan, persistLocal]);

    const onSave = async () => {
        if (!fileId) return;
        try {
            await http.private.post("/drawing/save", {
                fileId, shapes, bgColor, zoom, panX: pan.x, panY: pan.y,
                // Canvas fills the viewport
                canvasWidth:  window.innerWidth,
                canvasHeight: window.innerHeight,
            });
            persistLocal({ shapes, bgColor, zoom, pan });
            setSavedToast(true);
            setTimeout(() => setSavedToast(false), 2000);
        } catch (err) {
            console.error("Save failed", err);
            alert(err instanceof Error ? err.message : "Save failed");
        }
    };

    const onSync = async (isInitialLoad = false) => {
        if (!fileId) return;
        let res;
        try {
            res = await http.private.get<{ success: boolean; data: any }>(`/drawing/file/${fileId}`);
        } catch (err) {
            console.error("Sync failed", err);
            return;
        }
        const drawing = res.data?.data ?? res.data;
        if (!drawing) return;
        const newShapes = drawing.shapesJson || [];
        const newBg     = drawing.bgColor    || "#0d1117";
        const newZoom   = drawing.zoom       || 1;
        const newPan    = { x: drawing.panX  || 0, y: drawing.panY || 0 };
        // On the initial load sync, don't override a theme toggle the user
        // already made while this fetch was in flight.
        const userChangedBgDuringLoad = isInitialLoad && bgColorRef.current !== initialBgRef.current;
        const resolvedBg = userChangedBgDuringLoad ? bgColorRef.current : newBg;
        setShapes(newShapes);
        setBgColor(resolvedBg);
        setZoom(newZoom);
        setPan(newPan);
        persistLocal({ shapes: newShapes, bgColor: resolvedBg, zoom: newZoom, pan: newPan });
        setHasLocalCache(true);
    };

    const createNewFile = useCallback(async () => {
        if (creatingFileRef.current) return;
        creatingFileRef.current = true;
        try {
            const res = await http.private.post<any>(`/drawing/create`, {});
            const newFileId = res?.data?.id ?? res?.id;
            if (!newFileId) { creatingFileRef.current = false; return; }
            navigate(`/draw/${newFileId}`, { replace: true });
        } catch (err) {
            creatingFileRef.current = false;
            console.error("Failed to create file", err);
        }
    }, [navigate]);

    useEffect(() => {
        if (!fileId) { createNewFile(); return; }
        if (_hasLocal) return;
        onSync(true);
    }, [fileId, createNewFile]);

    if (!fileId) {
        return (
            <div style={{ width:"100vw", height:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#0d1117", color:"#fff", fontSize:"14px" }}>
                Creating file...
            </div>
        );
    }

    return (
        <DrawingPad
            shapes={shapes}
            setShapes={setShapes}
            bgColor={bgColor}
            setBgColor={setBgColor}
            zoom={zoom}
            setZoom={setZoom}
            pan={pan}
            setPan={setPan}
            onSave={onSave}
            onSync={onSync}
            savedToast={savedToast}
            hasLocalCache={hasLocalCache}
            readOnly={isMobile}
            fileId={fileId}
        />
    );
}