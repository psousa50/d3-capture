import { NextResponse } from "next/server";
import type { ProjectStore } from "../../../../../../server/plugins/types/project-store";
import { getProjectStore } from "../../../../../../server/plugins/registry";

type Params = { params: Promise<{ projectId: string }> };

export function makeGET(store: ProjectStore) {
  return async (_request: Request, { params }: Params) => {
    const { projectId } = await params;
    return NextResponse.json(await store.listFeatures(projectId));
  };
}

export function makePOST(store: ProjectStore) {
  return async (request: Request, { params }: Params) => {
    const { projectId } = await params;
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
  };
}

export const GET = makeGET(getProjectStore());
export const POST = makePOST(getProjectStore());
