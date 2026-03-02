import { randomUUID } from "crypto";
import prisma from "../client";

export interface Project {
  id: string;
  name: string;
  created_at: number;
}

export async function createProject(name: string): Promise<Project> {
  const id = randomUUID();
  const created_at = Date.now();

  await prisma.project.create({ data: { id, name, createdAt: created_at } });

  return { id, name, created_at };
}

export async function listProjects(): Promise<Project[]> {
  const rows = await prisma.project.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map((r) => ({ id: r.id, name: r.name, created_at: Number(r.createdAt) }));
}

export async function getProject(id: string): Promise<Project | undefined> {
  const row = await prisma.project.findUnique({ where: { id } });
  if (!row) return undefined;
  return { id: row.id, name: row.name, created_at: Number(row.createdAt) };
}

export async function deleteProject(id: string): Promise<void> {
  await prisma.project.delete({ where: { id } });
}
