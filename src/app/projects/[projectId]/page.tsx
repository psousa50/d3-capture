"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArtefactTabs } from "../../../components/ArtefactTabs";
import type { MeetingArtefacts, ArtefactState, DiagramState } from "../../../lib/use-meeting";

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
        renderer: "mermaid",
      };
    }
  }

  return {
    spec: raw.spec ? { content: raw.spec, updating: false, pendingContent: "" } : { ...empty },
    stories: raw.stories ? { content: raw.stories, updating: false, pendingContent: "" } : { ...empty },
    diagrams,
    diagramsUpdating: false,
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

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

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

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-12">
        <p className="text-sm text-zinc-500">Loading...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-12">
        <p className="text-sm text-red-400">Project not found</p>
      </div>
    );
  }

  const artefacts = toReadOnlyArtefacts(project.artefacts);
  const hasArtefacts = Object.keys(project.artefacts).length > 0;

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300">
          Projects
        </Link>
        <span className="text-zinc-700">/</span>
        <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={handleStartMeeting}
          disabled={starting}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
        >
          {starting ? "Starting..." : "Start Meeting"}
        </button>
      </div>

      {hasArtefacts && (
        <div className="mt-8 h-[500px] overflow-hidden rounded-lg border border-zinc-800">
          <ArtefactTabs artefacts={artefacts} />
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-lg font-medium text-zinc-300">Meetings</h2>
        <div className="mt-4 space-y-2">
          {meetings.length === 0 && (
            <p className="text-sm text-zinc-500">No meetings yet.</p>
          )}
          {meetings.map((meeting) => (
            <Link
              key={meeting.id}
              href={`/projects/${projectId}/meetings/${meeting.id}`}
              className="flex items-center justify-between rounded-lg border border-zinc-800 px-4 py-3 transition-colors hover:border-zinc-600 hover:bg-zinc-900/50"
            >
              <div>
                <p className="text-sm text-zinc-200">
                  {new Date(meeting.started_at).toLocaleString()}
                </p>
                <p className="text-xs text-zinc-500">
                  {formatDuration(meeting.started_at, meeting.ended_at)}
                </p>
              </div>
              <span className={`text-xs font-medium ${meeting.status === "active" ? "text-green-400" : "text-zinc-500"}`}>
                {meeting.status === "active" ? "Active" : "Completed"}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
