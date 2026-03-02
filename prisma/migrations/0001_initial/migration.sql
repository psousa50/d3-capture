-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" BIGINT NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "features" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" BIGINT NOT NULL,

    CONSTRAINT "features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meetings" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "feature_id" TEXT,
    "started_at" BIGINT NOT NULL,
    "ended_at" BIGINT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "pending_transcript" TEXT,

    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcript_chunks" (
    "id" BIGSERIAL NOT NULL,
    "meeting_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "speaker" TEXT,
    "timestamp" BIGINT NOT NULL,

    CONSTRAINT "transcript_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artefacts" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "feature_id" TEXT,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "updated_at" BIGINT NOT NULL,

    CONSTRAINT "artefacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "meeting_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" BIGINT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "doc_number" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guidance_items" (
    "id" TEXT NOT NULL,
    "meeting_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" BIGINT NOT NULL,

    CONSTRAINT "guidance_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_features_project" ON "features"("project_id");

-- CreateIndex
CREATE INDEX "idx_meetings_project" ON "meetings"("project_id");

-- CreateIndex
CREATE INDEX "idx_transcript_meeting" ON "transcript_chunks"("meeting_id");

-- CreateIndex
CREATE INDEX "idx_artefacts_project" ON "artefacts"("project_id");

-- CreateIndex
CREATE INDEX "idx_artefacts_feature" ON "artefacts"("feature_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_artefacts_scope_type" ON "artefacts"("project_id", "feature_id", "type") NULLS NOT DISTINCT;

-- CreateIndex
CREATE INDEX "idx_documents_meeting" ON "documents"("meeting_id");

-- CreateIndex
CREATE INDEX "idx_guidance_meeting" ON "guidance_items"("meeting_id");

-- AddForeignKey
ALTER TABLE "features" ADD CONSTRAINT "features_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_feature_id_fkey" FOREIGN KEY ("feature_id") REFERENCES "features"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcript_chunks" ADD CONSTRAINT "transcript_chunks_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artefacts" ADD CONSTRAINT "artefacts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artefacts" ADD CONSTRAINT "artefacts_feature_id_fkey" FOREIGN KEY ("feature_id") REFERENCES "features"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guidance_items" ADD CONSTRAINT "guidance_items_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

