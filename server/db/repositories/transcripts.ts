import prisma from "../client";

export interface TranscriptChunkRow {
  id: number;
  meeting_id: string;
  text: string;
  speaker: string | null;
  timestamp: number;
}

function toChunk(r: { id: bigint; meetingId: string; text: string; speaker: string | null; timestamp: bigint }): TranscriptChunkRow {
  return {
    id: r.id as unknown as number,
    meeting_id: r.meetingId,
    text: r.text,
    speaker: r.speaker,
    timestamp: r.timestamp as unknown as number,
  };
}

export async function insertChunk(meetingId: string, text: string, speaker: string | null, timestamp: number): Promise<TranscriptChunkRow> {
  const row = await prisma.transcriptChunk.create({
    data: { meetingId, text, speaker, timestamp },
  });
  return toChunk(row);
}

export async function getChunks(meetingId: string): Promise<TranscriptChunkRow[]> {
  const rows = await prisma.transcriptChunk.findMany({
    where: { meetingId },
    orderBy: { timestamp: "asc" },
  });
  return rows.map(toChunk);
}

export async function updateChunk(id: number, text: string): Promise<void> {
  await prisma.transcriptChunk.update({ where: { id }, data: { text } });
}

export async function deleteChunk(id: number): Promise<void> {
  await prisma.transcriptChunk.delete({ where: { id } });
}
