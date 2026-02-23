import { randomUUID } from "crypto";
import { getPool } from "../connection";

export interface Meeting {
  id: string;
  project_id: string;
  started_at: number;
  ended_at: number | null;
  status: "active" | "completed";
}

export async function createMeeting(projectId: string): Promise<Meeting> {
  const pool = getPool();
  const id = randomUUID();
  const started_at = Date.now();

  await pool.query(
    "INSERT INTO meetings (id, project_id, started_at, status) VALUES ($1, $2, $3, 'active')",
    [id, projectId, started_at]
  );

  return { id, project_id: projectId, started_at, ended_at: null, status: "active" };
}

export async function endMeeting(id: string): Promise<void> {
  const pool = getPool();
  await pool.query("UPDATE meetings SET ended_at = $1, status = 'completed' WHERE id = $2", [
    Date.now(),
    id,
  ]);
}

export async function getMeeting(id: string): Promise<Meeting | undefined> {
  const pool = getPool();
  const { rows } = await pool.query("SELECT * FROM meetings WHERE id = $1", [id]);
  return rows[0];
}

export async function listMeetings(projectId: string): Promise<Meeting[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    "SELECT * FROM meetings WHERE project_id = $1 ORDER BY started_at DESC",
    [projectId]
  );
  return rows;
}

export async function deleteMeeting(id: string): Promise<void> {
  const pool = getPool();
  await pool.query("DELETE FROM transcript_chunks WHERE meeting_id = $1", [id]);
  await pool.query("DELETE FROM documents WHERE meeting_id = $1", [id]);
  await pool.query("DELETE FROM meetings WHERE id = $1", [id]);
}
