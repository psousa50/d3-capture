import { NextResponse } from "next/server";
import type { ProjectStore } from "../../../../server/plugins/types/project-store";
import { getProjectStore } from "../../../../server/plugins/registry";

export function makeGET(store: ProjectStore) {
  return async () => {
    return NextResponse.json(await store.listProjects());
  };
}

export function makePOST(store: ProjectStore) {
  return async (request: Request) => {
    const { name } = await request.json();
    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    return NextResponse.json(await store.createProject(name));
  };
}

export const GET = makeGET(getProjectStore());
export const POST = makePOST(getProjectStore());
