export interface Meeting {
  id: string;
  project_id: string;
  feature_id: string | null;
  started_at: number;
  ended_at: number | null;
  status: "active" | "completed";
}

export interface TranscriptChunk {
  id: string;
  meeting_id: string;
  text: string;
  speaker: string | null;
  timestamp: number;
}

export interface Document {
  id: string;
  meeting_id: string;
  content: string;
  created_at: number;
  name: string;
  doc_number: number;
}

export interface GuidanceItem {
  id: string;
  type: "question" | "suggestion";
  content: string;
  resolved: boolean;
  createdAt: number;
}

export interface MeetingStore {
  createMeeting(projectId: string, featureId?: string): Promise<Meeting>;
  endMeeting(id: string): Promise<void>;
  getMeeting(id: string): Promise<Meeting | undefined>;
  listMeetings(projectId: string): Promise<Meeting[]>;
  deleteMeeting(id: string): Promise<void>;
  insertChunk(meetingId: string, text: string, speaker: string | null, timestamp: number): Promise<TranscriptChunk>;
  getChunks(meetingId: string): Promise<TranscriptChunk[]>;
  updateChunk(id: string, text: string): Promise<void>;
  deleteChunk(id: string): Promise<void>;
  insertDocument(meetingId: string, content: string, name?: string): Promise<Document>;
  getDocuments(meetingId: string): Promise<Document[]>;
  getDocumentsByProject(projectId: string): Promise<Document[]>;
  deleteDocument(id: string): Promise<void>;
  getGuidanceItems(meetingId: string): Promise<GuidanceItem[]>;
  insertGuidanceItems(meetingId: string, items: Array<{ type: "question" | "suggestion"; content: string }>): Promise<GuidanceItem[]>;
  resolveGuidanceItem(id: string): Promise<void>;
  unresolveGuidanceItem(id: string): Promise<void>;
}
