import { randomUUID } from "crypto";
import prisma from "../../db/client";
import type { Artefact, ArtefactStore } from "../types/artefact-store";

function toArtefact(r: { id: string; projectId: string; featureId: string | null; type: string; name: string; content: string; updatedAt: bigint }): Artefact {
  return {
    id: r.id,
    project_id: r.projectId,
    feature_id: r.featureId,
    type: r.type,
    name: r.name,
    content: r.content,
    updated_at: r.updatedAt as unknown as number,
  };
}

export class PrismaArtefactStore implements ArtefactStore {
  async upsertArtefact(
    projectId: string,
    type: string,
    content: string,
    featureId: string | null = null,
    name: string = "",
  ): Promise<string> {
    const now = Date.now();

    const existing = await prisma.artefact.findFirst({
      where: { projectId, featureId, type },
      select: { id: true },
    });

    if (existing) {
      await prisma.artefact.update({
        where: { id: existing.id },
        data: { content, updatedAt: now, name },
      });
      return existing.id;
    }

    const id = randomUUID();
    await prisma.artefact.create({
      data: { id, projectId, featureId, type, content, updatedAt: now, name },
    });
    return id;
  }

  async getProjectArtefacts(projectId: string): Promise<Artefact[]> {
    const rows = await prisma.artefact.findMany({ where: { projectId, featureId: null } });
    return rows.map(toArtefact);
  }

  async getFeatureArtefacts(projectId: string, featureId: string): Promise<Artefact[]> {
    const rows = await prisma.artefact.findMany({ where: { projectId, featureId } });
    return rows.map(toArtefact);
  }

  async getArtefacts(projectId: string): Promise<Artefact[]> {
    const rows = await prisma.artefact.findMany({ where: { projectId } });
    return rows.map(toArtefact);
  }

  async getArtefactById(id: string): Promise<Artefact | undefined> {
    const row = await prisma.artefact.findUnique({ where: { id } });
    if (!row) return undefined;
    return toArtefact(row);
  }

  async deleteArtefactById(id: string): Promise<void> {
    await prisma.artefact.delete({ where: { id } });
  }

  async deleteDiagramArtefacts(projectId: string, featureId: string | null = null): Promise<void> {
    await prisma.artefact.deleteMany({
      where: { projectId, featureId, type: { startsWith: "diagram:" } },
    });
  }

  async deleteArtefact(projectId: string, type: string, featureId: string | null = null): Promise<void> {
    await prisma.artefact.deleteMany({ where: { projectId, featureId, type } });
  }

  async getArtefact(projectId: string, type: string, featureId: string | null = null): Promise<Artefact | undefined> {
    const row = await prisma.artefact.findFirst({ where: { projectId, featureId, type } });
    if (!row) return undefined;
    return toArtefact(row);
  }
}
