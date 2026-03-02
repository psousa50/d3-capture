export interface Artefact {
  id: string;
  project_id: string;
  feature_id: string | null;
  type: string;
  name: string;
  content: string;
  updated_at: number;
}

export interface ArtefactStore {
  upsertArtefact(projectId: string, type: string, content: string, featureId?: string | null, name?: string): Promise<string>;
  getProjectArtefacts(projectId: string): Promise<Artefact[]>;
  getFeatureArtefacts(projectId: string, featureId: string): Promise<Artefact[]>;
  getArtefacts(projectId: string): Promise<Artefact[]>;
  getArtefactById(id: string): Promise<Artefact | undefined>;
  deleteArtefactById(id: string): Promise<void>;
  deleteDiagramArtefacts(projectId: string, featureId?: string | null): Promise<void>;
  deleteArtefact(projectId: string, type: string, featureId?: string | null): Promise<void>;
  getArtefact(projectId: string, type: string, featureId?: string | null): Promise<Artefact | undefined>;
}
