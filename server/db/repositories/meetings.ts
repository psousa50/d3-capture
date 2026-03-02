import { randomUUID } from "crypto";
import prisma from "../client";

export interface Meeting {
  id: string;
  project_id: string;
  feature_id: string | null;
  started_at: number;
  ended_at: number | null;
  status: "active" | "completed";
}

function toMeeting(r: { id: string; projectId: string; featureId: string | null; startedAt: bigint; endedAt: bigint | null; status: string }): Meeting {
  return {
    id: r.id,
    project_id: r.projectId,
    feature_id: r.featureId,
    started_at: r.startedAt as unknown as number,
    ended_at: r.endedAt as unknown as number | null,
    status: r.status as Meeting["status"],
  };
}

export async function createMeeting(projectId: string, featureId?: string): Promise<Meeting> {
  const id = randomUUID();
  const started_at = Date.now();

  await prisma.meeting.create({
    data: { id, projectId, featureId: featureId ?? null, startedAt: started_at, status: "active" },
  });

  return { id, project_id: projectId, feature_id: featureId ?? null, started_at, ended_at: null, status: "active" };
}

export async function endMeeting(id: string): Promise<void> {
  await prisma.meeting.update({
    where: { id },
    data: { endedAt: Date.now(), status: "completed" },
  });
}

export async function getMeeting(id: string): Promise<Meeting | undefined> {
  const row = await prisma.meeting.findUnique({ where: { id } });
  if (!row) return undefined;
  return toMeeting(row);
}

export async function listMeetings(projectId: string): Promise<Meeting[]> {
  const rows = await prisma.meeting.findMany({
    where: { projectId },
    orderBy: { startedAt: "desc" },
  });
  return rows.map(toMeeting);
}

export async function deleteMeeting(id: string): Promise<void> {
  await prisma.meeting.delete({ where: { id } });
}
