import { NextResponse } from "next/server";
import { getProjectStore, getArtefactStore } from "../../../../../../../server/plugins/registry";

type Params = { params: Promise<{ projectId: string; featureId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { projectId, featureId } = await params;
  const feature = await getProjectStore().getFeature(featureId);
  if (!feature || feature.project_id !== projectId) {
    return NextResponse.json({ error: "Feature not found" }, { status: 404 });
  }

  const artefactRows = await getArtefactStore().getFeatureArtefacts(projectId, featureId);
  const artefactMap: Record<string, string> = {};
  for (const row of artefactRows) {
    artefactMap[row.type] = row.content;
  }

  return NextResponse.json({ ...feature, artefacts: artefactMap });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { featureId } = await params;
  const store = getProjectStore();
  const feature = await store.getFeature(featureId);
  if (!feature) {
    return NextResponse.json({ error: "Feature not found" }, { status: 404 });
  }

  await store.deleteFeature(featureId);
  return new NextResponse(null, { status: 204 });
}
