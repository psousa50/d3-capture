import { NextResponse } from "next/server";
import { getProject, deleteProject } from "../../../../../server/db/repositories/projects";
import { getProjectArtefacts } from "../../../../../server/db/repositories/artefacts";
import { getDocumentsByProject } from "../../../../../server/db/repositories/documents";
import { listFeatures } from "../../../../../server/db/repositories/features";

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const [artefacts, documents, features] = await Promise.all([
    getProjectArtefacts(projectId),
    getDocumentsByProject(projectId),
    listFeatures(projectId),
  ]);
  const artefactMap: Record<string, string> = {};
  for (const row of artefacts) {
    artefactMap[row.type] = row.content;
  }

  return NextResponse.json({
    ...project,
    artefacts: artefactMap,
    documents: documents.map((d) => ({ id: d.id, content: d.content, createdAt: d.created_at, name: d.name, docNumber: d.doc_number })),
    features,
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  await deleteProject(projectId);
  return new NextResponse(null, { status: 204 });
}
