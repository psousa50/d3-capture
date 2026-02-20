import { randomUUID } from "crypto";
import { getDb } from "../connection";

export interface ArtefactRow {
  id: string;
  project_id: string;
  type: string;
  content: string;
  updated_at: number;
}

export function upsertArtefact(projectId: string, type: string, content: string) {
  const db = getDb();
  const now = Date.now();

  db.prepare(`
    INSERT INTO artefacts (id, project_id, type, content, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(project_id, type) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at
  `).run(randomUUID(), projectId, type, content, now);
}

export function getArtefacts(projectId: string): ArtefactRow[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM artefacts WHERE project_id = ?")
    .all(projectId) as ArtefactRow[];
}

export function getArtefact(projectId: string, type: string): ArtefactRow | undefined {
  const db = getDb();
  return db
    .prepare("SELECT * FROM artefacts WHERE project_id = ? AND type = ?")
    .get(projectId, type) as ArtefactRow | undefined;
}
