import { randomUUID } from "crypto";
import { getPool } from "../connection";

export interface GuidanceItem {
  id: string;
  type: "question" | "suggestion";
  content: string;
  resolved: boolean;
  createdAt: number;
}

interface GuidanceRow {
  id: string;
  meeting_id: string;
  type: string;
  content: string;
  resolved: boolean;
  created_at: number;
}

function toItem(row: GuidanceRow): GuidanceItem {
  return {
    id: row.id,
    type: row.type as GuidanceItem["type"],
    content: row.content,
    resolved: row.resolved,
    createdAt: row.created_at,
  };
}

export async function getGuidanceItems(meetingId: string): Promise<GuidanceItem[]> {
  const pool = getPool();
  const { rows } = await pool.query<GuidanceRow>(
    "SELECT * FROM guidance_items WHERE meeting_id = $1 ORDER BY created_at ASC",
    [meetingId],
  );
  return rows.map(toItem);
}

export async function insertGuidanceItems(
  meetingId: string,
  items: Array<{ type: "question" | "suggestion"; content: string }>,
): Promise<GuidanceItem[]> {
  if (items.length === 0) return [];

  const pool = getPool();
  const now = Date.now();
  const inserted: GuidanceItem[] = [];

  for (const item of items) {
    const id = randomUUID();
    await pool.query(
      "INSERT INTO guidance_items (id, meeting_id, type, content, resolved, created_at) VALUES ($1, $2, $3, $4, FALSE, $5)",
      [id, meetingId, item.type, item.content, now],
    );
    inserted.push({ id, type: item.type, content: item.content, resolved: false, createdAt: now });
  }

  return inserted;
}

export async function resolveGuidanceItem(id: string): Promise<void> {
  const pool = getPool();
  await pool.query("UPDATE guidance_items SET resolved = TRUE WHERE id = $1", [id]);
}

export async function unresolveGuidanceItem(id: string): Promise<void> {
  const pool = getPool();
  await pool.query("UPDATE guidance_items SET resolved = FALSE WHERE id = $1", [id]);
}
