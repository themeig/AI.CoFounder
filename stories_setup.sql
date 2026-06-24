-- Run this in your Supabase SQL Editor to create the CaseStudy table and enable semantic search
-- This bypasses any local IPv6 network blocks on port 5432!

-- 1. Create the CaseStudy table
CREATE TABLE IF NOT EXISTS "CaseStudy" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "embedding" vector(1536),
  "sector" TEXT,
  "status" TEXT NOT NULL,
  "takeaway" TEXT NOT NULL,
  "isActive" BOOLEAN DEFAULT true NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create index on sector
CREATE INDEX IF NOT EXISTS "CaseStudy_sector_idx" ON "CaseStudy"("sector");

-- 2. Create the semantic search function
CREATE OR REPLACE FUNCTION match_stories (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_sector text,
  filter_status text
)
RETURNS TABLE (
  id text,
  title text,
  description text,
  sector text,
  status text,
  takeaway text,
  similarity float
)
AS $$
BEGIN
  RETURN QUERY
  SELECT
    "CaseStudy".id,
    "CaseStudy".title,
    "CaseStudy".description,
    "CaseStudy".sector,
    "CaseStudy".status,
    "CaseStudy".takeaway,
    1 - ("CaseStudy".embedding <=> query_embedding) AS similarity
  FROM "CaseStudy"
  WHERE 1 - ("CaseStudy".embedding <=> query_embedding) > match_threshold
    AND (filter_sector = 'all' OR "CaseStudy".sector = filter_sector)
    AND (filter_status = 'all' OR "CaseStudy".status = filter_status)
    AND "CaseStudy"."isActive" = true
  ORDER BY "CaseStudy".embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

