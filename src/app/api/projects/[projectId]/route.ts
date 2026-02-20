import { NextResponse } from "next/server";
import { getProject } from "../../../../../server/db/repositories/projects";
import { getArtefacts } from "../../../../../server/db/repositories/artefacts";

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = getProject(projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const artefacts = getArtefacts(projectId);
  const artefactMap: Record<string, string> = {};
  for (const row of artefacts) {
    artefactMap[row.type] = row.content;
  }

  return NextResponse.json({ ...project, artefacts: artefactMap });
}
