import { getPool } from "../connection";

export interface TranscriptChunkRow {
  id: number;
  meeting_id: string;
  text: string;
  speaker: string | null;
  timestamp: number;
}

export async function insertChunk(meetingId: string, text: string, speaker: string | null, timestamp: number): Promise<TranscriptChunkRow> {
  const pool = getPool();
  const { rows } = await pool.query(
    "INSERT INTO transcript_chunks (meeting_id, text, speaker, timestamp) VALUES ($1, $2, $3, $4) RETURNING *",
    [meetingId, text, speaker, timestamp]
  );
  return rows[0];
}

export async function getChunks(meetingId: string): Promise<TranscriptChunkRow[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    "SELECT * FROM transcript_chunks WHERE meeting_id = $1 ORDER BY timestamp ASC",
    [meetingId]
  );
  return rows;
}

export async function updateChunk(id: number, text: string): Promise<void> {
  const pool = getPool();
  await pool.query("UPDATE transcript_chunks SET text = $1 WHERE id = $2", [text, id]);
}

export async function deleteChunk(id: number): Promise<void> {
  const pool = getPool();
  await pool.query("DELETE FROM transcript_chunks WHERE id = $1", [id]);
}
