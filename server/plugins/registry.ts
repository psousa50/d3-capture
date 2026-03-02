import type { ProjectStore } from "./types/project-store";
import type { MeetingStore } from "./types/meeting-store";
import type { ArtefactStore } from "./types/artefact-store";
import type { TemplateStore } from "./types/template-store";

let projectStore: ProjectStore | null = null;
let meetingStore: MeetingStore | null = null;
let artefactStore: ArtefactStore | null = null;
let templateStore: TemplateStore | null = null;

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
  if (!projectStore) throw new Error("ProjectStore not registered");
  return projectStore;
}

export function getMeetingStore(): MeetingStore {
  if (!meetingStore) throw new Error("MeetingStore not registered");
  return meetingStore;
}

export function getArtefactStore(): ArtefactStore {
  if (!artefactStore) throw new Error("ArtefactStore not registered");
  return artefactStore;
}

export function getTemplateStore(): TemplateStore {
  if (!templateStore) throw new Error("TemplateStore not registered");
  return templateStore;
}
