import { randomUUID } from "crypto";
import { getDb } from "../connection";

export interface Meeting {
  id: string;
  project_id: string;
  started_at: number;
  ended_at: number | null;
  status: "active" | "completed";
}

export function createMeeting(projectId: string): Meeting {
  const db = getDb();
  const id = randomUUID();
  const started_at = Date.now();

  db.prepare(
    "INSERT INTO meetings (id, project_id, started_at, status) VALUES (?, ?, ?, 'active')"
  ).run(id, projectId, started_at);

  return { id, project_id: projectId, started_at, ended_at: null, status: "active" };
}

export function endMeeting(id: string) {
  const db = getDb();
  db.prepare("UPDATE meetings SET ended_at = ?, status = 'completed' WHERE id = ?").run(
    Date.now(),
    id
  );
}

export function getMeeting(id: string): Meeting | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM meetings WHERE id = ?").get(id) as Meeting | undefined;
}

export function listMeetings(projectId: string): Meeting[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM meetings WHERE project_id = ? ORDER BY started_at DESC")
    .all(projectId) as Meeting[];
}
