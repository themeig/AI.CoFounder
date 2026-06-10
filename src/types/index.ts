export type AgentType = "strategy" | "tech" | "finance" | "marketing" | "legal" | "operations";
export type StartupPhase = "idea" | "mvp" | "launched" | "growth" | "funded";
export type StartupSector = "saas" | "fintech" | "healthtech" | "ecommerce" | "ai" | "climate" | "consumer" | "other";
export type OutcomeStatus = "growing" | "stalled" | "failed" | "acquired" | "pivot";
export type RecommendationType = "opportunity" | "warning" | "insight" | "action_item";

export interface StartupProfile {
  id: string;
  name: string;
  description?: string;
  sector: StartupSector;
  phase: StartupPhase;
  mrr: number;
  users: number;
  burnRate: number;
  runway: number;
  fundingRaised: number;
}

export interface AgentMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface Pattern {
  id: string;
  title: string;
  description: string;
  sector?: string;
  phase?: string;
  successRate: number;
  sampleSize: number;
  confidence: number;
  keyFactors: string[];
  failureModes: string[];
}
