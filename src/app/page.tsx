"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Project {
  id: string;
  name: string;
  created_at: number;
}

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then(setProjects)
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;

    setCreating(true);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const project = await res.json();
    setProjects((prev) => [project, ...prev]);
    setNewName("");
    setCreating(false);
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
      <p className="mt-2 text-zinc-400">
        Create a project to start capturing meetings and generating artefacts.
      </p>

      <form onSubmit={handleCreate} className="mt-8 flex gap-3">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New project name..."
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={creating || !newName.trim()}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
        >
          {creating ? "Creating..." : "Create Project"}
        </button>
      </form>

      <div className="mt-8 space-y-3">
        {loading && <p className="text-sm text-zinc-500">Loading...</p>}
        {!loading && projects.length === 0 && (
          <p className="text-sm text-zinc-500">No projects yet. Create one to get started.</p>
        )}
        {projects.map((project) => (
          <Link
            key={project.id}
            href={`/projects/${project.id}`}
            className="block rounded-lg border border-zinc-800 p-4 transition-colors hover:border-zinc-600 hover:bg-zinc-900/50"
          >
            <h2 className="font-medium text-zinc-200">{project.name}</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Created {new Date(project.created_at).toLocaleDateString()}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
