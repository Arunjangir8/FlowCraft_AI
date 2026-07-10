import { useState, type CSSProperties } from "react";
import type { AiEditPhase } from "./useAiEdit";

export interface AiEditPanelProps {
    phase: AiEditPhase;
    message: string;
    error: string;
    loadingMsg: string;
    opCounts: { created: number; updated: number; deleted: number } | null;
    panelStyle: CSSProperties;
    ink: string;
    muted: string;
    isLight: boolean;
    onSubmit: (instruction: string) => void;
    onAccept: () => void;
    onReject: () => void;
    onClose: () => void;
}

const btnBase: CSSProperties = {
    border: "none", borderRadius: 9, padding: "8px 14px", fontSize: 12,
    cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
    transition: "opacity 0.15s ease",
};

export default function AiEditPanel({
    phase, message, error, loadingMsg, opCounts,
    panelStyle, ink, muted, isLight,
    onSubmit, onAccept, onReject, onClose,
}: AiEditPanelProps) {
    const [instruction, setInstruction] = useState("");
    const subtle = isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.08)";

    const submit = () => {
        const v = instruction.trim();
        if (v) onSubmit(v);
    };

    return (
        <div style={{
            position: "absolute", top: 64, right: 16, width: 300, zIndex: 40,
            ...panelStyle, padding: 14, display: "flex", flexDirection: "column", gap: 10,
        }}>
            <style>{`
                @keyframes aiEditPulse { 0%,100%{opacity:0.35} 50%{opacity:1} }
                @keyframes aiEditFadeIn { from{opacity:0; transform:translateY(-4px)} to{opacity:1; transform:none} }
            `}</style>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: muted }}>
                    {phase === "preview" ? "AI Edit Preview" : "AI Edit"}
                </span>
                <button onClick={onClose} aria-label="Close AI Edit" style={{
                    background: "transparent", border: "none", color: muted, cursor: "pointer",
                    fontSize: 14, lineHeight: 1, padding: 2, fontFamily: "inherit",
                }}>✕</button>
            </div>

            {(phase === "idle" || phase === "error") && (
                <>
                    <textarea
                        value={instruction}
                        onChange={e => setInstruction(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
                            e.stopPropagation();
                        }}
                        placeholder="Describe the edit… e.g. “align the flowchart and improve spacing”"
                        rows={3}
                        style={{
                            width: "100%", background: subtle, color: ink,
                            border: "none", borderRadius: 10, padding: "9px 11px",
                            fontSize: 12.5, lineHeight: 1.45, fontFamily: "inherit",
                        }}
                    />
                    {phase === "error" && (
                        <div style={{
                            fontSize: 12, lineHeight: 1.45, color: "#f87171",
                            animation: "aiEditFadeIn 0.2s ease",
                        }}>{error}</div>
                    )}
                    <button onClick={submit} disabled={!instruction.trim()} style={{
                        ...btnBase,
                        background: isLight ? "#0b0b0d" : "#f5f5f7",
                        color: isLight ? "#f5f5f7" : "#0b0b0d",
                        opacity: instruction.trim() ? 1 : 0.4,
                    }}>Generate edit</button>
                </>
            )}

            {phase === "loading" && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 2px" }}>
                    <span style={{ display: "inline-flex", gap: 4 }}>
                        {[0, 1, 2].map(i => (
                            <span key={i} style={{
                                width: 5, height: 5, borderRadius: "50%", background: ink,
                                animation: `aiEditPulse 1.2s ease ${i * 0.2}s infinite`,
                            }} />
                        ))}
                    </span>
                    <span style={{ fontSize: 12.5, color: muted, animation: "aiEditFadeIn 0.25s ease" }} key={loadingMsg}>
                        {loadingMsg}
                    </span>
                </div>
            )}

            {phase === "preview" && (
                <>
                    <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>{message}</div>
                    {opCounts && (
                        <div style={{ display: "flex", gap: 10, fontSize: 11, color: muted }}>
                            {opCounts.created > 0 && <span style={{ color: "#34d399" }}>+{opCounts.created} new</span>}
                            {opCounts.updated > 0 && <span style={{ color: "#38bdf8" }}>~{opCounts.updated} changed</span>}
                            {opCounts.deleted > 0 && <span style={{ color: "#f87171" }}>−{opCounts.deleted} removed</span>}
                        </div>
                    )}
                    <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={onAccept} style={{
                            ...btnBase, flex: 1, background: "#34d399", color: "#0b0b0d",
                        }}>Accept</button>
                        <button onClick={onReject} style={{
                            ...btnBase, flex: 1, background: subtle, color: ink,
                        }}>Reject</button>
                    </div>
                    <div style={{ fontSize: 10.5, color: muted }}>
                        Nothing is saved until you accept. Esc rejects.
                    </div>
                </>
            )}
        </div>
    );
}
