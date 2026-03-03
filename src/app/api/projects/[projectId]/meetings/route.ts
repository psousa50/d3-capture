import { NextResponse } from "next/server";
import { getMeetingStore, getProjectStore } from "../../../../../../server/plugins/registry";

type Params = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { projectId } = await params;
  return NextResponse.json(await getMeetingStore().listMeetings(projectId));
}

export async function POST(request: Request, { params }: Params) {
  const { projectId } = await params;
  const project = await getProjectStore().getProject(projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  let featureId: string | undefined;
  try {
    const body = await request.json();
    featureId = body?.featureId;
  } catch {}

  return NextResponse.json(await getMeetingStore().createMeeting(projectId, featureId));
}
