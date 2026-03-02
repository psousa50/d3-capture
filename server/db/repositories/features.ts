import { randomUUID } from "crypto";
import prisma from "../client";

export interface Feature {
  id: string;
  project_id: string;
  name: string;
  created_at: number;
}

export async function createFeature(projectId: string, name: string): Promise<Feature> {
  const id = randomUUID();
  const created_at = Date.now();

  await prisma.feature.create({ data: { id, projectId, name, createdAt: created_at } });

  return { id, project_id: projectId, name, created_at };
}

export async function listFeatures(projectId: string): Promise<Feature[]> {
  const rows = await prisma.feature.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({ id: r.id, project_id: r.projectId, name: r.name, created_at: Number(r.createdAt) }));
}

export async function getFeature(id: string): Promise<Feature | undefined> {
  const row = await prisma.feature.findUnique({ where: { id } });
  if (!row) return undefined;
  return { id: row.id, project_id: row.projectId, name: row.name, created_at: Number(row.createdAt) };
}

export async function deleteFeature(id: string): Promise<void> {
  await prisma.feature.delete({ where: { id } });
}
