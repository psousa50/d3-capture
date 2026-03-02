import { randomUUID } from "crypto";
import { getPool } from "../connection";

const PROJECT_SCOPE = "__project__";

export interface ArtefactRow {
  id: string;
  project_id: string;
  feature_id: string;
  type: string;
  content: string;
  updated_at: number;
}

export async function upsertArtefact(
  projectId: string,
  type: string,
  content: string,
  featureId: string = PROJECT_SCOPE,
): Promise<void> {
  const pool = getPool();
  const now = Date.now();

  await pool.query(
    `INSERT INTO artefacts (id, project_id, feature_id, type, content, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT(project_id, feature_id, type) DO UPDATE SET content = EXCLUDED.content, updated_at = EXCLUDED.updated_at`,
    [randomUUID(), projectId, featureId, type, content, now],
  );
}

export async function getProjectArtefacts(projectId: string): Promise<ArtefactRow[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    "SELECT * FROM artefacts WHERE project_id = $1 AND feature_id = $2",
    [projectId, PROJECT_SCOPE],
  );
  return rows;
}

export async function getFeatureArtefacts(projectId: string, featureId: string): Promise<ArtefactRow[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    "SELECT * FROM artefacts WHERE project_id = $1 AND feature_id = $2",
    [projectId, featureId],
  );
  return rows;
}

export async function getArtefacts(projectId: string): Promise<ArtefactRow[]> {
  const pool = getPool();
  const { rows } = await pool.query("SELECT * FROM artefacts WHERE project_id = $1", [projectId]);
  return rows;
}

export async function deleteDiagramArtefacts(projectId: string, featureId: string = PROJECT_SCOPE): Promise<void> {
  const pool = getPool();
  await pool.query(
    "DELETE FROM artefacts WHERE project_id = $1 AND feature_id = $2 AND type LIKE 'diagram:%'",
    [projectId, featureId],
  );
}

export async function deleteArtefact(projectId: string, type: string, featureId: string = PROJECT_SCOPE): Promise<void> {
  const pool = getPool();
  await pool.query(
    "DELETE FROM artefacts WHERE project_id = $1 AND feature_id = $2 AND type = $3",
    [projectId, featureId, type],
  );
}

export interface FeatureDiagramRow {
  feature_id: string;
  feature_name: string;
  type: string;
  content: string;
}

export async function getFeatureDiagramsByType(
  projectId: string,
  diagramType: string,
): Promise<FeatureDiagramRow[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT a.feature_id, f.name AS feature_name, a.type, a.content
     FROM artefacts a
     JOIN features f ON a.feature_id = f.id
     WHERE a.project_id = $1
       AND a.type = $2
       AND a.feature_id != $3`,
    [projectId, diagramType, PROJECT_SCOPE],
  );
  return rows;
}

export async function getArtefact(projectId: string, type: string, featureId: string = PROJECT_SCOPE): Promise<ArtefactRow | undefined> {
  const pool = getPool();
  const { rows } = await pool.query(
    "SELECT * FROM artefacts WHERE project_id = $1 AND feature_id = $2 AND type = $3",
    [projectId, featureId, type],
  );
  return rows[0];
}
