import { NextResponse } from "next/server";
import type { ProjectStore } from "../../../../../server/plugins/types/project-store";
import type { ArtefactStore } from "../../../../../server/plugins/types/artefact-store";
import type { MeetingStore } from "../../../../../server/plugins/types/meeting-store";
import { getProjectStore, getArtefactStore, getMeetingStore } from "../../../../../server/plugins/registry";

type Params = { params: Promise<{ projectId: string }> };

export function makeGET(projects: ProjectStore, artefacts: ArtefactStore, meetings: MeetingStore) {
  return async (_request: Request, { params }: Params) => {
    const { projectId } = await params;
    const project = await projects.getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const [artefactRows, documents, features] = await Promise.all([
      artefacts.getProjectArtefacts(projectId),
      meetings.getDocumentsByProject(projectId),
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
  };
}

export function makeDELETE(store: ProjectStore) {
  return async (_request: Request, { params }: Params) => {
    const { projectId } = await params;
    const project = await store.getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await store.deleteProject(projectId);
    return new NextResponse(null, { status: 204 });
  };
}

export const GET = makeGET(getProjectStore(), getArtefactStore(), getMeetingStore());
export const DELETE = makeDELETE(getProjectStore());
