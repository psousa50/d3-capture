import { randomUUID } from "crypto";
import type { Artefact, ArtefactStore } from "../types/artefact-store";
import { readFile, writeFile, deleteFile, listDirectory } from "./client";

function artefactPath(projectId: string, artefactId: string): string {
  return `projects/${projectId}/artefacts/${artefactId}.json`;
}

function artefactsDir(projectId: string): string {
  return `projects/${projectId}/artefacts`;
}

export class GitHubArtefactStore implements ArtefactStore {
  private projectCache = new Map<string, Artefact[]>();
  private reverseIndex = new Map<string, string>();

  private async loadProject(projectId: string): Promise<Artefact[]> {
    const cached = this.projectCache.get(projectId);
    if (cached) return cached;

    const entries = await listDirectory(artefactsDir(projectId));
    const files = entries.filter((e) => e.type === "file" && e.name.endsWith(".json"));
    const artefacts = await Promise.all(
      files.map(async (entry) => {
        const result = await readFile<Artefact>(entry.path);
        return result?.data;
      }),
    );
    const list = artefacts.filter((a): a is Artefact => a !== undefined);
    this.projectCache.set(projectId, list);
    for (const a of list) this.reverseIndex.set(a.id, a.project_id);
    return list;
  }

  private invalidateProject(projectId: string) {
    this.projectCache.delete(projectId);
  }

  private async findProjectForArtefact(artefactId: string): Promise<string | undefined> {
    const cached = this.reverseIndex.get(artefactId);
    if (cached) return cached;

    const projectEntries = await listDirectory("projects");
    for (const proj of projectEntries) {
      if (proj.type !== "dir") continue;
      await this.loadProject(proj.name);
      if (this.reverseIndex.has(artefactId)) return this.reverseIndex.get(artefactId);
    }
    return undefined;
  }

  async upsertArtefact(
    projectId: string,
    type: string,
    content: string,
    featureId: string | null = null,
    name: string = "",
  ): Promise<string> {
    const existing = await this.loadProject(projectId);
    const match = existing.find((a) => a.type === type && a.feature_id === featureId);

    if (match) {
      match.content = content;
      match.name = name;
      match.updated_at = Date.now();
      const path = artefactPath(projectId, match.id);
      await writeFile(path, JSON.stringify(match, null, 2), `update artefact ${type}`);
      this.invalidateProject(projectId);
      return match.id;
    }

    const id = randomUUID();
    const artefact: Artefact = {
      id,
      project_id: projectId,
      feature_id: featureId,
      type,
      name,
      content,
      updated_at: Date.now(),
    };
    const path = artefactPath(projectId, id);
    await writeFile(path, JSON.stringify(artefact, null, 2), `create artefact ${type}`);
    this.invalidateProject(projectId);
    return id;
  }

  async getProjectArtefacts(projectId: string): Promise<Artefact[]> {
    const all = await this.loadProject(projectId);
    return all.filter((a) => a.feature_id === null);
  }

  async getFeatureArtefacts(projectId: string, featureId: string): Promise<Artefact[]> {
    const all = await this.loadProject(projectId);
    return all.filter((a) => a.feature_id === featureId);
  }

  async getArtefacts(projectId: string): Promise<Artefact[]> {
    return this.loadProject(projectId);
  }

  async getArtefactById(id: string): Promise<Artefact | undefined> {
    const projectId = await this.findProjectForArtefact(id);
    if (!projectId) return undefined;
    const all = await this.loadProject(projectId);
    return all.find((a) => a.id === id);
  }

  async deleteArtefactById(id: string): Promise<void> {
    const projectId = await this.findProjectForArtefact(id);
    if (!projectId) return;
    const result = await readFile<Artefact>(artefactPath(projectId, id));
    if (!result) return;
    await deleteFile(artefactPath(projectId, id), result.sha, `delete artefact ${id}`);
    this.reverseIndex.delete(id);
    this.invalidateProject(projectId);
  }

  async deleteDiagramArtefacts(projectId: string, featureId: string | null = null): Promise<void> {
    const all = await this.loadProject(projectId);
    const diagrams = all.filter(
      (a) => a.type.startsWith("diagram:") && a.feature_id === featureId,
    );
    await Promise.all(
      diagrams.map(async (a) => {
        const result = await readFile<Artefact>(artefactPath(projectId, a.id));
        if (result) {
          await deleteFile(artefactPath(projectId, a.id), result.sha, `delete diagram ${a.id}`);
        }
      }),
    );
    this.invalidateProject(projectId);
  }

  async deleteArtefact(
    projectId: string,
    type: string,
    featureId: string | null = null,
  ): Promise<void> {
    const all = await this.loadProject(projectId);
    const match = all.find((a) => a.type === type && a.feature_id === featureId);
    if (!match) return;
    const result = await readFile<Artefact>(artefactPath(projectId, match.id));
    if (result) {
      await deleteFile(
        artefactPath(projectId, match.id),
        result.sha,
        `delete artefact ${type}`,
      );
    }
    this.invalidateProject(projectId);
  }

  async getArtefact(
    projectId: string,
    type: string,
    featureId: string | null = null,
  ): Promise<Artefact | undefined> {
    const all = await this.loadProject(projectId);
    return all.find((a) => a.type === type && a.feature_id === featureId);
  }
}
