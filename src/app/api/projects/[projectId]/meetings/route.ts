import { NextResponse } from "next/server";
import { createMeeting, listMeetings } from "../../../../../../server/db/repositories/meetings";
import { getProject } from "../../../../../../server/db/repositories/projects";

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return NextResponse.json(listMeetings(projectId));
}

export async function POST(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = getProject(projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  return NextResponse.json(createMeeting(projectId));
}
