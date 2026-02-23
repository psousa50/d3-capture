import { randomUUID } from "crypto";
import { getPool } from "../connection";

export interface DocumentRow {
  id: string;
  meeting_id: string;
  content: string;
  created_at: number;
}

export async function insertDocument(meetingId: string, content: string): Promise<DocumentRow> {
  const pool = getPool();
  const id = randomUUID();
  const created_at = Date.now();

  await pool.query(
    "INSERT INTO documents (id, meeting_id, content, created_at) VALUES ($1, $2, $3, $4)",
    [id, meetingId, content, created_at]
  );

  return { id, meeting_id: meetingId, content, created_at };
}

export async function getDocuments(meetingId: string): Promise<DocumentRow[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    "SELECT * FROM documents WHERE meeting_id = $1 ORDER BY created_at ASC",
    [meetingId]
  );
  return rows;
}

export async function deleteDocument(id: string): Promise<void> {
  const pool = getPool();
  await pool.query("DELETE FROM documents WHERE id = $1", [id]);
}

export async function deleteDocumentsByMeeting(meetingId: string): Promise<void> {
  const pool = getPool();
  await pool.query("DELETE FROM documents WHERE meeting_id = $1", [meetingId]);
}
