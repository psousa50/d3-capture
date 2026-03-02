export interface Project {
  id: string;
  name: string;
  created_at: number;
}

export interface Feature {
  id: string;
  project_id: string;
  name: string;
  created_at: number;
}

export interface ProjectStore {
  createProject(name: string): Promise<Project>;
  listProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  deleteProject(id: string): Promise<void>;
  createFeature(projectId: string, name: string): Promise<Feature>;
  listFeatures(projectId: string): Promise<Feature[]>;
  getFeature(id: string): Promise<Feature | undefined>;
  deleteFeature(id: string): Promise<void>;
}
