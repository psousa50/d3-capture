import { randomUUID } from "crypto";
import prisma from "../../db/client";
import type { Project, Feature, ProjectStore } from "../types/project-store";

export class PrismaProjectStore implements ProjectStore {
  async createProject(name: string): Promise<Project> {
    const id = randomUUID();
    const created_at = Date.now();
    await prisma.project.create({ data: { id, name, createdAt: created_at } });
    return { id, name, created_at };
  }

  async listProjects(): Promise<Project[]> {
    const rows = await prisma.project.findMany({ orderBy: { createdAt: "desc" } });
    return rows.map((r) => ({ id: r.id, name: r.name, created_at: Number(r.createdAt) }));
  }

  async getProject(id: string): Promise<Project | undefined> {
    const row = await prisma.project.findUnique({ where: { id } });
    if (!row) return undefined;
    return { id: row.id, name: row.name, created_at: Number(row.createdAt) };
  }

  async deleteProject(id: string): Promise<void> {
    await prisma.project.delete({ where: { id } });
  }

  async createFeature(projectId: string, name: string): Promise<Feature> {
    const id = randomUUID();
    const created_at = Date.now();
    await prisma.feature.create({ data: { id, projectId, name, createdAt: created_at } });
    return { id, project_id: projectId, name, created_at };
  }

  async listFeatures(projectId: string): Promise<Feature[]> {
    const rows = await prisma.feature.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((r) => ({ id: r.id, project_id: r.projectId, name: r.name, created_at: Number(r.createdAt) }));
  }

  async getFeature(id: string): Promise<Feature | undefined> {
    const row = await prisma.feature.findUnique({ where: { id } });
    if (!row) return undefined;
    return { id: row.id, project_id: row.projectId, name: row.name, created_at: Number(row.createdAt) };
  }

  async deleteFeature(id: string): Promise<void> {
    await prisma.feature.delete({ where: { id } });
  }
}
