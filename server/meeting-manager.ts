import type { Server, Socket } from "socket.io";
import { AudioHandler } from "./audio-handler";
import { endMeeting } from "./db/repositories/meetings";
import { getChunks, updateChunk, deleteChunk } from "./db/repositories/transcripts";
import { getArtefacts } from "./db/repositories/artefacts";
import { getDocuments, deleteDocument } from "./db/repositories/documents";
import { getGuidanceItems, resolveGuidanceItem, unresolveGuidanceItem } from "./db/repositories/guidance";
import { logger } from "./logger";

const DISCONNECT_GRACE_MS = 30_000;

interface ActiveMeeting {
  projectId: string;
  meetingId: string;
  handler: AudioHandler;
  producers: Map<string, string | null>;
  viewers: Map<string, string | null>;
  disconnectTimer: ReturnType<typeof setTimeout> | null;
}

export class MeetingManager {
  private io: Server;
  private meetings = new Map<string, ActiveMeeting>();

  constructor(io: Server) {
    this.io = io;
  }

  joinAsProducer(socket: Socket, projectId: string, meetingId: string) {
    const room = this.roomKey(meetingId);
    const active = this.getOrCreateMeeting(projectId, meetingId);

    if (active.disconnectTimer) {
      clearTimeout(active.disconnectTimer);
      active.disconnectTimer = null;
      logger.child({ module: "meeting", meetingId }).info("reconnection, cancelled shutdown timer");
    }

    active.producers.set(socket.id, socket.data.userName ?? null);
    socket.join(room);
    socket.data.meetingId = meetingId;
    socket.data.role = "producer";

    const log = logger.child({ module: "meeting", meetingId });
    this.sendSnapshot(socket, meetingId, projectId).catch((err) => log.error({ err }, "snapshot failed"));
    this.broadcastPresence(active);

    socket.on("start-recording", () => {
      active.handler.addParticipant(socket.id, socket.data.userName);
      log.info({ socketId: socket.id }, "recording started");
    });

    socket.on("stop-recording", () => {
      active.handler.removeParticipant(socket.id);
      log.info({ socketId: socket.id }, "recording stopped");
    });

    socket.on("audio-data", (data: ArrayBuffer) => {
      active.handler.handleAudio(socket.id, Buffer.from(data));
    });

    socket.on("text-input", (text: string) => {
      active.handler.handleTextInput(text, socket.data.userName);
    });

    socket.on("edit-transcript", async (data: { id: number; text: string }) => {
      if (!data?.id || typeof data.text !== "string") return;
      await updateChunk(data.id, data.text.trim());
      this.io.to(room).emit("transcript-edited", { id: data.id, text: data.text.trim() });
    });

    socket.on("delete-transcript", async (data: { id: number }) => {
      if (!data?.id) return;
      await deleteChunk(data.id);
      this.io.to(room).emit("transcript-deleted", { id: data.id });
    });

    socket.on("add-diagram", (data: { type: string; renderer?: "mermaid" | "html" }) => {
      if (!data?.type) return;
      log.info({ diagram: data.type, socketId: socket.id }, "add diagram requested");
      active.handler.addDiagram(data.type, data.renderer ?? "mermaid");
    });

    socket.on("regenerate-diagrams", () => {
      log.info({ socketId: socket.id }, "diagram regeneration (all) requested");
      active.handler.regenerateDiagrams();
    });

    socket.on("regenerate-diagram", (data: { type: string; renderer?: "mermaid" | "html" }) => {
      if (!data?.type) return;
      log.info({ diagram: data.type, socketId: socket.id }, "diagram regeneration requested");
      active.handler.regenerateSingleDiagram(data.type, data.renderer ?? "mermaid");
    });

    socket.on("import-transcript", (text: string) => {
      if (typeof text !== "string" || !text.trim()) return;
      active.handler.handleTranscriptImport(text.trim());
    });

    socket.on("delete-document", async (data: { id: string }) => {
      if (!data?.id) return;
      await deleteDocument(data.id);
      this.io.to(room).emit("document-deleted", { id: data.id });
    });

    socket.on("resolve-guidance", async (data: { id: string }) => {
      if (!data?.id) return;
      await resolveGuidanceItem(data.id);
      this.io.to(room).emit("guidance-item-resolved", { id: data.id });
    });

    socket.on("unresolve-guidance", async (data: { id: string }) => {
      if (!data?.id) return;
      await unresolveGuidanceItem(data.id);
      this.io.to(room).emit("guidance-item-unresolved", { id: data.id });
    });

    log.info({ socketId: socket.id, total: active.producers.size }, "producer joined");
  }

  joinAsViewer(socket: Socket, projectId: string, meetingId: string) {
    const room = this.roomKey(meetingId);
    const active = this.meetings.get(meetingId);

    socket.join(room);
    socket.data.meetingId = meetingId;
    socket.data.role = "viewer";

    if (active) {
      active.viewers.set(socket.id, socket.data.userName ?? null);
    }

    const viewerLog = logger.child({ module: "meeting", meetingId });
    this.sendSnapshot(socket, meetingId, projectId).catch((err) => viewerLog.error({ err }, "snapshot failed"));
    if (active) this.broadcastPresence(active);

    viewerLog.info({ socketId: socket.id }, "viewer joined");
  }

  handleDisconnect(socket: Socket) {
    const meetingId = socket.data.meetingId as string | undefined;
    const role = socket.data.role as string | undefined;
    if (!meetingId) return;

    const active = this.meetings.get(meetingId);
    if (!active) return;

    if (role === "producer") {
      active.producers.delete(socket.id);
      active.handler.removeParticipant(socket.id);
      this.broadcastPresence(active);
      const dcLog = logger.child({ module: "meeting", meetingId });
      dcLog.info({ socketId: socket.id, remaining: active.producers.size }, "producer left");

      if (active.producers.size === 0) {
        dcLog.info({ graceMs: DISCONNECT_GRACE_MS }, "no producers left, starting grace period");
        active.disconnectTimer = setTimeout(() => {
          this.shutdownMeeting(meetingId).catch((err) => dcLog.error({ err }, "shutdown failed"));
        }, DISCONNECT_GRACE_MS);
      }
    } else {
      active.viewers.delete(socket.id);
      this.broadcastPresence(active);
      logger.child({ module: "meeting", meetingId }).info({ socketId: socket.id }, "viewer left");
    }
  }

  getActiveMeeting(meetingId: string): ActiveMeeting | undefined {
    return this.meetings.get(meetingId);
  }

  private getOrCreateMeeting(projectId: string, meetingId: string): ActiveMeeting {
    const existing = this.meetings.get(meetingId);
    if (existing) return existing;

    const room = this.roomKey(meetingId);
    const handler = new AudioHandler(this.io, room, projectId, meetingId);
    handler.start();

    const active: ActiveMeeting = {
      projectId,
      meetingId,
      handler,
      producers: new Map(),
      viewers: new Map(),
      disconnectTimer: null,
    };

    this.meetings.set(meetingId, active);
    return active;
  }

  private async sendSnapshot(socket: Socket, meetingId: string, projectId: string) {
    const [chunks, artefactRows, docs, guidanceRows] = await Promise.all([
      getChunks(meetingId),
      getArtefacts(projectId),
      getDocuments(meetingId),
      getGuidanceItems(meetingId),
    ]);

    const transcript = chunks.map((c) => ({
      id: c.id,
      text: c.text,
      speaker: c.speaker,
      isFinal: true,
    }));

    const artefacts: Record<string, string> = {};
    for (const row of artefactRows) {
      artefacts[row.type] = row.content;
    }

    const documents = docs.map((d) => ({
      id: d.id,
      content: d.content,
      createdAt: d.created_at,
    }));

    socket.emit("meeting-state", { transcript, artefacts, documents, guidance: guidanceRows });
  }

  private async shutdownMeeting(meetingId: string) {
    const active = this.meetings.get(meetingId);
    if (!active) return;

    logger.child({ module: "meeting", meetingId }).info("shutting down");
    active.handler.stop();
    await endMeeting(meetingId);
    this.meetings.delete(meetingId);
  }

  private broadcastPresence(active: ActiveMeeting) {
    const participants = [
      ...Array.from(active.producers.entries()).map(([id, name]) => ({ id, role: "producer" as const, name: name ?? undefined })),
      ...Array.from(active.viewers.entries()).map(([id, name]) => ({ id, role: "viewer" as const, name: name ?? undefined })),
    ];
    this.io.to(this.roomKey(active.meetingId)).emit("presence", { participants });
  }

  private roomKey(meetingId: string): string {
    return `meeting:${meetingId}`;
  }
}
