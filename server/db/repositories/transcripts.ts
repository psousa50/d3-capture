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

export function updateChunk(id: number, text: string) {
  const db = getDb();
  db.prepare("UPDATE transcript_chunks SET text = ? WHERE id = ?").run(text, id);
}

export function deleteChunk(id: number) {
  const db = getDb();
  db.prepare("DELETE FROM transcript_chunks WHERE id = ?").run(id);
}
