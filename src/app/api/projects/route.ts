import { NextResponse } from "next/server";
import { listProjects, createProject } from "../../../../server/db/repositories/projects";

export async function GET() {
  return NextResponse.json(await listProjects());
}

export async function POST(request: Request) {
  const { name } = await request.json();
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  return NextResponse.json(await createProject(name));
}
