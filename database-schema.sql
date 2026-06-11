-- ============================================
-- AI.CoFounder — Database Schema
-- Esegui questo SQL nel Supabase SQL Editor
-- ============================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- AUTH TABLES
CREATE TABLE IF NOT EXISTS "Account" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "userId" TEXT NOT NULL, "type" TEXT NOT NULL, "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL, "refresh_token" TEXT, "access_token" TEXT,
    "expires_at" INTEGER, "token_type" TEXT, "scope" TEXT, "id_token" TEXT, "session_state" TEXT,
    CONSTRAINT "Account_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Account_provider_providerAccountId_key" UNIQUE ("provider", "providerAccountId")
);

CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "sessionToken" TEXT NOT NULL, "userId" TEXT NOT NULL, "expires" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Session_sessionToken_key" UNIQUE ("sessionToken")
);

CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "name" TEXT, "email" TEXT, "emailVerified" TIMESTAMPTZ, "image" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "User_pkey" PRIMARY KEY ("id"), CONSTRAINT "User_email_key" UNIQUE ("email")
);

CREATE TABLE IF NOT EXISTS "VerificationToken" (
    "identifier" TEXT NOT NULL, "token" TEXT NOT NULL, "expires" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("identifier", "token"),
    CONSTRAINT "VerificationToken_token_key" UNIQUE ("token")
);

-- STARTUP
CREATE TABLE IF NOT EXISTS "Startup" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text, "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL, "description" TEXT, "website" TEXT, "sector" TEXT NOT NULL,
    "phase" TEXT NOT NULL, "country" TEXT, "teamSize" INTEGER,
    "mrr" DOUBLE PRECISION NOT NULL DEFAULT 0, "users" INTEGER NOT NULL DEFAULT 0,
    "burnRate" DOUBLE PRECISION NOT NULL DEFAULT 0, "runway" INTEGER NOT NULL DEFAULT 0,
    "fundingRaised" DOUBLE PRECISION NOT NULL DEFAULT 0, "equityPartner" BOOLEAN NOT NULL DEFAULT false,
    "equityOffered" DOUBLE PRECISION, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "Startup_pkey" PRIMARY KEY ("id")
);

-- AGENTS
CREATE TABLE IF NOT EXISTS "AgentConfig" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text, "startupId" TEXT NOT NULL,
    "type" TEXT NOT NULL, "name" TEXT NOT NULL, "isActive" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "AgentConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Message" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text, "agentId" TEXT NOT NULL,
    "role" TEXT NOT NULL, "content" TEXT NOT NULL, "metadata" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- MEMORY ENGINE
CREATE TABLE IF NOT EXISTS "Interaction" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text, "startupId" TEXT NOT NULL,
    "agentType" TEXT NOT NULL, "category" TEXT NOT NULL, "advice" TEXT NOT NULL,
    "context" JSONB NOT NULL DEFAULT '{}', "helpful" BOOLEAN, "feedback" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "Interaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Outcome" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text, "startupId" TEXT NOT NULL,
    "status" TEXT NOT NULL, "metrics" JSONB NOT NULL DEFAULT '{}',
    "keyFactors" TEXT[] NOT NULL DEFAULT '{}', "notes" TEXT,
    "recordedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "Outcome_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Pattern" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text, "title" TEXT NOT NULL,
    "description" TEXT NOT NULL, "sector" TEXT, "phase" TEXT,
    "conditions" JSONB NOT NULL DEFAULT '{}', "successRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sampleSize" INTEGER NOT NULL DEFAULT 0, "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "keyFactors" TEXT[] NOT NULL DEFAULT '{}', "failureModes" TEXT[] NOT NULL DEFAULT '{}',
    "avgTimeToOutcome" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true,
    "extractedBy" TEXT NOT NULL DEFAULT 'hermes_cron',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "Pattern_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Playbook" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text, "title" TEXT NOT NULL,
    "description" TEXT NOT NULL, "sector" TEXT, "phase" TEXT,
    "conditions" JSONB NOT NULL DEFAULT '{}', "steps" JSONB NOT NULL DEFAULT '[]',
    "patternIds" TEXT[] NOT NULL DEFAULT '{}', "successRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "timesUsed" INTEGER NOT NULL DEFAULT 0, "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "Playbook_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Recommendation" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text, "startupId" TEXT NOT NULL,
    "patternId" TEXT, "type" TEXT NOT NULL, "title" TEXT NOT NULL, "content" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 1, "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isActedOn" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- FOREIGN KEYS
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
ALTER TABLE "Startup" ADD CONSTRAINT "Startup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
ALTER TABLE "AgentConfig" ADD CONSTRAINT "AgentConfig_startupId_fkey" FOREIGN KEY ("startupId") REFERENCES "Startup"("id") ON DELETE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentConfig"("id") ON DELETE CASCADE;
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_startupId_fkey" FOREIGN KEY ("startupId") REFERENCES "Startup"("id") ON DELETE CASCADE;
ALTER TABLE "Outcome" ADD CONSTRAINT "Outcome_startupId_fkey" FOREIGN KEY ("startupId") REFERENCES "Startup"("id") ON DELETE CASCADE;
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_startupId_fkey" FOREIGN KEY ("startupId") REFERENCES "Startup"("id") ON DELETE CASCADE;
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "Pattern"("id") ON DELETE SET NULL;

-- INDEXES
CREATE INDEX IF NOT EXISTS "Startup_sector_phase_idx" ON "Startup"("sector", "phase");
CREATE INDEX IF NOT EXISTS "Interaction_startupId_createdAt_idx" ON "Interaction"("startupId", "createdAt");
CREATE INDEX IF NOT EXISTS "Interaction_agentType_category_idx" ON "Interaction"("agentType", "category");
CREATE INDEX IF NOT EXISTS "Outcome_startupId_status_idx" ON "Outcome"("startupId", "status");
CREATE INDEX IF NOT EXISTS "Pattern_sector_phase_idx" ON "Pattern"("sector", "phase");
CREATE INDEX IF NOT EXISTS "Pattern_confidence_idx" ON "Pattern"("confidence");
CREATE INDEX IF NOT EXISTS "Message_agentId_createdAt_idx" ON "Message"("agentId", "createdAt");
CREATE INDEX IF NOT EXISTS "Recommendation_startupId_isRead_idx" ON "Recommendation"("startupId", "isRead");

-- RLS
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Startup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AgentConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Interaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Outcome" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Recommendation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Pattern" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Playbook" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON "User" FOR ALL USING (true);
CREATE POLICY "Allow all" ON "Account" FOR ALL USING (true);
CREATE POLICY "Allow all" ON "Session" FOR ALL USING (true);
CREATE POLICY "Allow all" ON "Startup" FOR ALL USING (true);
CREATE POLICY "Allow all" ON "AgentConfig" FOR ALL USING (true);
CREATE POLICY "Allow all" ON "Message" FOR ALL USING (true);
CREATE POLICY "Allow all" ON "Interaction" FOR ALL USING (true);
CREATE POLICY "Allow all" ON "Outcome" FOR ALL USING (true);
CREATE POLICY "Allow all" ON "Recommendation" FOR ALL USING (true);
CREATE POLICY "Allow all" ON "Pattern" FOR ALL USING (true);
CREATE POLICY "Allow all" ON "Playbook" FOR ALL USING (true);

-- GRANTS
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- SEED PATTERNS
INSERT INTO "Pattern" ("id", "title", "description", "sector", "phase", "successRate", "sampleSize", "confidence", "keyFactors", "failureModes", "avgTimeToOutcome") VALUES
('pat_001', 'SaaS PLG Strategy', 'Product-Led Growth with freemium tier. 68% of similar startups reached seed within 12 months.', 'saas', 'pre-seed', 0.68, 150, 0.85, ARRAY['viral_coefficient', 'conversion_rate', 'product_quality'], ARRAY['too_many_features', 'low_conversion', 'high_burn'], '11_mesi'),
('pat_002', 'B2B Sales-Led Growth', 'Outbound outreach and LinkedIn selling. Average time to first paying customer: 3 months.', 'saas', 'mvp', 0.72, 200, 0.88, ARRAY['outbound_quality', 'founder_sales', 'product_fit'], ARRAY['no_product_fit', 'wrong_icp', 'slow_sales_cycle'], '3_mesi'),
('pat_003', 'Fintech Regulatory First', 'Prioritize regulatory compliance from day one. 3x higher success rate.', 'fintech', 'idea', 0.45, 80, 0.75, ARRAY['legal_advisor', 'compliance_budget', 'regulatory_strategy'], ARRAY['ignore_regulation', 'wrong_jurisdiction', 'underestimate_cost'], '18_mesi'),
('pat_004', 'Marketplace Liquidity', 'Focus on one side first. Supply-side first works 70% for B2B marketplaces.', 'ecommerce', 'mvp', 0.55, 120, 0.78, ARRAY['supply_quality', 'demand_generation', 'pricing'], ARRAY['both_sides_at_once', 'wrong_side_first', 'no_liquidity'], '14_mesi'),
('pat_005', 'AI/ML Technical Moat', 'Proprietary data moats outperform API-only. Focus on data collection from day one.', 'ai', 'idea', 0.62, 95, 0.80, ARRAY['proprietary_data', 'custom_models', 'data_pipeline'], ARRAY['api_only', 'no_data_strategy', 'generic_models'], '16_mesi'),
('pat_006', 'Fundraising Timing', 'Start fundraising with 6+ months runway and clear traction. Best after PMF signals.', 'saas', 'growth', 0.75, 300, 0.90, ARRAY['mrr_growth', 'user_traction', 'team_quality'], ARRAY['too_early', 'no_metrics', 'wrong_investors'], '6_mesi'),
('pat_007', 'Team Composition', 'Technical + business co-founders have 2x higher survival rate.', 'saas', 'idea', 0.65, 500, 0.92, ARRAY['technical_cofounder', 'business_cofounder', 'advisor_network'], ARRAY['solo_founder', 'wrong_cofounder', 'no_advisors'], 'N/A')
ON CONFLICT DO NOTHING;

-- SEED PLAYBOOKS
INSERT INTO "Playbook" ("id", "title", "description", "sector", "phase", "steps", "patternIds", "successRate") VALUES
('pb_001', 'SaaS Pre-Seed Launch', 'From idea to seed round. Based on 500+ SaaS startups.', 'saas', 'pre-seed',
'[{"step":1,"title":"Validate Problem","duration":"2-4 weeks"},{"step":2,"title":"Build MVP","duration":"4-8 weeks"},{"step":3,"title":"Launch on PH","duration":"1 week"},{"step":4,"title":"Activate Users","duration":"Ongoing"},{"step":5,"title":"Optimize Conversion","duration":"4-6 weeks"},{"step":6,"title":"Prepare Fundraising","duration":"4-6 weeks"},{"step":7,"title":"Fundraise","duration":"2-3 months"}]'::jsonb,
ARRAY['pat_001', 'pat_006', 'pat_007'], 0.68),
('pb_002', 'B2B Sales-Led Growth', '0 to 100 paying B2B customers via outbound sales.', 'saas', 'mvp',
'[{"step":1,"title":"Define ICP","duration":"1 week"},{"step":2,"title":"Build Outbound List","duration":"1-2 weeks"},{"step":3,"title":"Cold Outreach","duration":"Ongoing"},{"step":4,"title":"Demo & Close","duration":"Ongoing"},{"step":5,"title":"Content Marketing","duration":"Ongoing"},{"step":6,"title":"Referral Program","duration":"4 weeks"}]'::jsonb,
ARRAY['pat_002', 'pat_006'], 0.72)
ON CONFLICT DO NOTHING;

-- VERIFY
SELECT 'Database setup complete!' as status;
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
