import { NextResponse } from "next/server";
import { getProject, deleteProject } from "../../../../../server/db/repositories/projects";
import { getArtefacts } from "../../../../../server/db/repositories/artefacts";
import { getDocumentsByProject } from "../../../../../server/db/repositories/documents";

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const [artefacts, documents] = await Promise.all([
    getArtefacts(projectId),
    getDocumentsByProject(projectId),
  ]);
  const artefactMap: Record<string, string> = {};
  for (const row of artefacts) {
    artefactMap[row.type] = row.content;
  }

  return NextResponse.json({
    ...project,
    artefacts: artefactMap,
    documents: documents.map((d) => ({ id: d.id, content: d.content, createdAt: d.created_at })),
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
