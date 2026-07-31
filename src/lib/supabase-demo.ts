export const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
export const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabaseHeaders = {
  "apikey": SUPABASE_SERVICE_KEY,
  "Authorization": "Bearer " + SUPABASE_SERVICE_KEY,
  "Content-Type": "application/json",
  "Prefer": "return=representation",
};

const DEFAULT_PATTERNS_FALLBACK = [
  {
    id: "pat_001",
    title: "SaaS PLG Strategy",
    description: "Product-Led Growth con modello freemium/trial. 68% delle startup SaaS simili raggiungono il seed entro 12 mesi se mantengono una conversione >3%.",
    sector: "saas",
    phase: "pre-seed",
    successRate: 0.68,
    sampleSize: 150,
    confidence: 0.85,
    keyFactors: ["viral_coefficient", "conversion_rate", "product_quality"],
    failureModes: ["too_many_features", "low_conversion", "high_burn"],
    avgTimeToOutcome: "11 mesi",
    isActive: true
  },
  {
    id: "pat_002",
    title: "B2B Sales-Led Growth",
    description: "Outreach diretto B2B e vendita su LinkedIn. Tempo medio per il primo cliente pagante: 3 mesi con founder sales.",
    sector: "saas",
    phase: "mvp",
    successRate: 0.72,
    sampleSize: 200,
    confidence: 0.88,
    keyFactors: ["outbound_quality", "founder_sales", "product_fit"],
    failureModes: ["no_product_fit", "wrong_icp", "slow_sales_cycle"],
    avgTimeToOutcome: "3 mesi",
    isActive: true
  },
  {
    id: "pat_003",
    title: "Fintech Regulatory First",
    description: "Priorità alla compliance normativa fin dal giorno uno. Tasso di successo 3x superiore rispetto a chi ignora la regulation.",
    sector: "fintech",
    phase: "idea",
    successRate: 0.45,
    sampleSize: 80,
    confidence: 0.75,
    keyFactors: ["legal_advisor", "compliance_budget", "regulatory_strategy"],
    failureModes: ["ignore_regulation", "wrong_jurisdiction", "underestimate_cost"],
    avgTimeToOutcome: "18 mesi",
    isActive: true
  },
  {
    id: "pat_004",
    title: "Marketplace Liquidity Anti-Pattern",
    description: "Tentare di lanciare entrambi i lati di un marketplace simultaneamente senza concentrarsi sull'offerta porta all'85% di fallimenti.",
    sector: "ecommerce",
    phase: "mvp",
    successRate: 0.35,
    sampleSize: 120,
    confidence: 0.78,
    keyFactors: ["supply_quality", "demand_generation", "pricing"],
    failureModes: ["both_sides_at_once", "wrong_side_first", "no_liquidity"],
    avgTimeToOutcome: "14 mesi",
    isActive: true
  },
  {
    id: "pat_005",
    title: "AI/ML Technical Moat",
    description: "I fossati basati su dati proprietari superano i semplici wrapper di API. Focalizzarsi sulla raccolta dati fin dall'inizio.",
    sector: "ai",
    phase: "idea",
    successRate: 0.62,
    sampleSize: 95,
    confidence: 0.80,
    keyFactors: ["proprietary_data", "custom_models", "data_pipeline"],
    failureModes: ["api_only", "no_data_strategy", "generic_models"],
    avgTimeToOutcome: "16 mesi",
    isActive: true
  },
  {
    id: "pat_006",
    title: "Fundraising Timing & Runway",
    description: "Avviare il fundraising con almeno 6 mesi di runway residua e segnali chiari di metriche di crescita (MRR/Retention).",
    sector: "saas",
    phase: "growth",
    successRate: 0.75,
    sampleSize: 300,
    confidence: 0.90,
    keyFactors: ["mrr_growth", "user_traction", "team_quality"],
    failureModes: ["too_early", "no_metrics", "wrong_investors"],
    avgTimeToOutcome: "6 mesi",
    isActive: true
  },
  {
    id: "pat_007",
    title: "Technical + Business Co-Founder Team",
    description: "La leadership bilanciata tra competenze tecniche e di business raddoppia il tasso di sopravvivenza della startup.",
    sector: "saas",
    phase: "idea",
    successRate: 0.65,
    sampleSize: 500,
    confidence: 0.92,
    keyFactors: ["technical_cofounder", "business_cofounder", "advisor_network"],
    failureModes: ["solo_founder", "wrong_cofounder", "no_advisors"],
    avgTimeToOutcome: "12 mesi",
    isActive: true
  }
];

const DEFAULT_PLAYBOOKS_FALLBACK = [
  {
    id: "pb_001",
    title: "SaaS Pre-Seed Launch Playbook",
    description: "Dall'idea al seed round basato sull'analisi di oltre 500 startup SaaS.",
    sector: "saas",
    phase: "pre-seed",
    steps: [
      { step: 1, title: "Validazione Problema & Customer Interviews", duration: "2-4 settimane" },
      { step: 2, title: "Sviluppo MVP & Core Feature", duration: "4-8 settimane" },
      { step: 3, title: "Lancio ProductHunt & Beta Tester", duration: "1 settimana" },
      { step: 4, title: "Attivazione Utenti & Retention Loop", duration: "In corso" },
      { step: 5, title: "Ottimizzazione Funnel Conversione", duration: "4-6 settimane" },
      { step: 6, title: "Preparazione Data Room & Pitch Deck", duration: "4 settimane" }
    ],
    patternIds: ["pat_001", "pat_006"],
    successRate: 0.68,
    isActive: true
  },
  {
    id: "pb_002",
    title: "B2B Sales-Led Growth Playbook",
    description: "Da 0 a 100 clienti B2B paganti tramite outbound sales e founder-led sales.",
    sector: "saas",
    phase: "mvp",
    steps: [
      { step: 1, title: "Definizione ICP (Ideal Customer Profile) & Buyer Persona", duration: "1 settimana" },
      { step: 2, title: "Costruzione Outbound List (LinkedIn Sales Navigator)", duration: "2 settimane" },
      { step: 3, title: "Outreach Founder-Led Sales & Cold Emailing", duration: "In corso" },
      { step: 4, title: "Demo Call & Chiusura primi 10 clienti paganti", duration: "4-8 settimane" },
      { step: 5, title: "Customer Success & Case Studies", duration: "4 settimane" },
      { step: 6, title: "Scalare il team Sales (SDR & AE)", duration: "8-12 settimane" }
    ],
    patternIds: ["pat_002", "pat_006"],
    successRate: 0.72,
    isActive: true
  },
  {
    id: "pb_003",
    title: "AI Technical Moat & Data Pipeline Playbook",
    description: "Costruire una pipeline di dati proprietari e difendibilità tecnica per prodotti AI.",
    sector: "ai",
    phase: "idea",
    steps: [
      { step: 1, title: "Definizione Data Strategy & Fonti Proprietarie", duration: "2-3 settimane" },
      { step: 2, title: "Architettura Pipeline Ingestion & Vector DB", duration: "4 settimane" },
      { step: 3, title: "Fine-tuning & Prompt Engineering RAG", duration: "3-5 settimane" },
      { step: 4, title: "Implementazione Guardrails & Test Allucinazioni", duration: "2 settimane" },
      { step: 5, title: "Rilascio MVP AI Agentic & Feedback Loop", duration: "In corso" }
    ],
    patternIds: ["pat_005"],
    successRate: 0.78,
    isActive: true
  },
  {
    id: "pb_004",
    title: "Fintech Compliance & Licensing Playbook",
    description: "Ottenere il setup legale e regolamentare in ambito Fintech senza rallentare il go-to-market.",
    sector: "fintech",
    phase: "pre-seed",
    steps: [
      { step: 1, title: "Analisi Requisiti Normativi (MiCA / GDPR / Banca d'Italia)", duration: "3 settimane" },
      { step: 2, title: "Selezione Partner Banking-as-a-Service (BaaS)", duration: "4 settimane" },
      { step: 3, title: "Implementazione KYC/AML & Fraud Detection", duration: "4-6 settimane" },
      { step: 4, title: "Audit di Sicurezza Pen-Test & ISO27001", duration: "3 settimane" },
      { step: 5, title: "Rilascio Pilota Controllato (Sandbox Normativa)", duration: "6 settimane" }
    ],
    patternIds: ["pat_003"],
    successRate: 0.65,
    isActive: true
  },
  {
    id: "pb_005",
    title: "PLG Funnel Optimization & Virality Playbook",
    description: "Scalare l'acquisizione organica con coefficiente virale e trial ad alta conversione.",
    sector: "saas",
    phase: "growth",
    steps: [
      { step: 1, title: "Analisi Time-To-Value (TTV) & Riduzione Friction", duration: "2 settimane" },
      { step: 2, title: "Progettazione Freemium / Trial In-Product Triggers", duration: "3 settimane" },
      { step: 3, title: "Implementazione Referral System & Virality Hooks", duration: "3-4 settimane" },
      { step: 4, title: "Self-Serve Checkout & Segmentazione Enterprise", duration: "4 settimane" },
      { step: 5, title: "A/B Testing sulle Pagine di Pricing", duration: "In corso" }
    ],
    patternIds: ["pat_001", "pat_006"],
    successRate: 0.81,
    isActive: true
  },
  {
    id: "pb_006",
    title: "Product-Market Fit Validation Playbook",
    description: "Metodologia quantitativa Sean Ellis per misurare e raggiungere il Product-Market Fit reale.",
    sector: "saas",
    phase: "idea",
    steps: [
      { step: 1, title: "Esecuzione Sean Ellis Survey (PMF Test)", duration: "2 settimane" },
      { step: 2, title: "Segmentazione High-Expectation Customers (HXC)", duration: "1-2 settimane" },
      { step: 3, title: "Identificazione & Rimozione Bloccanti Retention", duration: "3-4 settimane" },
      { step: 4, title: "Iterazione Rapida Funzionalità Richieste", duration: "6 settimane" },
      { step: 5, title: "Calcolo Cohort Retention Floor (>40% a 6 mesi)", duration: "8 settimane" }
    ],
    patternIds: ["pat_001", "pat_002"],
    successRate: 0.74,
    isActive: true
  },
  {
    id: "pb_007",
    title: "Series A Pitch & Data Room Playbook",
    description: "Preparare la data room finanziaria, le metriche SaaS ed il pitch per la Series A.",
    sector: "saas",
    phase: "growth",
    steps: [
      { step: 1, title: "Consolidamento Metriche SaaS (ARR, NRR, LTV/CAC)", duration: "2 settimane" },
      { step: 2, title: "Redazione Pitch Deck (10 Slide Narrative)", duration: "3 settimane" },
      { step: 3, title: "Allestimento Data Room Finanziaria & Cap Table", duration: "2 settimane" },
      { step: 4, title: "Target Investor List & Warm Intro", duration: "2 settimane" },
      { step: 5, title: "Esecuzione Partner Meetings & Term Sheet Negotiation", duration: "6-10 settimane" }
    ],
    patternIds: ["pat_006"],
    successRate: 0.76,
    isActive: true
  },
  {
    id: "pb_008",
    title: "B2B Enterprise Procurement & Security Deal Playbook",
    description: "Gestire i questionari di sicurezza e chiudere contratti Enterprise ad alto valore.",
    sector: "saas",
    phase: "growth",
    steps: [
      { step: 1, title: "Compilazione Security Questionnaire (SOC2 / ISO27001 / GDPR)", duration: "2 settimane" },
      { step: 2, title: "Negotiation del Master Services Agreement (MSA) & SLA", duration: "3-4 settimane" },
      { step: 3, title: "SSO / SAML Integration & RBAC User Management", duration: "2 settimane" },
      { step: 4, title: "Pilot Enterprise di 30 giorni con KPI misurabili", duration: "4 settimane" },
      { step: 5, title: "Chiusura Contratto Annuale con Pagamento Anticipato", duration: "2 settimane" }
    ],
    patternIds: ["pat_002"],
    successRate: 0.77,
    isActive: true
  },
  {
    id: "pb_009",
    title: "Marketplace Supply-Side Liquidity Playbook",
    description: "Creare la prima liquidità focalizzandosi sul lato offerta nei marketplace B2B/B2C.",
    sector: "ecommerce",
    phase: "mvp",
    steps: [
      { step: 1, title: "Reclutamento Esclusivo del Lato Offerta (Supply First)", duration: "4 settimane" },
      { step: 2, title: "Garanzia di Minimo Guadagno / Subsidized Supply", duration: "3 settimane" },
      { step: 3, title: "Lancio Mirato al Lato Domanda in Nicchia Circoscritta", duration: "2 settimane" },
      { step: 4, title: "Misurazione Match Rate & Take Rate Optimization", duration: "4 settimane" },
      { step: 5, title: "Espansione Geografica / Categoria Adiacente", duration: "8 settimane" }
    ],
    patternIds: ["pat_004"],
    successRate: 0.63,
    isActive: true
  },
  {
    id: "pb_010",
    title: "Series A Pitch & Investor Data Room Playbook",
    description: "Preparare la data room finanziaria, le metriche SaaS ed il pitch per la Series A.",
    sector: "saas",
    phase: "growth",
    steps: [
      { step: 1, title: "Consolidamento Metriche Cohort (ARR, CAC/LTV, Retention)", duration: "2 settimane" },
      { step: 2, title: "Redazione Pitch Deck (10 Slide Narrative YC/Sequoia)", duration: "3 settimane" },
      { step: 3, title: "Allestimento Data Room (Cap Table, P&L, IP, MSA Contracts)", duration: "2 settimane" },
      { step: 4, title: "Warm Intro da Fondatori / Advisor agli Lead Investor", duration: "2 settimane" },
      { step: 5, title: "Execution Partner Meetings & Term Sheet Negotiation", duration: "6-8 settimane" }
    ],
    patternIds: ["pat_006"],
    successRate: 0.76,
    isActive: true
  }
];

const DEFAULT_AGENTS_FALLBACK = [
  {
    id: "demo-agent-strategy",
    startupId: "demo-startup-id",
    type: "strategy",
    name: "Strategy Agent",
    isActive: true,
    settings: {
      mnemosyne: [
        { id: "mem_01", content: "La startup TechFlow opera nel settore SaaS B2B ed è focalizzata su automazione workflow tramite intelligenza artificiale per startup pre-seed.", scope: "global", importance: 0.9, category: "strategy", createdAt: new Date().toISOString() },
        { id: "mem_02", content: "L'obiettivo prioritario nei prossimi 6 mesi è validare il Product-Market Fit e raggiungere $5,000 di MRR.", scope: "local", importance: 0.85, category: "goals", createdAt: new Date().toISOString() }
      ]
    }
  },
  {
    id: "demo-agent-tech",
    startupId: "demo-startup-id",
    type: "tech",
    name: "Tech Agent",
    isActive: true,
    settings: {
      mnemosyne: [
        { id: "mem_03", content: "Lo stack tecnologico scelto per TechFlow include Next.js 14, TypeScript, TailwindCSS e PostgreSQL/Supabase.", scope: "global", importance: 0.88, category: "tech", createdAt: new Date().toISOString() }
      ]
    }
  },
  {
    id: "demo-agent-finance",
    startupId: "demo-startup-id",
    type: "finance",
    name: "Finance Agent",
    isActive: true,
    settings: {
      mnemosyne: [
        { id: "mem_04", content: "Le metriche attuali di TechFlow registrano un MRR di $1,200, 150 utenti attivi, un burn rate mensile di $800 ed una runway stimata di 18 mesi.", scope: "global", importance: 0.95, category: "finance", createdAt: new Date().toISOString() }
      ]
    }
  },
  { id: "demo-agent-marketing", startupId: "demo-startup-id", type: "marketing", name: "Marketing Agent", isActive: true, settings: { mnemosyne: [] } },
  { id: "demo-agent-legal", startupId: "demo-startup-id", type: "legal", name: "Legal Agent", isActive: true, settings: { mnemosyne: [] } },
  { id: "demo-agent-operations", startupId: "demo-startup-id", type: "operations", name: "Operations Agent", isActive: true, settings: { mnemosyne: [] } },
];

function getFallbackData(path: string, options: any = {}) {
  const method = (options.method || "GET").toUpperCase();

  if (path.includes("/User")) {
    return [{ id: "demo-user-id", email: "demo@agentfoundry.ai", name: "Demo Founder" }];
  }

  if (path.includes("/Startup")) {
    return [{
      id: "demo-startup-id",
      userId: "demo-user-id",
      name: "TechFlow",
      description: "AI-powered workflow automation for startups",
      sector: "saas",
      phase: "pre-seed",
      mrr: 1200,
      users: 150,
      burnRate: 800,
      runway: 18,
    }];
  }

  if (path.includes("/AgentConfig")) {
    if (method === "POST" || method === "PATCH") {
      try {
        const body = typeof options.body === "string" ? JSON.parse(options.body) : options.body;
        return [{ id: body?.id || "demo-agent-id", ...body }];
      } catch {
        return [{ id: "demo-agent-id", success: true }];
      }
    }
    return DEFAULT_AGENTS_FALLBACK;
  }

  if (path.includes("/Pattern")) {
    return DEFAULT_PATTERNS_FALLBACK;
  }

  if (path.includes("/Playbook")) {
    return DEFAULT_PLAYBOOKS_FALLBACK;
  }

  if (path.includes("/Message") || path.includes("/Interaction")) {
    if (method === "POST") {
      return [{ id: "demo-record-id", createdAt: new Date().toISOString() }];
    }
    return [];
  }

  return [];
}

export async function supabaseFetch(path: string, options: any = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return getFallbackData(path, options);
  }

  const url = `${SUPABASE_URL}/rest/v1${path}`;
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...supabaseHeaders,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[Supabase REST Warning ${response.status}] ${path}: ${errorText}`);
      return getFallbackData(path, options);
    }

    return await response.json();
  } catch (err: any) {
    console.warn(`[Supabase Fetch Fallback] ${path} (${err?.message || err}). Using in-memory fallback.`);
    return getFallbackData(path, options);
  }
}
