import { getDb } from "../connection";

export interface TranscriptChunkRow {
  id: number;
  meeting_id: string;
  text: string;
  speaker: string | null;
  timestamp: number;
}

export function insertChunk(meetingId: string, text: string, speaker: string | null, timestamp: number) {
  const db = getDb();
  db.prepare(
    "INSERT INTO transcript_chunks (meeting_id, text, speaker, timestamp) VALUES (?, ?, ?, ?)"
  ).run(meetingId, text, speaker, timestamp);
}

export function getChunks(meetingId: string): TranscriptChunkRow[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM transcript_chunks WHERE meeting_id = ? ORDER BY timestamp ASC")
    .all(meetingId) as TranscriptChunkRow[];
}
