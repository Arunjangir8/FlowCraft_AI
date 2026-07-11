import { useCallback, useEffect, useRef, useState } from "react";
import { http } from "../../../services/http";
import { applyOperations, type AiEditResponse, type AppliedPreview } from "./operations";
import type { DrawShape } from "../Drawpad";

export type AiEditPhase = "idle" | "loading" | "preview" | "error";

export type AiEditCanvasMeta = {
    width: number;
    height: number;
    background: string;
    zoom: number;
    selectedShapeIds: Array<number | string>;
};

const LOADING_MESSAGES = [
    "Analyzing drawing…",
    "Understanding relationships…",
    "Planning improvements…",
    "Generating edits…",
    "Preparing preview…",
];

const TIMEOUT_MS = 60_000;

const ERROR_TEXT: Record<string, string> = {
    NOT_AN_AI_FILE: "AI editing is only available on AI files. Create a file with an AI prompt to use it.",
    AI_CALL_LIMIT_EXCEEDED: "You've reached the AI limit for this file (20 requests).",
};

export function useAiEdit(fileId?: string) {
    const [phase, setPhase] = useState<AiEditPhase>("idle");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [preview, setPreview] = useState<AppliedPreview | null>(null);
    const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
    const reqSeq = useRef(0);

    useEffect(() => {
        if (phase !== "loading") return;
        let i = 0;
        setLoadingMsg(LOADING_MESSAGES[0]);
        const iv = setInterval(() => {
            i = Math.min(i + 1, LOADING_MESSAGES.length - 1);
            setLoadingMsg(LOADING_MESSAGES[i]);
        }, 1800);
        return () => clearInterval(iv);
    }, [phase]);

    const reset = useCallback(() => {
        reqSeq.current++; // invalidates any in-flight request
        setPhase("idle");
        setPreview(null);
        setMessage("");
        setError("");
    }, []);

    const submit = useCallback(async (
        instruction: string,
        ctx: { shapes: DrawShape[]; canvas: AiEditCanvasMeta },
    ) => {
        if (!instruction.trim()) return;
        if (!fileId) {
            setPhase("error");
            setError("This drawing isn't saved yet — AI Edit needs a saved file.");
            return;
        }
        const seq = ++reqSeq.current;
        setPhase("loading");
        setError("");
        setPreview(null);
        try {
            const res = await Promise.race([
                http.private.post<AiEditResponse>("/ai/edit", {
                    fileId,
                    instruction,
                    shapes: ctx.shapes,
                    canvas: ctx.canvas,
                }),
                new Promise<never>((_, rej) =>
                    setTimeout(() => rej(new Error("AI edit timed out — please try again.")), TIMEOUT_MS)),
            ]);
            if (seq !== reqSeq.current) return; // cancelled/superseded

            const ops = Array.isArray(res?.operations) ? res.operations : [];
            if (!ops.length) {
                setPhase("error");
                setError(res?.message || "The AI suggested no changes. Try a more specific instruction.");
                return;
            }
            const applied = applyOperations(ctx.shapes, ops);
            if (!applied.created.size && !applied.updated.size && !applied.deletedShapes.length) {
                setPhase("error");
                setError("The AI returned no usable edits. Try rephrasing your instruction.");
                return;
            }
            setMessage(res.message || "Here's the suggested edit.");
            setPreview(applied);
            setPhase("preview");
        } catch (e) {
            if (seq !== reqSeq.current) return;
            setPhase("error");
            const raw = e instanceof Error ? e.message : "";
            setError(ERROR_TEXT[raw] || raw || "Something went wrong. Your drawing is unchanged.");
        }
    }, [fileId]);

    return { phase, message, error, preview, loadingMsg, submit, reset };
}
