CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "ragContext" JSONB;

CREATE TABLE IF NOT EXISTS "KnowledgeBase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeBase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "KnowledgeDocument" (
    "id" TEXT NOT NULL,
    "knowledgeBaseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "size" INTEGER,
    "contentHash" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "errorMessage" TEXT,
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "KnowledgeChunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "knowledgeBaseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "heading" TEXT,
    "tokenCount" INTEGER,
    "metadata" JSONB,
    "embedding" vector(1024),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "KnowledgeBase_userId_updatedAt_idx" ON "KnowledgeBase"("userId", "updatedAt" DESC);

CREATE UNIQUE INDEX IF NOT EXISTS "KnowledgeDocument_knowledgeBaseId_contentHash_key"
ON "KnowledgeDocument"("knowledgeBaseId", "contentHash");
CREATE INDEX IF NOT EXISTS "KnowledgeDocument_knowledgeBaseId_createdAt_idx"
ON "KnowledgeDocument"("knowledgeBaseId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "KnowledgeDocument_userId_idx" ON "KnowledgeDocument"("userId");
CREATE INDEX IF NOT EXISTS "KnowledgeDocument_status_idx" ON "KnowledgeDocument"("status");

CREATE UNIQUE INDEX IF NOT EXISTS "KnowledgeChunk_documentId_chunkIndex_key"
ON "KnowledgeChunk"("documentId", "chunkIndex");
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_knowledgeBaseId_idx" ON "KnowledgeChunk"("knowledgeBaseId");
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_userId_idx" ON "KnowledgeChunk"("userId");
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_documentId_idx" ON "KnowledgeChunk"("documentId");
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_content_trgm_idx"
ON "KnowledgeChunk" USING GIN ("content" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_content_fts_idx"
ON "KnowledgeChunk" USING GIN (to_tsvector('simple', "content"));
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_embedding_hnsw_idx"
ON "KnowledgeChunk" USING hnsw ("embedding" vector_cosine_ops);

ALTER TABLE "KnowledgeBase"
DROP CONSTRAINT IF EXISTS "KnowledgeBase_userId_fkey";
ALTER TABLE "KnowledgeBase"
ADD CONSTRAINT "KnowledgeBase_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KnowledgeDocument"
DROP CONSTRAINT IF EXISTS "KnowledgeDocument_knowledgeBaseId_fkey";
ALTER TABLE "KnowledgeDocument"
ADD CONSTRAINT "KnowledgeDocument_knowledgeBaseId_fkey"
FOREIGN KEY ("knowledgeBaseId") REFERENCES "KnowledgeBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KnowledgeChunk"
DROP CONSTRAINT IF EXISTS "KnowledgeChunk_documentId_fkey";
ALTER TABLE "KnowledgeChunk"
ADD CONSTRAINT "KnowledgeChunk_documentId_fkey"
FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KnowledgeChunk"
DROP CONSTRAINT IF EXISTS "KnowledgeChunk_knowledgeBaseId_fkey";
ALTER TABLE "KnowledgeChunk"
ADD CONSTRAINT "KnowledgeChunk_knowledgeBaseId_fkey"
FOREIGN KEY ("knowledgeBaseId") REFERENCES "KnowledgeBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
