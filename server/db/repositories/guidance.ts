import { randomUUID } from "crypto";
import prisma from "../client";

export interface GuidanceItem {
  id: string;
  type: "question" | "suggestion";
  content: string;
  resolved: boolean;
  createdAt: number;
}

export async function getGuidanceItems(meetingId: string): Promise<GuidanceItem[]> {
  const rows = await prisma.guidanceItem.findMany({
    where: { meetingId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type as GuidanceItem["type"],
    content: r.content,
    resolved: r.resolved,
    createdAt: r.createdAt as unknown as number,
  }));
}

export async function insertGuidanceItems(
  meetingId: string,
  items: Array<{ type: "question" | "suggestion"; content: string }>,
): Promise<GuidanceItem[]> {
  if (items.length === 0) return [];

  const now = Date.now();
  const data = items.map((item) => ({
    id: randomUUID(),
    meetingId,
    type: item.type,
    content: item.content,
    resolved: false,
    createdAt: now,
  }));

  await prisma.guidanceItem.createMany({ data });

  return data.map((d) => ({
    id: d.id,
    type: d.type as GuidanceItem["type"],
    content: d.content,
    resolved: false,
    createdAt: now,
  }));
}

export async function resolveGuidanceItem(id: string): Promise<void> {
  await prisma.guidanceItem.update({ where: { id }, data: { resolved: true } });
}

export async function unresolveGuidanceItem(id: string): Promise<void> {
  await prisma.guidanceItem.update({ where: { id }, data: { resolved: false } });
}
