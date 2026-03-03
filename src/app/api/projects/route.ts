import { NextResponse } from "next/server";
import { getProjectStore } from "../../../../server/plugins/registry";

export async function GET() {
  return NextResponse.json(await getProjectStore().listProjects());
}

export async function POST(request: Request) {
  const { name } = await request.json();
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  return NextResponse.json(await getProjectStore().createProject(name));
}
