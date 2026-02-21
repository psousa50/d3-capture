import { randomUUID } from "crypto";
import { getDb } from "../connection";

export interface DocumentRow {
  id: string;
  meeting_id: string;
  content: string;
  created_at: number;
}

export function insertDocument(meetingId: string, content: string): DocumentRow {
  const db = getDb();
  const id = randomUUID();
  const created_at = Date.now();

  db.prepare(
    "INSERT INTO documents (id, meeting_id, content, created_at) VALUES (?, ?, ?, ?)"
  ).run(id, meetingId, content, created_at);

  return { id, meeting_id: meetingId, content, created_at };
}

export function getDocuments(meetingId: string): DocumentRow[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM documents WHERE meeting_id = ? ORDER BY created_at ASC")
    .all(meetingId) as DocumentRow[];
}

export function deleteDocument(id: string) {
  const db = getDb();
  db.prepare("DELETE FROM documents WHERE id = ?").run(id);
}

export function deleteDocumentsByMeeting(meetingId: string) {
  const db = getDb();
  db.prepare("DELETE FROM documents WHERE meeting_id = ?").run(meetingId);
}
