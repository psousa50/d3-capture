import { NextResponse } from "next/server";
import { getMeetingStore } from "../../../../../../../server/plugins/registry";

type Params = { params: Promise<{ projectId: string; meetingId: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const { meetingId } = await params;
  const store = getMeetingStore();
  const meeting = await store.getMeeting(meetingId);
  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  await store.deleteMeeting(meetingId);
  return new NextResponse(null, { status: 204 });
}
