import type { Server, Socket } from "socket.io";
import { AudioHandler } from "./audio-handler";
import { endMeeting } from "./db/repositories/meetings";
import { getChunks, updateChunk, deleteChunk } from "./db/repositories/transcripts";
import { getArtefacts } from "./db/repositories/artefacts";
import { getDocuments, deleteDocument } from "./db/repositories/documents";

const DISCONNECT_GRACE_MS = 30_000;

interface ActiveMeeting {
  projectId: string;
  meetingId: string;
  handler: AudioHandler;
  producers: Set<string>;
  viewers: Set<string>;
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
      console.log(`[meeting:${meetingId}] Reconnection, cancelled shutdown timer`);
    }

    active.producers.add(socket.id);
    socket.join(room);
    socket.data.meetingId = meetingId;
    socket.data.role = "producer";

    this.sendSnapshot(socket, meetingId, projectId).catch(console.error);
    this.broadcastPresence(active);

    socket.on("start-recording", () => {
      active.handler.addParticipant(socket.id);
      console.log(`[meeting:${meetingId}] Recording started by ${socket.id}`);
    });

    socket.on("stop-recording", () => {
      active.handler.removeParticipant(socket.id);
      console.log(`[meeting:${meetingId}] Recording stopped by ${socket.id}`);
    });

    socket.on("audio-data", (data: ArrayBuffer) => {
      active.handler.handleAudio(socket.id, Buffer.from(data));
    });

    socket.on("text-input", (text: string) => {
      active.handler.handleTextInput(text);
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

    socket.on("regenerate-diagrams", () => {
      console.log(`[meeting:${meetingId}] Diagram regeneration (all) requested by ${socket.id}`);
      active.handler.regenerateDiagrams();
    });

    socket.on("regenerate-diagram", (data: { type: string; renderer?: "mermaid" | "html" }) => {
      if (!data?.type) return;
      console.log(`[meeting:${meetingId}] Diagram regeneration (${data.type}) requested by ${socket.id}`);
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

    console.log(`[meeting:${meetingId}] Producer joined: ${socket.id} (${active.producers.size} total)`);
  }

  joinAsViewer(socket: Socket, projectId: string, meetingId: string) {
    const room = this.roomKey(meetingId);
    const active = this.meetings.get(meetingId);

    socket.join(room);
    socket.data.meetingId = meetingId;
    socket.data.role = "viewer";

    if (active) {
      active.viewers.add(socket.id);
    }

    this.sendSnapshot(socket, meetingId, projectId).catch(console.error);
    if (active) this.broadcastPresence(active);

    console.log(`[meeting:${meetingId}] Viewer joined: ${socket.id}`);
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
      console.log(`[meeting:${meetingId}] Producer left: ${socket.id} (${active.producers.size} remaining)`);

      if (active.producers.size === 0) {
        console.log(`[meeting:${meetingId}] No producers left, starting ${DISCONNECT_GRACE_MS}ms grace period`);
        active.disconnectTimer = setTimeout(() => {
          this.shutdownMeeting(meetingId).catch(console.error);
        }, DISCONNECT_GRACE_MS);
      }
    } else {
      active.viewers.delete(socket.id);
      this.broadcastPresence(active);
      console.log(`[meeting:${meetingId}] Viewer left: ${socket.id}`);
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
      producers: new Set(),
      viewers: new Set(),
      disconnectTimer: null,
    };

    this.meetings.set(meetingId, active);
    return active;
  }

  private async sendSnapshot(socket: Socket, meetingId: string, projectId: string) {
    const chunks = await getChunks(meetingId);
    const artefactRows = await getArtefacts(projectId);
    const docs = await getDocuments(meetingId);

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

    socket.emit("meeting-state", { transcript, artefacts, documents });
  }

  private async shutdownMeeting(meetingId: string) {
    const active = this.meetings.get(meetingId);
    if (!active) return;

    console.log(`[meeting:${meetingId}] Shutting down`);
    active.handler.stop();
    await endMeeting(meetingId);
    this.meetings.delete(meetingId);
  }

  private broadcastPresence(active: ActiveMeeting) {
    const participants = [
      ...Array.from(active.producers).map((id) => ({ id, role: "producer" as const })),
      ...Array.from(active.viewers).map((id) => ({ id, role: "viewer" as const })),
    ];
    this.io.to(this.roomKey(active.meetingId)).emit("presence", { participants });
  }

  private roomKey(meetingId: string): string {
    return `meeting:${meetingId}`;
  }
}
