import { randomUUID } from "crypto";
import { getDb } from "../connection";

export interface Project {
  id: string;
  name: string;
  created_at: number;
}

export function createProject(name: string): Project {
  const db = getDb();
  const id = randomUUID();
  const created_at = Date.now();

  db.prepare("INSERT INTO projects (id, name, created_at) VALUES (?, ?, ?)").run(
    id,
    name,
    created_at
  );

  return { id, name, created_at };
}

export function listProjects(): Project[] {
  const db = getDb();
  return db.prepare("SELECT * FROM projects ORDER BY created_at DESC").all() as Project[];
}

export function getProject(id: string): Project | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as Project | undefined;
}
