-- 1. Enable the pgvector extension to support vector type and operations
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add embedding column to existing Pattern table (non-destructive)
ALTER TABLE "Pattern" ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- 3. Create the VectorMemory table for long-term semantic memory entries
CREATE TABLE IF NOT EXISTS "VectorMemory" (
  id TEXT PRIMARY KEY,
  "agentConfigId" TEXT NOT NULL REFERENCES "AgentConfig"(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(1536),
  importance INTEGER DEFAULT 3,
  scope TEXT DEFAULT 'local', -- 'local' | 'global'
  category TEXT DEFAULT 'general',
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create index on agentConfigId for fast retrieval
CREATE INDEX IF NOT EXISTS "VectorMemory_agentConfigId_idx" ON "VectorMemory"("agentConfigId");

-- 5. Create SQL Function for semantic matching of patterns (RPC)
CREATE OR REPLACE FUNCTION match_patterns (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_sector text DEFAULT 'all',
  filter_phase text DEFAULT 'all',
  min_rate float DEFAULT 0.0
) RETURNS TABLE (
  id text,
  title text,
  description text,
  sector text,
  phase text,
  "successRate" float,
  "sampleSize" int,
  confidence float,
  "keyFactors" text[],
  "failureModes" text[],
  "avgTimeToOutcome" text,
  similarity float
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.title,
    p.description,
    p.sector,
    p.phase,
    p."successRate",
    p."sampleSize",
    p.confidence,
    p."keyFactors",
    p."failureModes",
    p."avgTimeToOutcome",
    1 - (p.embedding <=> query_embedding) AS similarity
  FROM "Pattern" p
  WHERE p."isActive" = true
    AND (filter_sector = 'all' OR p.sector = filter_sector)
    AND (filter_phase = 'all' OR p.phase = filter_phase)
    AND (p."successRate" >= min_rate OR p."successRate" < 0.4)
    AND 1 - (p.embedding <=> query_embedding) > match_threshold
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 6. Create SQL Function for semantic matching of memories (RPC)
CREATE OR REPLACE FUNCTION match_memories (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_agent_config_id text,
  filter_scope text DEFAULT 'all'
) RETURNS TABLE (
  id text,
  content text,
  importance int,
  scope text,
  category text,
  "createdAt" text,
  similarity float
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    vm.id,
    vm.content,
    vm.importance,
    vm.scope,
    vm.category,
    vm."createdAt"::text,
    1 - (vm.embedding <=> query_embedding) AS similarity
  FROM "VectorMemory" vm
  WHERE (vm."agentConfigId" = filter_agent_config_id OR (vm.scope = 'global' AND vm."agentConfigId" IN (
    SELECT ac.id FROM "AgentConfig" ac WHERE ac."startupId" = (
      SELECT ac2."startupId" FROM "AgentConfig" ac2 WHERE ac2.id = filter_agent_config_id
    )
  )))
  AND (filter_scope = 'all' OR vm.scope = filter_scope)
  AND 1 - (vm.embedding <=> query_embedding) > match_threshold
  ORDER BY vm.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
