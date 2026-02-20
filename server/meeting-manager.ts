import type { Server, Socket } from "socket.io";
import { AudioPipeline } from "./audio-pipeline";
import { getMeeting, endMeeting } from "./db/repositories/meetings";
import { getChunks } from "./db/repositories/transcripts";
import { getArtefacts } from "./db/repositories/artefacts";

const DISCONNECT_GRACE_MS = 30_000;

interface ActiveMeeting {
  projectId: string;
  meetingId: string;
  pipeline: AudioPipeline;
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

    this.sendSnapshot(socket, meetingId, projectId);

    socket.on("audio-data", (data: ArrayBuffer) => {
      active.pipeline.handleAudio(socket.id, Buffer.from(data));
    });

    socket.on("text-input", (text: string) => {
      active.pipeline.handleTextInput(text);
    });

    console.log(`[meeting:${meetingId}] Producer joined: ${socket.id}`);
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

    this.sendSnapshot(socket, meetingId, projectId);

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
      console.log(`[meeting:${meetingId}] Producer left: ${socket.id} (${active.producers.size} remaining)`);

      if (active.producers.size === 0) {
        console.log(`[meeting:${meetingId}] No producers left, starting ${DISCONNECT_GRACE_MS}ms grace period`);
        active.disconnectTimer = setTimeout(() => {
          this.shutdownMeeting(meetingId);
        }, DISCONNECT_GRACE_MS);
      }
    } else {
      active.viewers.delete(socket.id);
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
    const pipeline = new AudioPipeline(this.io, room, projectId, meetingId);
    pipeline.start();

    const active: ActiveMeeting = {
      projectId,
      meetingId,
      pipeline,
      producers: new Set(),
      viewers: new Set(),
      disconnectTimer: null,
    };

    this.meetings.set(meetingId, active);
    return active;
  }

  private sendSnapshot(socket: Socket, meetingId: string, projectId: string) {
    const chunks = getChunks(meetingId);
    const artefactRows = getArtefacts(projectId);

    const transcript = chunks.map((c) => ({
      text: c.text,
      speaker: c.speaker,
      isFinal: true,
    }));

    const artefacts: Record<string, string> = {};
    for (const row of artefactRows) {
      artefacts[row.type] = row.content;
    }

    socket.emit("meeting-state", { transcript, artefacts });
  }

  private shutdownMeeting(meetingId: string) {
    const active = this.meetings.get(meetingId);
    if (!active) return;

    console.log(`[meeting:${meetingId}] Shutting down`);
    active.pipeline.stop();
    endMeeting(meetingId);
    this.meetings.delete(meetingId);
  }

  private roomKey(meetingId: string): string {
    return `meeting:${meetingId}`;
  }
}
