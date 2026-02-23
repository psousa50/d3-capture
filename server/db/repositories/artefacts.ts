import { randomUUID } from "crypto";
import { getPool } from "../connection";

export interface ArtefactRow {
  id: string;
  project_id: string;
  type: string;
  content: string;
  updated_at: number;
}

export async function upsertArtefact(projectId: string, type: string, content: string): Promise<void> {
  const pool = getPool();
  const now = Date.now();

  await pool.query(
    `INSERT INTO artefacts (id, project_id, type, content, updated_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT(project_id, type) DO UPDATE SET content = EXCLUDED.content, updated_at = EXCLUDED.updated_at`,
    [randomUUID(), projectId, type, content, now]
  );
}

export async function getArtefacts(projectId: string): Promise<ArtefactRow[]> {
  const pool = getPool();
  const { rows } = await pool.query("SELECT * FROM artefacts WHERE project_id = $1", [projectId]);
  return rows;
}

export async function deleteDiagramArtefacts(projectId: string): Promise<void> {
  const pool = getPool();
  await pool.query("DELETE FROM artefacts WHERE project_id = $1 AND type LIKE 'diagram:%'", [projectId]);
}

export async function deleteArtefact(projectId: string, type: string): Promise<void> {
  const pool = getPool();
  await pool.query("DELETE FROM artefacts WHERE project_id = $1 AND type = $2", [projectId, type]);
}

export async function getArtefact(projectId: string, type: string): Promise<ArtefactRow | undefined> {
  const pool = getPool();
  const { rows } = await pool.query(
    "SELECT * FROM artefacts WHERE project_id = $1 AND type = $2",
    [projectId, type]
  );
  return rows[0];
}
