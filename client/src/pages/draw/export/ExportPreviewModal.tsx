import type { CSSProperties } from "react";

export interface ExportPreviewModalProps {
    dataUrl: string;
    format: "png" | "pdf";
    panelStyle: CSSProperties;
    ink: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export default function ExportPreviewModal({
    dataUrl, format, panelStyle, ink, onConfirm, onCancel,
}: ExportPreviewModalProps) {
    return (
        <div
            style={{
                position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
                display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
            }}
            onClick={onCancel}
        >
            <div
                style={{
                    ...panelStyle, padding: 16, maxWidth: "min(90vw, 720px)", maxHeight: "85vh",
                    display: "flex", flexDirection: "column", gap: 12,
                }}
                onClick={e => e.stopPropagation()}
            >
                <div style={{ color: ink, fontSize: 13, fontWeight: 600 }}>
                    Preview — {format === "png" ? "Image (PNG)" : "PDF Document"}
                </div>
                <div style={{
                    overflow: "auto", border: "1px solid rgba(128,128,128,0.25)",
                    borderRadius: 8, background: "#fff",
                }}>
                    <img src={dataUrl} alt="Export preview" style={{ display: "block", maxWidth: "100%", height: "auto" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    <button onClick={onCancel} style={{
                        padding: "8px 14px", fontSize: 12, borderRadius: 8, border: "none",
                        background: "transparent", color: ink, cursor: "pointer", fontFamily: "inherit", opacity: 0.75,
                    }}>Cancel</button>
                    <button onClick={onConfirm} style={{
                        padding: "8px 14px", fontSize: 12, borderRadius: 8, border: "none",
                        background: "#38bdf8", color: "#04121a", cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
                    }}>Download</button>
                </div>
            </div>
        </div>
    );
}
