import { randomUUID } from "crypto";
import prisma from "../../db/client";
import type { Meeting, TranscriptChunk, Document, GuidanceItem, MeetingStore } from "../types/meeting-store";

function toMeeting(r: { id: string; projectId: string; featureId: string | null; startedAt: bigint; endedAt: bigint | null; status: string }): Meeting {
  return {
    id: r.id,
    project_id: r.projectId,
    feature_id: r.featureId,
    started_at: r.startedAt as unknown as number,
    ended_at: r.endedAt as unknown as number | null,
    status: r.status as Meeting["status"],
  };
}

function toChunk(r: { id: bigint; meetingId: string; text: string; speaker: string | null; timestamp: bigint }): TranscriptChunk {
  return {
    id: String(r.id),
    meeting_id: r.meetingId,
    text: r.text,
    speaker: r.speaker,
    timestamp: r.timestamp as unknown as number,
  };
}

function toDocument(r: { id: string; meetingId: string; content: string; createdAt: bigint; name: string; docNumber: number }): Document {
  return {
    id: r.id,
    meeting_id: r.meetingId,
    content: r.content,
    created_at: r.createdAt as unknown as number,
    name: r.name,
    doc_number: r.docNumber,
  };
}

export class PrismaMeetingStore implements MeetingStore {
  async createMeeting(projectId: string, featureId?: string): Promise<Meeting> {
    const id = randomUUID();
    const started_at = Date.now();
    await prisma.meeting.create({
      data: { id, projectId, featureId: featureId ?? null, startedAt: started_at, status: "active" },
    });
    return { id, project_id: projectId, feature_id: featureId ?? null, started_at, ended_at: null, status: "active" };
  }

  async endMeeting(id: string): Promise<void> {
    await prisma.meeting.update({
      where: { id },
      data: { endedAt: Date.now(), status: "completed" },
    });
  }

  async getMeeting(id: string): Promise<Meeting | undefined> {
    const row = await prisma.meeting.findUnique({ where: { id } });
    if (!row) return undefined;
    return toMeeting(row);
  }

  async listMeetings(projectId: string): Promise<Meeting[]> {
    const rows = await prisma.meeting.findMany({
      where: { projectId },
      orderBy: { startedAt: "desc" },
    });
    return rows.map(toMeeting);
  }

  async deleteMeeting(id: string): Promise<void> {
    await prisma.meeting.delete({ where: { id } });
  }

  async insertChunk(meetingId: string, text: string, speaker: string | null, timestamp: number): Promise<TranscriptChunk> {
    const row = await prisma.transcriptChunk.create({
      data: { meetingId, text, speaker, timestamp },
    });
    return toChunk(row);
  }

  async getChunks(meetingId: string): Promise<TranscriptChunk[]> {
    const rows = await prisma.transcriptChunk.findMany({
      where: { meetingId },
      orderBy: { timestamp: "asc" },
    });
    return rows.map(toChunk);
  }

  async updateChunk(id: string, text: string): Promise<void> {
    await prisma.transcriptChunk.update({ where: { id: BigInt(id) }, data: { text } });
  }

  async deleteChunk(id: string): Promise<void> {
    await prisma.transcriptChunk.delete({ where: { id: BigInt(id) } });
  }

  async insertDocument(meetingId: string, content: string, name?: string): Promise<Document> {
    const id = randomUUID();
    const created_at = Date.now();

    const result = await prisma.document.aggregate({
      where: { meetingId },
      _max: { docNumber: true },
    });
    const next_num = (result._max.docNumber ?? 0) + 1;
    const docName = name?.trim() || `Doc ${next_num}`;

    await prisma.document.create({
      data: { id, meetingId, content, createdAt: created_at, name: docName, docNumber: next_num },
    });

    return { id, meeting_id: meetingId, content, created_at, name: docName, doc_number: next_num };
  }

  async getDocuments(meetingId: string): Promise<Document[]> {
    const rows = await prisma.document.findMany({
      where: { meetingId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toDocument);
  }

  async getDocumentsByProject(projectId: string): Promise<Document[]> {
    const rows = await prisma.document.findMany({
      where: { meeting: { projectId } },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toDocument);
  }

  async deleteDocument(id: string): Promise<void> {
    await prisma.document.delete({ where: { id } });
  }

  async getGuidanceItems(meetingId: string): Promise<GuidanceItem[]> {
    const rows = await prisma.guidanceItem.findMany({
      where: { meetingId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((r) => ({
      id: r.id,
      type: r.type as GuidanceItem["type"],
      content: r.content,
      resolved: r.resolved,
      createdAt: r.createdAt as unknown as number,
    }));
  }

  async insertGuidanceItems(
    meetingId: string,
    items: Array<{ type: "question" | "suggestion"; content: string }>,
  ): Promise<GuidanceItem[]> {
    if (items.length === 0) return [];

    const now = Date.now();
    const data = items.map((item) => ({
      id: randomUUID(),
      meetingId,
      type: item.type,
      content: item.content,
      resolved: false,
      createdAt: now,
    }));

    await prisma.guidanceItem.createMany({ data });

    return data.map((d) => ({
      id: d.id,
      type: d.type as GuidanceItem["type"],
      content: d.content,
      resolved: false,
      createdAt: now,
    }));
  }

  async resolveGuidanceItem(id: string): Promise<void> {
    await prisma.guidanceItem.update({ where: { id }, data: { resolved: true } });
  }

  async unresolveGuidanceItem(id: string): Promise<void> {
    await prisma.guidanceItem.update({ where: { id }, data: { resolved: false } });
  }
}
