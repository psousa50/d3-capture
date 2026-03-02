import { NextResponse } from "next/server";
import type { ProjectStore } from "../../../../../../../server/plugins/types/project-store";
import type { ArtefactStore } from "../../../../../../../server/plugins/types/artefact-store";
import { getProjectStore, getArtefactStore } from "../../../../../../../server/plugins/registry";

type Params = { params: Promise<{ projectId: string; featureId: string }> };

export function makeGET(projects: ProjectStore, artefacts: ArtefactStore) {
  return async (_request: Request, { params }: Params) => {
    const { projectId, featureId } = await params;
    const feature = await projects.getFeature(featureId);
    if (!feature || feature.project_id !== projectId) {
      return NextResponse.json({ error: "Feature not found" }, { status: 404 });
    }

    const artefactRows = await artefacts.getFeatureArtefacts(projectId, featureId);
    const artefactMap: Record<string, string> = {};
    for (const row of artefactRows) {
      artefactMap[row.type] = row.content;
    }

    return NextResponse.json({ ...feature, artefacts: artefactMap });
  };
}

export function makeDELETE(store: ProjectStore) {
  return async (_request: Request, { params }: Params) => {
    const { featureId } = await params;
    const feature = await store.getFeature(featureId);
    if (!feature) {
      return NextResponse.json({ error: "Feature not found" }, { status: 404 });
    }

    await store.deleteFeature(featureId);
    return new NextResponse(null, { status: 204 });
  };
}

export const GET = makeGET(getProjectStore(), getArtefactStore());
export const DELETE = makeDELETE(getProjectStore());
