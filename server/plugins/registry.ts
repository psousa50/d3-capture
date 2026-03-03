import type { ProjectStore } from "./types/project-store";
import type { MeetingStore } from "./types/meeting-store";
import type { ArtefactStore } from "./types/artefact-store";
import type { TemplateStore } from "./types/template-store";
import { PrismaProjectStore } from "./prisma/project-store";
import { PrismaMeetingStore } from "./prisma/meeting-store";
import { PrismaArtefactStore } from "./prisma/artefact-store";
import { FilesystemTemplateStore } from "./filesystem/template-store";
import { GitHubMeetingStore } from "./github/meeting-store";
import { GitHubArtefactStore } from "./github/artefact-store";
import { GitHubTemplateStore } from "./github/template-store";

let projectStore: ProjectStore | null = null;
let meetingStore: MeetingStore | null = null;
let artefactStore: ArtefactStore | null = null;
let templateStore: TemplateStore | null = null;
let initialized = false;

function ensureStores() {
  if (initialized) return;
  initialized = true;

  const backend = process.env.STORAGE_BACKEND ?? "prisma";

  if (!projectStore) projectStore = new PrismaProjectStore();

  if (backend === "github") {
    if (!meetingStore) meetingStore = new GitHubMeetingStore();
    if (!artefactStore) artefactStore = new GitHubArtefactStore();
    if (!templateStore) templateStore = new GitHubTemplateStore(new FilesystemTemplateStore());
  } else {
    if (!meetingStore) meetingStore = new PrismaMeetingStore();
    if (!artefactStore) artefactStore = new PrismaArtefactStore();
    if (!templateStore) templateStore = new FilesystemTemplateStore();
  }
}

export function registerProjectStore(store: ProjectStore) {
  projectStore = store;
}

export function registerMeetingStore(store: MeetingStore) {
  meetingStore = store;
}

export function registerArtefactStore(store: ArtefactStore) {
  artefactStore = store;
}

export function registerTemplateStore(store: TemplateStore) {
  templateStore = store;
}

export function getProjectStore(): ProjectStore {
  ensureStores();
  return projectStore!;
}

export function getMeetingStore(): MeetingStore {
  ensureStores();
  return meetingStore!;
}

export function getArtefactStore(): ArtefactStore {
  ensureStores();
  return artefactStore!;
}

export function getTemplateStore(): TemplateStore {
  ensureStores();
  return templateStore!;
}
