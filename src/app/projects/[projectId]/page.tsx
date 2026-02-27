"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArtefactTabs } from "../../../components/ArtefactTabs";
import { ConfirmModal } from "../../../components/ConfirmModal";
import type { MeetingArtefacts, ArtefactState, DiagramState } from "../../../lib/use-meeting";
import type { DocumentEntry } from "../../../lib/socket-client";

interface Meeting {
  id: string;
  started_at: number;
  ended_at: number | null;
  status: string;
}

interface ProjectData {
  id: string;
  name: string;
  artefacts: Record<string, string>;
  documents: DocumentEntry[];
}

function toReadOnlyArtefacts(raw: Record<string, string>): MeetingArtefacts {
  const empty: ArtefactState = { content: "", updating: false, pendingContent: "" };
  const diagrams: Record<string, DiagramState> = {};

  for (const [type, content] of Object.entries(raw)) {
    if (type.startsWith("diagram:")) {
      const subType = type.slice("diagram:".length);
      diagrams[subType] = {
        content,
        updating: false,
        pendingContent: "",
        label: subType.split(/[-_\s]+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
        renderer: content.trimStart().startsWith("<") || content.includes("<!DOCTYPE") || content.trimStart().startsWith("```html") ? "html" : "mermaid",
      };
    }
  }

  return {
    spec: raw.spec ? { content: raw.spec, updating: false, pendingContent: "" } : { ...empty },
    stories: raw.stories ? { content: raw.stories, updating: false, pendingContent: "" } : { ...empty },
    diagrams,
    diagramsUpdating: false,
    diagramsError: null,
  };
}

function formatDuration(startMs: number, endMs: number | null): string {
  const end = endMs ?? Date.now();
  const mins = Math.floor((end - startMs) / 60_000);
  if (mins < 1) return "< 1 min";
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400 ring-1 ring-emerald-500/20">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
        Active
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-zinc-800/50 px-2.5 py-0.5 text-[10px] font-medium text-zinc-500">
      Completed
    </span>
  );
}

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${projectId}`).then((r) => r.json()),
      fetch(`/api/projects/${projectId}/meetings`).then((r) => r.json()),
    ])
      .then(([proj, mtgs]) => {
        setProject(proj);
        setMeetings(mtgs);
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  const handleStartMeeting = async () => {
    setStarting(true);
    const res = await fetch(`/api/projects/${projectId}/meetings`, { method: "POST" });
    const meeting = await res.json();
    router.push(`/projects/${projectId}/meetings/${meeting.id}`);
  };

  const handleDeleteMeeting = async () => {
    if (!deleteTarget) return;
    await fetch(`/api/projects/${projectId}/meetings/${deleteTarget}`, { method: "DELETE" });
    setMeetings((prev) => prev.filter((m) => m.id !== deleteTarget));
    setDeleteTarget(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <header className="border-b border-zinc-800/50">
          <div className="mx-auto max-w-5xl px-6 py-4">
            <div className="h-6 w-48 animate-pulse rounded bg-zinc-800/50" />
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-10">
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-zinc-900/30" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-red-400">Project not found</p>
      </div>
    );
  }

  const artefacts = toReadOnlyArtefacts(project.artefacts);
  const hasArtefacts = Object.keys(project.artefacts).length > 0;

  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-800/50">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 text-sm">
            <Link href="/" className="text-zinc-500 transition-colors hover:text-zinc-300">
              Projects
            </Link>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-700">
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <span className="font-medium text-zinc-200">{project.name}</span>
          </div>
          <button
            onClick={handleStartMeeting}
            disabled={starting}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-indigo-500 disabled:opacity-40"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" />
            </svg>
            {starting ? "Starting..." : "New Meeting"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {hasArtefacts && (
          <div className="mb-10">
            <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
              </svg>
              Generated Artefacts
            </h2>
            <div className="h-[500px] overflow-hidden rounded-xl border border-zinc-800/50 bg-zinc-950">
              <ArtefactTabs artefacts={artefacts} documents={project.documents} />
            </div>
          </div>
        )}

        <div>
          <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Meetings
          </h2>

          {meetings.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 py-16">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-2 text-zinc-700">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
              <p className="text-xs text-zinc-600">No meetings yet. Start one above.</p>
            </div>
          )}

          <div className="space-y-2">
            {meetings.map((meeting) => (
              <div
                key={meeting.id}
                className="group flex items-center justify-between rounded-xl border border-zinc-800/50 bg-zinc-900/20 px-5 py-4 transition-all hover:border-zinc-700/50 hover:bg-zinc-900/40"
              >
                <Link
                  href={`/projects/${projectId}/meetings/${meeting.id}`}
                  className="flex flex-1 items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-200">
                      {new Date(meeting.started_at).toLocaleDateString("en-GB", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-600">
                      Duration: {formatDuration(meeting.started_at, meeting.ended_at)}
                    </p>
                  </div>
                  <StatusBadge status={meeting.status} />
                </Link>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(meeting.id);
                  }}
                  className="ml-4 rounded-md p-1.5 text-zinc-700 opacity-0 transition-all hover:bg-zinc-800 hover:text-red-400 group-hover:opacity-100"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      </main>

      <ConfirmModal
        open={deleteTarget !== null}
        title="Delete meeting"
        message="This will permanently delete the meeting and its transcripts."
        onConfirm={handleDeleteMeeting}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
