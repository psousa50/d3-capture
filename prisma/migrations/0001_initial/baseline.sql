-- Transforms the existing database to match the Prisma schema.
-- Run this BEFORE marking 0001_initial as applied.
-- Safe to run on a fresh database (all operations are idempotent).

BEGIN;

-- 1. Fix artefacts.feature_id: make nullable first, then replace sentinel with NULL
ALTER TABLE artefacts ALTER COLUMN feature_id DROP NOT NULL;
ALTER TABLE artefacts ALTER COLUMN feature_id DROP DEFAULT;
UPDATE artefacts SET feature_id = NULL WHERE feature_id = '__project__';

-- 2. Replace FK constraints with CASCADE versions
-- (inline REFERENCES creates constraints without CASCADE by default)

-- features.project_id
ALTER TABLE features DROP CONSTRAINT IF EXISTS features_project_id_fkey;
ALTER TABLE features ADD CONSTRAINT features_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- meetings.project_id
ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_project_id_fkey;
ALTER TABLE meetings ADD CONSTRAINT meetings_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- meetings.feature_id
ALTER TABLE meetings DROP CONSTRAINT IF EXISTS meetings_feature_id_fkey;
ALTER TABLE meetings ADD CONSTRAINT meetings_feature_id_fkey
  FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- transcript_chunks.meeting_id
ALTER TABLE transcript_chunks DROP CONSTRAINT IF EXISTS transcript_chunks_meeting_id_fkey;
ALTER TABLE transcript_chunks ADD CONSTRAINT transcript_chunks_meeting_id_fkey
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- artefacts.project_id
ALTER TABLE artefacts DROP CONSTRAINT IF EXISTS artefacts_project_id_fkey;
ALTER TABLE artefacts ADD CONSTRAINT artefacts_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- artefacts.feature_id (new FK — didn't exist before)
ALTER TABLE artefacts DROP CONSTRAINT IF EXISTS artefacts_feature_id_fkey;
ALTER TABLE artefacts ADD CONSTRAINT artefacts_feature_id_fkey
  FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- documents.meeting_id
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_meeting_id_fkey;
ALTER TABLE documents ADD CONSTRAINT documents_meeting_id_fkey
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- guidance_items.meeting_id (already CASCADE, but ensure constraint name and actions match)
ALTER TABLE guidance_items DROP CONSTRAINT IF EXISTS guidance_items_meeting_id_fkey;
ALTER TABLE guidance_items ADD CONSTRAINT guidance_items_meeting_id_fkey
  FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Recreate unique index with NULLS NOT DISTINCT
DROP INDEX IF EXISTS idx_artefacts_scope_type;
CREATE UNIQUE INDEX idx_artefacts_scope_type ON artefacts(project_id, feature_id, type) NULLS NOT DISTINCT;

COMMIT;
