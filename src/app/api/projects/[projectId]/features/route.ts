import { NextResponse } from "next/server";
import { getProject } from "../../../../../../server/db/repositories/projects";
import { createFeature, listFeatures } from "../../../../../../server/db/repositories/features";

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const features = await listFeatures(projectId);
  return NextResponse.json(features);
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body = await request.json();
  const name = body?.name;
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const feature = await createFeature(projectId, name.trim());
  return NextResponse.json(feature);
}
