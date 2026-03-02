import { randomUUID } from "crypto";
import { getPool } from "../connection";

export interface Feature {
  id: string;
  project_id: string;
  name: string;
  created_at: number;
}

export async function createFeature(projectId: string, name: string): Promise<Feature> {
  const pool = getPool();
  const id = randomUUID();
  const created_at = Date.now();

  await pool.query(
    "INSERT INTO features (id, project_id, name, created_at) VALUES ($1, $2, $3, $4)",
    [id, projectId, name, created_at]
  );

  return { id, project_id: projectId, name, created_at };
}

export async function listFeatures(projectId: string): Promise<Feature[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    "SELECT * FROM features WHERE project_id = $1 ORDER BY created_at ASC",
    [projectId]
  );
  return rows;
}

export async function getFeature(id: string): Promise<Feature | undefined> {
  const pool = getPool();
  const { rows } = await pool.query("SELECT * FROM features WHERE id = $1", [id]);
  return rows[0];
}

export async function deleteFeature(id: string): Promise<void> {
  const pool = getPool();
  await pool.query("DELETE FROM artefacts WHERE feature_id = $1", [id]);

  const { rows: meetings } = await pool.query("SELECT id FROM meetings WHERE feature_id = $1", [id]);
  for (const meeting of meetings) {
    await pool.query("DELETE FROM transcript_chunks WHERE meeting_id = $1", [meeting.id]);
    await pool.query("DELETE FROM documents WHERE meeting_id = $1", [meeting.id]);
  }
  await pool.query("DELETE FROM meetings WHERE feature_id = $1", [id]);

  await pool.query("DELETE FROM features WHERE id = $1", [id]);
}
