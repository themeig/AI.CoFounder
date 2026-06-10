import { db } from "./db";
import type { StartupSector, StartupPhase, AgentType } from "@/types";

// 1. COLLECT - Save every interaction
export async function collectInteraction(data: {
  startupId: string;
  agentType: AgentType;
  category: string;
  advice: string;
  context: Record<string, unknown>;
}) {
  return db.interaction.create({
    data: {
      startupId: data.startupId,
      agentType: data.agentType,
      category: data.category,
      advice: data.advice,
      context: data.context as any,
    },
  });
}

// 2. TRACK - Update outcomes
export async function trackOutcome(startupId: string, outcome: {
  status: "growing" | "stalled" | "failed" | "acquired" | "pivot";
  metrics: Record<string, unknown>;
  keyFactors: string[];
  notes?: string;
}) {
  return db.outcome.create({
    data: {
      startupId,
      status: outcome.status,
      metrics: outcome.metrics as any,
      keyFactors: outcome.keyFactors,
      notes: outcome.notes,
    },
  });
}

// 3. EXTRACT - Find patterns (called by cron job)
export async function extractPatterns() {
  // Group interactions by sector + phase + category
  const startups = await db.startup.findMany({
    include: {
      interactions: true,
      outcomes: true,
    },
  });

  // Simple pattern extraction logic
  const patterns: Array<{
    sector: string;
    phase: string;
    category: string;
    successRate: number;
    sampleSize: number;
    keyFactors: string[];
  }> = [];

  // Group by sector + phase
  const grouped = new Map<string, typeof startups>();
  for (const s of startups) {
    const key = `${s.sector}:${s.phase}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(s);
  }

  for (const [key, group] of grouped) {
    const [sector, phase] = key.split(":");
    const withOutcomes = group.filter(s => s.outcomes.length > 0);
    
    if (withOutcomes.length >= 5) {
      const successful = withOutcomes.filter(
        s => s.outcomes.some(o => o.status === "growing" || o.status === "acquired")
      );
      
      const successRate = successful.length / withOutcomes.length;
      
      // Collect common success factors
      const allFactors = successful.flatMap(s => 
        s.outcomes.flatMap(o => o.keyFactors)
      );
      const factorCounts = new Map<string, number>();
      for (const f of allFactors) {
        factorCounts.set(f, (factorCounts.get(f) || 0) + 1);
      }
      const topFactors = [...factorCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([f]) => f);

      patterns.push({
        sector,
        phase,
        category: "general",
        successRate,
        sampleSize: withOutcomes.length,
        keyFactors: topFactors,
      });
    }
  }

  // Save patterns to DB
  for (const p of patterns) {
    await db.pattern.upsert({
      where: {
        id: `${p.sector}:${p.phase}:${p.category}`,
      },
      create: {
        title: `${p.sector} ${p.phase} success pattern`,
        description: `Success rate: ${(p.successRate * 100).toFixed(1)}% from ${p.sampleSize} startups`,
        sector: p.sector,
        phase: p.phase,
        conditions: {},
        successRate: p.successRate,
        sampleSize: p.sampleSize,
        confidence: Math.min(p.sampleSize / 50, 0.95),
        keyFactors: p.keyFactors,
        failureModes: [],
        extractedBy: "hermes_cron",
      },
      update: {
        successRate: p.successRate,
        sampleSize: p.sampleSize,
        confidence: Math.min(p.sampleSize / 50, 0.95),
        keyFactors: p.keyFactors,
      },
    });
  }

  return patterns;
}

// 4. RECOMMEND - Generate personalized recommendations
export async function generateRecommendations(startupId: string) {
  const startup = await db.startup.findUnique({
    where: { id: startupId },
  });

  if (!startup) return [];

  // Find applicable patterns
  const patterns = await db.pattern.findMany({
    where: {
      isActive: true,
      OR: [
        { sector: startup.sector, phase: startup.phase },
        { sector: startup.sector, phase: null },
        { sector: null, phase: startup.phase },
      ],
    },
    orderBy: { confidence: "desc" },
    take: 10,
  });

  // Create recommendations
  const recommendations = [];
  for (const pattern of patterns) {
    const rec = await db.recommendation.create({
      data: {
        startupId,
        patternId: pattern.id,
        type: "insight",
        title: pattern.title,
        content: `${pattern.description}. Key factors: ${pattern.keyFactors.join(", ")}`,
        priority: pattern.confidence > 0.7 ? 3 : pattern.confidence > 0.4 ? 2 : 1,
      },
    });
    recommendations.push(rec);
  }

  return recommendations;
}

// 5. GET RELEVANT PATTERNS - For chat context
export async function getRelevantPatterns(sector: StartupSector, phase: StartupPhase) {
  return db.pattern.findMany({
    where: {
      isActive: true,
      OR: [
        { sector, phase },
        { sector, phase: null },
        { sector: null, phase },
        { sector: null, phase: null },
      ],
    },
    orderBy: [{ confidence: "desc" }, { successRate: "desc" }],
    take: 5,
  });
}
