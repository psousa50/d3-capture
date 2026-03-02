import { randomUUID } from "crypto";
import prisma from "../client";

export interface ArtefactRow {
  id: string;
  project_id: string;
  feature_id: string | null;
  type: string;
  name: string;
  content: string;
  updated_at: number;
}

function toRow(r: { id: string; projectId: string; featureId: string | null; type: string; name: string; content: string; updatedAt: bigint }): ArtefactRow {
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

export async function upsertArtefact(
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

export async function getProjectArtefacts(projectId: string): Promise<ArtefactRow[]> {
  const rows = await prisma.artefact.findMany({ where: { projectId, featureId: null } });
  return rows.map(toRow);
}

export async function getFeatureArtefacts(projectId: string, featureId: string): Promise<ArtefactRow[]> {
  const rows = await prisma.artefact.findMany({ where: { projectId, featureId } });
  return rows.map(toRow);
}

export async function getArtefacts(projectId: string): Promise<ArtefactRow[]> {
  const rows = await prisma.artefact.findMany({ where: { projectId } });
  return rows.map(toRow);
}

export async function getArtefactById(id: string): Promise<ArtefactRow | undefined> {
  const row = await prisma.artefact.findUnique({ where: { id } });
  if (!row) return undefined;
  return toRow(row);
}

export async function deleteArtefactById(id: string): Promise<void> {
  await prisma.artefact.delete({ where: { id } });
}

export async function deleteDiagramArtefacts(projectId: string, featureId: string | null = null): Promise<void> {
  await prisma.artefact.deleteMany({
    where: { projectId, featureId, type: { startsWith: "diagram:" } },
  });
}

export async function deleteArtefact(projectId: string, type: string, featureId: string | null = null): Promise<void> {
  await prisma.artefact.deleteMany({ where: { projectId, featureId, type } });
}

export async function getArtefact(projectId: string, type: string, featureId: string | null = null): Promise<ArtefactRow | undefined> {
  const row = await prisma.artefact.findFirst({ where: { projectId, featureId, type } });
  if (!row) return undefined;
  return toRow(row);
}
