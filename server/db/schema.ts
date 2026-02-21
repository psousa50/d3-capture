import type Database from "better-sqlite3";

export function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      status TEXT NOT NULL DEFAULT 'active',
      pending_transcript TEXT
    );

    CREATE TABLE IF NOT EXISTS transcript_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_id TEXT NOT NULL REFERENCES meetings(id),
      text TEXT NOT NULL,
      speaker TEXT,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS artefacts (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(project_id, type)
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL REFERENCES meetings(id),
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_meetings_project ON meetings(project_id);
    CREATE INDEX IF NOT EXISTS idx_transcript_meeting ON transcript_chunks(meeting_id);
    CREATE INDEX IF NOT EXISTS idx_artefacts_project ON artefacts(project_id);
    CREATE INDEX IF NOT EXISTS idx_documents_meeting ON documents(meeting_id);
  `);

  const columns = db.pragma("table_info(meetings)") as { name: string }[];
  if (!columns.some((c) => c.name === "pending_transcript")) {
    db.exec("ALTER TABLE meetings ADD COLUMN pending_transcript TEXT");
  }
}
