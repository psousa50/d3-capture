import { NextResponse } from "next/server";
import { deleteMeeting, getMeeting } from "../../../../../../../server/db/repositories/meetings";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ projectId: string; meetingId: string }> }
) {
  const { meetingId } = await params;
  const meeting = await getMeeting(meetingId);
  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  await deleteMeeting(meetingId);
  return new NextResponse(null, { status: 204 });
}
