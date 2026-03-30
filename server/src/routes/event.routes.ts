import { Router } from "express";
import { pubsub } from "../lib/pubsub";
import { authMiddleware } from "../middleware/auth.middleware";
import { Request, Response, NextFunction } from "express";

const eventRoutes = Router();

eventRoutes.get("/", authMiddleware, (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user!.id;
        const fileId = req.query.fileId as string | undefined;

        res.setHeader("Content-Type",  "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection",    "keep-alive");
        res.flushHeaders();

        let lastSentAt: number | null = null;  // null = no real event sent yet

        const originalWrite = res.write.bind(res);

        (res as any).write = (chunk: any, encodingOrCb?: any, cb?: any): boolean => {
            lastSentAt = Date.now();
            return originalWrite(chunk, encodingOrCb, cb);
        };

        pubsub.registerSSE(userId, res, fileId);

        // Use originalWrite so connected event doesn't count as activity
        originalWrite(`event: connected\ndata: ${JSON.stringify({ userId, fileId })}\n\n`);

        // Check every 5s — only ping if a real event was sent 10s+ ago OR no event ever sent
        const heartbeat = setInterval(() => {
            const idleMs = lastSentAt === null
                ? Infinity                        // never sent anything → ping immediately
                : Date.now() - lastSentAt;

            if (idleMs >= 10_000) {
                originalWrite(": ping\n");
            }
        }, 5_000);

        req.on("close", () => {
            clearInterval(heartbeat);
            pubsub.unregisterSSE(userId);
        });

    } catch (error) {
        next(error);
    }
});

export default eventRoutes;