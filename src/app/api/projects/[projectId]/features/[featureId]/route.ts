import { NextResponse } from "next/server";
import { getFeature, deleteFeature } from "../../../../../../../server/db/repositories/features";
import { getFeatureArtefacts } from "../../../../../../../server/db/repositories/artefacts";

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string; featureId: string }> }) {
  const { projectId, featureId } = await params;
  const feature = await getFeature(featureId);
  if (!feature || feature.project_id !== projectId) {
    return NextResponse.json({ error: "Feature not found" }, { status: 404 });
  }

  const artefactRows = await getFeatureArtefacts(projectId, featureId);
  const artefacts: Record<string, string> = {};
  for (const row of artefactRows) {
    artefacts[row.type] = row.content;
  }

  return NextResponse.json({ ...feature, artefacts });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ projectId: string; featureId: string }> }) {
  const { featureId } = await params;
  const feature = await getFeature(featureId);
  if (!feature) {
    return NextResponse.json({ error: "Feature not found" }, { status: 404 });
  }

  await deleteFeature(featureId);
  return new NextResponse(null, { status: 204 });
}
