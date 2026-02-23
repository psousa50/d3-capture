import { randomUUID } from "crypto";
import { getPool } from "../connection";

export interface Project {
  id: string;
  name: string;
  created_at: number;
}

export async function createProject(name: string): Promise<Project> {
  const pool = getPool();
  const id = randomUUID();
  const created_at = Date.now();

  await pool.query("INSERT INTO projects (id, name, created_at) VALUES ($1, $2, $3)", [id, name, created_at]);

  return { id, name, created_at };
}

export async function listProjects(): Promise<Project[]> {
  const pool = getPool();
  const { rows } = await pool.query("SELECT * FROM projects ORDER BY created_at DESC");
  return rows;
}

export async function getProject(id: string): Promise<Project | undefined> {
  const pool = getPool();
  const { rows } = await pool.query("SELECT * FROM projects WHERE id = $1", [id]);
  return rows[0];
}

export async function deleteProject(id: string): Promise<void> {
  const pool = getPool();
  const { rows: meetings } = await pool.query("SELECT id FROM meetings WHERE project_id = $1", [id]);

  for (const { id: mid } of meetings) {
    await pool.query("DELETE FROM transcript_chunks WHERE meeting_id = $1", [mid]);
    await pool.query("DELETE FROM documents WHERE meeting_id = $1", [mid]);
  }

  await pool.query("DELETE FROM meetings WHERE project_id = $1", [id]);
  await pool.query("DELETE FROM artefacts WHERE project_id = $1", [id]);
  await pool.query("DELETE FROM projects WHERE id = $1", [id]);
}
