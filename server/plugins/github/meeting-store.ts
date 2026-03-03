import { randomUUID } from "crypto";
import type {
  Meeting,
  TranscriptChunk,
  Document,
  GuidanceItem,
  MeetingStore,
} from "../types/meeting-store";
import { readFile, writeFile, deleteFile, listDirectory } from "./client";

interface MeetingAggregate {
  meeting: Meeting;
  chunks: TranscriptChunk[];
  documents: Document[];
  guidance: GuidanceItem[];
}

function meetingPath(projectId: string, meetingId: string): string {
  return `projects/${projectId}/meetings/${meetingId}.json`;
}

function meetingsDir(projectId: string): string {
  return `projects/${projectId}/meetings`;
}

export class GitHubMeetingStore implements MeetingStore {
  private active = new Map<string, MeetingAggregate>();
  private meetingIndex = new Map<string, string>();
  private subEntityIndex = new Map<string, string>();

  private getActive(meetingId: string): MeetingAggregate | undefined {
    return this.active.get(meetingId);
  }

  private indexAggregate(agg: MeetingAggregate) {
    this.meetingIndex.set(agg.meeting.id, agg.meeting.project_id);
    for (const c of agg.chunks) this.subEntityIndex.set(c.id, agg.meeting.id);
    for (const d of agg.documents) this.subEntityIndex.set(d.id, agg.meeting.id);
    for (const g of agg.guidance) this.subEntityIndex.set(g.id, agg.meeting.id);
  }

  private async readFromGitHub(
    projectId: string,
    meetingId: string,
  ): Promise<MeetingAggregate | undefined> {
    const result = await readFile<MeetingAggregate>(meetingPath(projectId, meetingId));
    if (!result) return undefined;
    this.indexAggregate(result.data);
    return result.data;
  }

  private async findOnGitHub(meetingId: string): Promise<MeetingAggregate | undefined> {
    const projectEntries = await listDirectory("projects");
    for (const proj of projectEntries) {
      if (proj.type !== "dir") continue;
      const agg = await this.readFromGitHub(proj.name, meetingId);
      if (agg) return agg;
    }
    return undefined;
  }

  private async resolveAggregate(meetingId: string): Promise<MeetingAggregate | undefined> {
    const mem = this.getActive(meetingId);
    if (mem) return mem;
    const projectId = this.meetingIndex.get(meetingId);
    if (projectId) return this.readFromGitHub(projectId, meetingId);
    return this.findOnGitHub(meetingId);
  }

  private async activateFromGitHub(meetingId: string): Promise<MeetingAggregate | undefined> {
    const agg = await this.resolveAggregate(meetingId);
    if (!agg) return undefined;
    if (!this.active.has(meetingId) && agg.meeting.status === "active") {
      this.active.set(meetingId, agg);
    }
    return agg;
  }

  private resolveMeetingForSubEntity(subEntityId: string): MeetingAggregate | undefined {
    const meetingId = this.subEntityIndex.get(subEntityId);
    if (!meetingId) return undefined;
    return this.getActive(meetingId);
  }

  async createMeeting(projectId: string, featureId?: string): Promise<Meeting> {
    const id = randomUUID();
    const meeting: Meeting = {
      id,
      project_id: projectId,
      feature_id: featureId ?? null,
      started_at: Date.now(),
      ended_at: null,
      status: "active",
    };
    const agg: MeetingAggregate = { meeting, chunks: [], documents: [], guidance: [] };

    await writeFile(
      meetingPath(projectId, id),
      JSON.stringify(agg, null, 2),
      `create meeting ${id}`,
    );

    this.active.set(id, agg);
    this.meetingIndex.set(id, projectId);
    return meeting;
  }

  async endMeeting(id: string): Promise<void> {
    const agg = await this.activateFromGitHub(id);
    if (!agg) return;
    agg.meeting.ended_at = Date.now();
    agg.meeting.status = "completed";

    await writeFile(
      meetingPath(agg.meeting.project_id, id),
      JSON.stringify(agg, null, 2),
      `complete meeting ${id}`,
    );

    this.active.delete(id);
  }

  async getMeeting(id: string): Promise<Meeting | undefined> {
    const agg = await this.resolveAggregate(id);
    return agg?.meeting;
  }

  async listMeetings(projectId: string): Promise<Meeting[]> {
    const entries = await listDirectory(meetingsDir(projectId));
    const files = entries.filter((e) => e.type === "file" && e.name.endsWith(".json"));

    const meetings: Meeting[] = [];
    for (const entry of files) {
      const meetingId = entry.name.replace(".json", "");
      const mem = this.getActive(meetingId);
      if (mem) {
        meetings.push(mem.meeting);
        continue;
      }
      const remote = await this.readFromGitHub(projectId, meetingId);
      if (remote) meetings.push(remote.meeting);
    }

    for (const agg of this.active.values()) {
      if (agg.meeting.project_id === projectId && !meetings.some((m) => m.id === agg.meeting.id)) {
        meetings.push(agg.meeting);
      }
    }

    return meetings.sort((a, b) => b.started_at - a.started_at);
  }

  async deleteMeeting(id: string): Promise<void> {
    await this.activateFromGitHub(id);
    const projectId = this.meetingIndex.get(id);
    if (!projectId) return;

    const path = meetingPath(projectId, id);
    const result = await readFile<MeetingAggregate>(path);
    if (result) {
      await deleteFile(path, result.sha, `delete meeting ${id}`);
    }

    const agg = this.active.get(id);
    if (agg) {
      for (const c of agg.chunks) this.subEntityIndex.delete(c.id);
      for (const d of agg.documents) this.subEntityIndex.delete(d.id);
      for (const g of agg.guidance) this.subEntityIndex.delete(g.id);
    }
    this.active.delete(id);
    this.meetingIndex.delete(id);
  }

  async insertChunk(
    meetingId: string,
    text: string,
    speaker: string | null,
    timestamp: number,
  ): Promise<TranscriptChunk> {
    const agg = await this.activateFromGitHub(meetingId);
    if (!agg) throw new Error(`No active meeting: ${meetingId}`);
    const chunk: TranscriptChunk = { id: randomUUID(), meeting_id: meetingId, text, speaker, timestamp };
    agg.chunks.push(chunk);
    this.subEntityIndex.set(chunk.id, meetingId);
    return chunk;
  }

  async getChunks(meetingId: string): Promise<TranscriptChunk[]> {
    const agg = await this.resolveAggregate(meetingId);
    if (!agg) return [];
    return [...agg.chunks].sort((a, b) => a.timestamp - b.timestamp);
  }

  async updateChunk(id: string, text: string): Promise<void> {
    const agg = this.resolveMeetingForSubEntity(id);
    if (!agg) return;
    const chunk = agg.chunks.find((c) => c.id === id);
    if (chunk) chunk.text = text;
  }

  async deleteChunk(id: string): Promise<void> {
    const agg = this.resolveMeetingForSubEntity(id);
    if (!agg) return;
    agg.chunks = agg.chunks.filter((c) => c.id !== id);
    this.subEntityIndex.delete(id);
  }

  async insertDocument(meetingId: string, content: string, name?: string): Promise<Document> {
    const agg = await this.activateFromGitHub(meetingId);
    if (!agg) throw new Error(`No active meeting: ${meetingId}`);
    const nextNum = Math.max(0, ...agg.documents.map((d) => d.doc_number)) + 1;
    const doc: Document = {
      id: randomUUID(),
      meeting_id: meetingId,
      content,
      created_at: Date.now(),
      name: name?.trim() || `Doc ${nextNum}`,
      doc_number: nextNum,
    };
    agg.documents.push(doc);
    this.subEntityIndex.set(doc.id, meetingId);
    return doc;
  }

  async getDocuments(meetingId: string): Promise<Document[]> {
    const agg = await this.resolveAggregate(meetingId);
    if (!agg) return [];
    return [...agg.documents].sort((a, b) => a.created_at - b.created_at);
  }

  async getDocumentsByProject(projectId: string): Promise<Document[]> {
    const allDocs: Document[] = [];

    for (const agg of this.active.values()) {
      if (agg.meeting.project_id === projectId) allDocs.push(...agg.documents);
    }

    const entries = await listDirectory(meetingsDir(projectId));
    const files = entries.filter((e) => e.type === "file" && e.name.endsWith(".json"));
    for (const entry of files) {
      const meetingId = entry.name.replace(".json", "");
      if (this.active.has(meetingId)) continue;
      const remote = await this.readFromGitHub(projectId, meetingId);
      if (remote) allDocs.push(...remote.documents);
    }

    return allDocs.sort((a, b) => a.created_at - b.created_at);
  }

  async deleteDocument(id: string): Promise<void> {
    const agg = this.resolveMeetingForSubEntity(id);
    if (!agg) return;
    agg.documents = agg.documents.filter((d) => d.id !== id);
    this.subEntityIndex.delete(id);
  }

  async getGuidanceItems(meetingId: string): Promise<GuidanceItem[]> {
    const agg = await this.resolveAggregate(meetingId);
    if (!agg) return [];
    return agg.guidance;
  }

  async insertGuidanceItems(
    meetingId: string,
    items: Array<{ type: "question" | "suggestion"; content: string }>,
  ): Promise<GuidanceItem[]> {
    if (items.length === 0) return [];
    const agg = await this.activateFromGitHub(meetingId);
    if (!agg) throw new Error(`No active meeting: ${meetingId}`);
    const now = Date.now();
    const newItems: GuidanceItem[] = items.map((item) => ({
      id: randomUUID(),
      type: item.type,
      content: item.content,
      resolved: false,
      createdAt: now,
    }));
    agg.guidance.push(...newItems);
    for (const g of newItems) this.subEntityIndex.set(g.id, meetingId);
    return newItems;
  }

  async resolveGuidanceItem(id: string): Promise<void> {
    const agg = this.resolveMeetingForSubEntity(id);
    if (!agg) return;
    const item = agg.guidance.find((g) => g.id === id);
    if (item) item.resolved = true;
  }

  async unresolveGuidanceItem(id: string): Promise<void> {
    const agg = this.resolveMeetingForSubEntity(id);
    if (!agg) return;
    const item = agg.guidance.find((g) => g.id === id);
    if (item) item.resolved = false;
  }
}
