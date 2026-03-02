import { randomUUID } from "crypto";
import prisma from "../client";

export interface DocumentRow {
  id: string;
  meeting_id: string;
  content: string;
  created_at: number;
  name: string;
  doc_number: number;
}

function toRow(r: { id: string; meetingId: string; content: string; createdAt: bigint; name: string; docNumber: number }): DocumentRow {
  return {
    id: r.id,
    meeting_id: r.meetingId,
    content: r.content,
    created_at: r.createdAt as unknown as number,
    name: r.name,
    doc_number: r.docNumber,
  };
}

export async function insertDocument(meetingId: string, content: string, name?: string): Promise<DocumentRow> {
  const id = randomUUID();
  const created_at = Date.now();

  const result = await prisma.document.aggregate({
    where: { meetingId },
    _max: { docNumber: true },
  });
  const next_num = (result._max.docNumber ?? 0) + 1;
  const docName = name?.trim() || `Doc ${next_num}`;

  await prisma.document.create({
    data: { id, meetingId, content, createdAt: created_at, name: docName, docNumber: next_num },
  });

  return { id, meeting_id: meetingId, content, created_at, name: docName, doc_number: next_num };
}

export async function getDocuments(meetingId: string): Promise<DocumentRow[]> {
  const rows = await prisma.document.findMany({
    where: { meetingId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toRow);
}

export async function getDocumentsByProject(projectId: string): Promise<DocumentRow[]> {
  const rows = await prisma.document.findMany({
    where: { meeting: { projectId } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toRow);
}

export async function deleteDocument(id: string): Promise<void> {
  await prisma.document.delete({ where: { id } });
}
