import { NextResponse } from "next/server";
import { getProjectStore, getArtefactStore, getMeetingStore } from "../../../../../server/plugins/registry";

type Params = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { projectId } = await params;
  const projects = getProjectStore();
  const project = await projects.getProject(projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const [artefactRows, documents, features] = await Promise.all([
    getArtefactStore().getProjectArtefacts(projectId),
    getMeetingStore().getDocumentsByProject(projectId),
    projects.listFeatures(projectId),
  ]);
  const artefactMap: Record<string, string> = {};
  for (const row of artefactRows) {
    artefactMap[row.type] = row.content;
  }

  return NextResponse.json({
    ...project,
    artefacts: artefactMap,
    documents: documents.map((d) => ({ id: d.id, content: d.content, createdAt: d.created_at, name: d.name, docNumber: d.doc_number })),
    features,
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { projectId } = await params;
  const store = getProjectStore();
  const project = await store.getProject(projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  await store.deleteProject(projectId);
  return new NextResponse(null, { status: 204 });
}
