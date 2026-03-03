import { NextResponse } from "next/server";
import { getProjectStore } from "../../../../../../server/plugins/registry";

type Params = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { projectId } = await params;
  return NextResponse.json(await getProjectStore().listFeatures(projectId));
}

export async function POST(request: Request, { params }: Params) {
  const { projectId } = await params;
  const store = getProjectStore();
  const project = await store.getProject(projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body = await request.json();
  const name = body?.name;
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const feature = await store.createFeature(projectId, name.trim());
  return NextResponse.json(feature);
}
