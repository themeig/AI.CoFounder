import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cookies } from "next/headers";

const DEMO_RESPONSES: Record<string, string[]> = {
  strategy: [
    "Based on your SaaS MVP with $2.5K MRR and 150 users, I recommend focusing on Product-Led Growth. Here\'s why:

1. **Your metrics show product-market fit** — 150 users in MVP stage is strong
2. **PLG works best for SaaS at your stage** — 68% of similar startups reached seed within 12 months
3. **Key actions**: Add a freemium tier, optimize your viral loop, target viral coefficient > 0.3

Would you like me to create a detailed PLG playbook for TechFlow?",
    "Looking at your growth trajectory, here\'s my analysis:

**Current State**: $2.5K MRR, 150 users, 6 months runway
**Target**: $10K MRR within 6 months to be fundable

**Recommended Strategy**:
1. Focus on outbound to 50 high-value prospects
2. Launch content marketing (LinkedIn + blog)
3. Implement referral program
4. Optimize conversion funnel

Based on 200+ similar B2B SaaS startups, this approach has a 72% success rate. Want me to detail any of these steps?",
  ],
  tech: [
    "For your AI-powered project management tool, here\'s my technical recommendation:

**Architecture**:
- Next.js frontend (you\'re already on this ✅)
- Supabase for auth + database (✅)
- OpenRouter for AI features (add this)
- Vercel for deployment

**Priority Features**:
1. AI task auto-assignment
2. Smart deadline prediction
3. Automated standup reports
4. Integration with Slack/GitHub

**Tech Stack**: You\'re on the right track. Focus on the AI differentiation — that\'s your moat. Want me to spec out the AI task assignment feature?",
    "From a technical perspective, here\'s what I\'d prioritize:

**Immediate** (Week 1-2):
- Set up proper error tracking (Sentry)
- Add analytics (PostHog or Mixpanel)
- Implement rate limiting on API routes

**Short-term** (Month 1):
- Build the AI recommendation engine
- Add real-time collaboration (Supabase Realtime)
- Implement proper testing (Vitest + Playwright)

**Key insight**: Start with the AI features — that\'s your competitive moat. Don\'t over-engineer the infrastructure yet.",
  ],
  finance: [
    "Here\'s your financial analysis:

**Current Burn**: $8K/month
**Runway**: 6 months
**MRR**: $2.5K → Need $10K for sustainability

**Fundraising Timeline**:
- **Now**: Focus on growth metrics
- **Month 3-4**: Start fundraising conversations
- **Month 5-6**: Close seed round

**Target**: $500K-$1M seed round
**Valuation**: $3M-$5M pre-money (based on your metrics)

**Key Metrics to Hit Before Fundraising**:
- $5K+ MRR
- 300+ users
- 15%+ MoM growth

Based on 300+ similar startups, this timeline has a 75% success rate. Want me to build a detailed financial model?",
    "Financial health check for TechFlow:

**✅ Strengths**:
- Low burn rate ($8K/month)
- Good MRR for MVP stage
- 6 months runway gives you time

**⚠️ Risks**:
- Need to reach $10K MRR for sustainability
- Fundraising should start in 3-4 months

**Recommendations**:
1. Reduce burn to $5K/month if possible
2. Focus on revenue-generating features
3. Start building investor relationships now
4. Target 15% MoM growth

**Break-even**: At current burn, you need $8K MRR. You\'re at $2.5K. Gap: $5.5K. At 15% MoM growth, you\'ll hit break-even in ~6 months.",
  ],
};

export async function POST(req: Request) {
  try {
    const cookieStore = cookies();
    const demoUserId = cookieStore.get("demo_user")?.value;
    if (!demoUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { agentId, agentType, message } = await req.json();

    // Get a demo response based on agent type
    const responses = DEMO_RESPONSES[agentType] || DEMO_RESPONSES.strategy;
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];

    // Save interaction
    const startup = await db.startup.findFirst({ where: { userId: demoUserId } });
    if (startup) {
      await db.interaction.create({
        data: {
          startupId: startup.id,
          agentType,
          category: "chat",
          advice: randomResponse,
          context: { userMessage: message, agentType } as any,
        },
      });

      await db.message.create({ data: { agentId, role: "user", content: message } });
      await db.message.create({ data: { agentId, role: "assistant", content: randomResponse } });
    }

    return NextResponse.json({ response: randomResponse });
  } catch (error) {
    console.error("Demo chat error:", error);
    return NextResponse.json({ error: "Chat failed" }, { status: 500 });
  }
}
