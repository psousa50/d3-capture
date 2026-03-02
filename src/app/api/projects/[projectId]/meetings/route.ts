import { NextResponse } from "next/server";
import type { ProjectStore } from "../../../../../../server/plugins/types/project-store";
import type { MeetingStore } from "../../../../../../server/plugins/types/meeting-store";
import { getMeetingStore, getProjectStore } from "../../../../../../server/plugins/registry";

type Params = { params: Promise<{ projectId: string }> };

export function makeGET(store: MeetingStore) {
  return async (_request: Request, { params }: Params) => {
    const { projectId } = await params;
    return NextResponse.json(await store.listMeetings(projectId));
  };
}

export function makePOST(projects: ProjectStore, meetings: MeetingStore) {
  return async (request: Request, { params }: Params) => {
    const { projectId } = await params;
    const project = await projects.getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    let featureId: string | undefined;
    try {
      const body = await request.json();
      featureId = body?.featureId;
    } catch {}

    return NextResponse.json(await meetings.createMeeting(projectId, featureId));
  };
}

export const GET = makeGET(getMeetingStore());
export const POST = makePOST(getProjectStore(), getMeetingStore());
