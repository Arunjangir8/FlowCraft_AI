import { EventEmitter } from "events";
import type { Response } from "express";



export interface AiShapesReadyPayload {
  sessionId:       string;
  reply:           string;
  shapes:          any[] | null;
  mermaidDiagram?: string;
  diagramType?:    string;
}

export interface CanvasUpdatedPayload {
  fileId:    string;
  updatedBy: string;
  shapes:    any[];
}

export interface SystemNoticePayload {
  message: string;
}

type ChannelPayloadMap = {
  "ai:shapes_ready": AiShapesReadyPayload;
  "canvas:updated":  CanvasUpdatedPayload;
  "system:notice":   SystemNoticePayload;
};

type Channel = keyof ChannelPayloadMap;



interface SSEConnection {
  res:    Response;
  fileId: string | undefined;
}



class PubSubManager {
  private emitter = new EventEmitter();
  private connections = new Map<string, SSEConnection>(); 

  constructor() {
    this.emitter.setMaxListeners(500);
    this.setupRouter();
  }

  

  registerSSE(userId: string, res: Response, fileId?: string) {
    this.connections.set(userId, { res, fileId });
    console.log(`[PubSub] SSE registered: ${userId}`);
  }

  unregisterSSE(userId: string) {
    this.connections.delete(userId);
    console.log(`[PubSub] SSE removed: ${userId}`);
  }

  

  private setupRouter() {
    
    this.emitter.on("ai:shapes_ready", (payload: AiShapesReadyPayload & { userId: string }) => {
      const { userId, ...data } = payload;
      this.sendToUser(userId, "ai:shapes_ready", data);
    });

    
    this.emitter.on("canvas:updated", (payload: CanvasUpdatedPayload) => {
      this.sendToRoom(payload.fileId, "canvas:updated", payload, payload.updatedBy);
    });

    
    this.emitter.on("system:notice", (payload: SystemNoticePayload) => {
      this.sendToAll("system:notice", payload);
    });
  }

  

  private sendToUser(userId: string, event: string, data: any) {
    const conn = this.connections.get(userId);
    if (conn) conn.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  private sendToRoom(fileId: string, event: string, data: any, excludeUserId?: string) {
    for (const [userId, conn] of this.connections.entries()) {
      if (conn.fileId === fileId && userId !== excludeUserId) {
        conn.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }
    }
  }

  private sendToAll(event: string, data: any) {
    for (const conn of this.connections.values()) {
      conn.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }
  }

  

  publishAiShapesReady(userId: string, payload: AiShapesReadyPayload) {
    this.emitter.emit("ai:shapes_ready", { ...payload, userId });
  }

  publishCanvasUpdated(payload: CanvasUpdatedPayload) {
    this.emitter.emit("canvas:updated", payload);
  }

  publishSystemNotice(message: string) {
    this.emitter.emit("system:notice", { message });
  }

  

  stats() {
    return {
      connections: this.connections.size,
      rooms: [...new Set([...this.connections.values()].map(c => c.fileId).filter(Boolean))],
    };
  }
}

export const pubsub = new PubSubManager();