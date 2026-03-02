import { NextResponse } from "next/server";
import type { MeetingStore } from "../../../../../../../server/plugins/types/meeting-store";
import { getMeetingStore } from "../../../../../../../server/plugins/registry";

type Params = { params: Promise<{ projectId: string; meetingId: string }> };

export function makeDELETE(store: MeetingStore) {
  return async (_request: Request, { params }: Params) => {
    const { meetingId } = await params;
    const meeting = await store.getMeeting(meetingId);
    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    await store.deleteMeeting(meetingId);
    return new NextResponse(null, { status: 204 });
  };
}

export const DELETE = makeDELETE(getMeetingStore());
