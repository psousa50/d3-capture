import { randomUUID } from "crypto";
import { getPool } from "../connection";

export interface DocumentRow {
  id: string;
  meeting_id: string;
  content: string;
  created_at: number;
  name: string;
  doc_number: number;
}

export async function insertDocument(meetingId: string, content: string, name?: string): Promise<DocumentRow> {
  const pool = getPool();
  const id = randomUUID();
  const created_at = Date.now();

  const { rows: [{ next_num }] } = await pool.query<{ next_num: number }>(
    "SELECT COALESCE(MAX(doc_number), 0) + 1 AS next_num FROM documents WHERE meeting_id = $1",
    [meetingId]
  );

  const docName = name?.trim() || `Doc ${next_num}`;

  await pool.query(
    "INSERT INTO documents (id, meeting_id, content, created_at, name, doc_number) VALUES ($1, $2, $3, $4, $5, $6)",
    [id, meetingId, content, created_at, docName, next_num]
  );

  return { id, meeting_id: meetingId, content, created_at, name: docName, doc_number: next_num };
}

export async function getDocuments(meetingId: string): Promise<DocumentRow[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    "SELECT * FROM documents WHERE meeting_id = $1 ORDER BY created_at ASC",
    [meetingId]
  );
  return rows;
}

export async function getDocumentsByProject(projectId: string): Promise<DocumentRow[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT d.* FROM documents d
     JOIN meetings m ON d.meeting_id = m.id
     WHERE m.project_id = $1
     ORDER BY d.created_at ASC`,
    [projectId]
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
