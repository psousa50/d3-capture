import type { Pool } from "pg";

export async function migrate(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at BIGINT NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      started_at BIGINT NOT NULL,
      ended_at BIGINT,
      status TEXT NOT NULL DEFAULT 'active',
      pending_transcript TEXT
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS transcript_chunks (
      id BIGSERIAL PRIMARY KEY,
      meeting_id TEXT NOT NULL REFERENCES meetings(id),
      text TEXT NOT NULL,
      speaker TEXT,
      timestamp BIGINT NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS features (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      name TEXT NOT NULL,
      created_at BIGINT NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS artefacts (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      updated_at BIGINT NOT NULL,
      feature_id TEXT NOT NULL DEFAULT '__project__'
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL REFERENCES meetings(id),
      content TEXT NOT NULL,
      created_at BIGINT NOT NULL
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_meetings_project ON meetings(project_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_transcript_meeting ON transcript_chunks(meeting_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_artefacts_project ON artefacts(project_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_documents_meeting ON documents(meeting_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS guidance_items (
      id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      resolved BOOLEAN NOT NULL DEFAULT FALSE,
      created_at BIGINT NOT NULL
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_guidance_meeting ON guidance_items(meeting_id)`);

  await pool.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT ''`);
  await pool.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS doc_number INTEGER NOT NULL DEFAULT 0`);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_features_project ON features(project_id)`);
  await pool.query(`ALTER TABLE meetings ADD COLUMN IF NOT EXISTS feature_id TEXT REFERENCES features(id)`);
  await pool.query(`ALTER TABLE artefacts ADD COLUMN IF NOT EXISTS feature_id TEXT NOT NULL DEFAULT '__project__'`);
  await pool.query(`ALTER TABLE artefacts ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT ''`);

  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE artefacts DROP CONSTRAINT IF EXISTS artefacts_project_id_type_key;
    EXCEPTION WHEN undefined_object THEN NULL;
    END $$
  `);

  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_artefacts_scope_type ON artefacts(project_id, feature_id, type)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_artefacts_feature ON artefacts(feature_id)`);
}
