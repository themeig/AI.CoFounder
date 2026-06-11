# AI.CoFounder — AI Agents for Startup Founders

> AI agents that learn from thousands of startups to help you build, grow, and fundraise. Like having a team of experts available 24/7.

![AI.CoFounder](https://img.shields.io/badge/AI-CoFounder-6366f1?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=for-the-badge&logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-000000?style=for-the-badge&logo=supabase)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma)

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Database Schema](#database-schema)
- [Memory Engine](#memory-engine)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### 🤖 AI Agents
Six specialized agents, each an expert in their domain:

| Agent | Icon | Specialty |
|-------|------|-----------|
| **Strategy Agent** | 🧠 | Market analysis, competitors, growth strategy |
| **Tech Agent** | 💻 | Code writing, infrastructure, code reviews — your AI CTO |
| **Finance Agent** | 📊 | Cash flow, projections, fundraising prep |
| **Marketing Agent** | 📣 | Campaigns, content, copy, acquisition |
| **Legal Agent** | ⚖️ | Terms of service, NDAs, contracts, compliance |
| **Operations Agent** | 🤝 | Workflow automation, team management |

### 🧠 Memory Engine
The core differentiator — a centralized knowledge base that learns from every startup:

- **Collect** — Every agent→founder interaction is stored
- **Track** — Startup outcomes are monitored over time
- **Extract** — Patterns are automatically identified from successful (and failed) startups
- **Recommend** — Personalized advice based on startups similar to yours

### 💰 Equity Partnership
Startups can apply to receive the service in exchange for equity instead of cash:

- **Seed Stage** (3-5% equity) — Idea / Pre-MVP
- **Growth Stage** (5-8% equity) — MVP / Early Traction
- **Scale Stage** (8-12% equity) — Funded / Scaling

Standard terms: 4-year vesting, 1-year cliff, milestone-based unlocks, acceleration on exit.

### 📊 Founder Dashboard
- Startup profile and metrics (MRR, users, burn rate, runway)
- Agent chat interface
- Knowledge base (patterns + playbooks)
- Recommendations feed

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 14 + React 18 | Web application with App Router |
| **Styling** | TailwindCSS + shadcn/ui | Dark-themed, responsive UI |
| **Backend** | Next.js API Routes | Server-side logic |
| **Auth** | NextAuth.js v4 | Google OAuth + Email credentials |
| **Database** | PostgreSQL (Supabase) | Primary database |
| **ORM** | Prisma 5 | Type-safe database access |
| **AI** | Vercel AI SDK + OpenRouter | LLM integration for agents |
| **Deployment** | Vercel | Frontend + API hosting |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    AGENTFOUNDRY PLATFORM                 │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Landing Page │  │  Auth Pages  │  │  Onboarding  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Founder Dashboard                    │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐ │   │
│  │  │ Overview│ │  Chat   │ │ Memory  │ │Startup │ │   │
│  │  │  Stats  │ │ Agents  │ │ Engine  │ │Profile │ │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └────────┘ │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │                  API Layer                        │   │
│  │  /api/auth  /api/chat  /api/startup  /api/memory │   │
│  └──────────────────────────────────────────────────┘   │
│                          │                               │
│  ┌───────────────────────┴───────────────────────────┐  │
│  │                Memory Engine                         │  │
│  │  Collect → Track → Extract → Recommend              │  │
│  └───────────────────────────────────────────────────┘  │
│                          │                               │
│  ┌───────────────────────┴───────────────────────────┐  │
│  │              Supabase (PostgreSQL)                   │  │
│  │  User  Startup  AgentConfig  Message  Pattern  ...  │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Data Flow: Agent Chat

```
Founder sends message
        ↓
Next.js API Route (/api/chat)
        ↓
1. Get startup profile + metrics
2. Fetch relevant patterns from Memory Engine
3. Build enriched system prompt
4. Call LLM (OpenRouter / Vercel AI SDK)
5. Save interaction to Memory Engine
6. Save messages to database
        ↓
Return AI response to founder
```

### Data Flow: Memory Engine

```
Every interaction is stored (Collect)
        ↓
Outcomes are tracked over time (Track)
        ↓
Cron job analyzes data weekly (Extract)
  - Groups startups by sector + phase
  - Calculates success rates
  - Identifies common success factors
  - Updates Pattern records
        ↓
New founder asks for advice (Recommend)
  - Match startup profile to patterns
  - Inject patterns into agent prompt
  - Agent gives data-backed advice
```

---

## Getting Started

### Prerequisites

- **Node.js** 18+ ([download](https://nodejs.org/))
- **npm** (comes with Node.js)
- **Supabase** account ([sign up](https://supabase.com))
- **OpenRouter** API key ([sign up](https://openrouter.ai))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/themeig/AI.CoFounder.git
   cd AI.CoFounder
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` with your credentials (see [Environment Variables](#environment-variables)).

4. **Set up the database**
   - Create a new Supabase project
   - Go to **SQL Editor** in the Supabase dashboard
   - Copy the contents of `database-schema.sql` and run it
   - Copy your database URL and anon key to `.env.local`

5. **Generate Prisma client**
   ```bash
   npx prisma generate
   ```

6. **Run the development server**
   ```bash
   npm run dev
   ```

7. **Open** [http://localhost:3000](http://localhost:3000)

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npx prisma generate` | Generate Prisma client |
| `npx prisma db push` | Push schema to database |
| `npx prisma studio` | Open Prisma Studio (DB GUI) |

---

## Database Schema

### Core Tables

| Table | Description |
|-------|-------------|
| `User` | Founder accounts |
| `Account` | OAuth accounts (NextAuth) |
| `Session` | User sessions (NextAuth) |
| `Startup` | Startup profiles with metrics |
| `AgentConfig` | Agent configurations per startup |
| `Message` | Chat messages |

### Memory Engine Tables

| Table | Description |
|-------|-------------|
| `Interaction` | Every agent→founder interaction |
| `Outcome` | Startup outcomes over time |
| `Pattern` | Extracted patterns from successful/failed startups |
| `Playbook` | Step-by-step action plans based on patterns |
| `Recommendation` | Personalized recommendations for founders |

### Entity Relationship

```
User ──1:N── Startup ──1:N── AgentConfig ──1:N── Message
                    │
                    ├──1:N── Interaction
                    ├──1:N── Outcome
                    └──1:N── Recommendation ──N:1── Pattern
                                                          │
                                              Playbook ──N:N── Pattern
```

---

## Memory Engine

The Memory Engine is what makes AI.CoFoundry different from a generic chatbot. It creates a **collective intelligence** that improves with every founder served.

### How It Works

#### 1. Collect
Every conversation between a founder and an agent is stored with context:
- What advice was given
- What was the startup situation at that time (metrics, phase, sector)
- Whether the founder found it helpful

#### 2. Track
Founders periodically update their startup metrics. Outcomes are recorded:
- Growing / Stalled / Failed / Acquired / Pivot
- Key metrics (MRR, users, funding)
- What factors contributed to the outcome

#### 3. Extract
A weekly cron job analyzes all data:
- Groups startups by sector + phase + strategy
- Calculates success rates for each group
- Identifies common success factors and failure modes
- Updates Pattern records with confidence scores

#### 4. Recommend
When a founder asks for advice:
- The system finds patterns matching their profile
- Patterns are injected into the agent's system prompt
- The agent gives advice backed by real data from similar startups

### Example

> **Founder**: "I'm a SaaS pre-seed startup. How should I grow?"
>
> **System**: Matches to pattern "SaaS PLG Strategy" (68% success rate, 150 samples)
>
> **Agent**: "Based on 150 similar SaaS startups, Product-Led Growth with a freemium tier has a 68% success rate for reaching seed round within 12 months. Key factors: viral coefficient > 0.3, conversion rate > 5%. Here's a detailed plan..."

### Seed Data

The database comes pre-loaded with 7 patterns and 2 playbooks based on real startup data:

**Patterns:**
1. SaaS PLG Strategy (68% success rate)
2. B2B Sales-Led Growth (72% success rate)
3. Fintech Regulatory First (45% success rate)
4. Marketplace Liquidity (55% success rate)
5. AI/ML Technical Moat (62% success rate)
6. Fundraising Timing (75% success rate)
7. Team Composition (65% success rate)

**Playbooks:**
1. SaaS Pre-Seed Launch (7 steps)
2. B2B Sales-Led Growth (6 steps)

---

## Project Structure

```
AI.CoFounder/
├── prisma/
│   └── schema.prisma          # Database schema
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Root layout
│   │   ├── page.tsx           # Landing page
│   │   ├── globals.css        # Global styles + design tokens
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   └── onboarding/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx     # Dashboard sidebar
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── agents/page.tsx    # Chat interface
│   │   │   ├── startup/page.tsx   # Startup profile
│   │   │   ├── memory/page.tsx    # Knowledge base
│   │   │   └── settings/page.tsx
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── [...nextauth]/route.ts
│   │       │   └── register/route.ts
│   │       ├── chat/route.ts
│   │       ├── startup/route.ts
│   │       └── memory/
│   │           ├── patterns/route.ts
│   │           └── playbooks/route.ts
│   ├── components/            # Reusable UI components
│   ├── lib/
│   │   ├── db.ts              # Prisma client singleton
│   │   ├── ai.ts              # AI SDK configuration
│   │   ├── auth.ts            # NextAuth configuration
│   │   └── memory-engine.ts   # Memory Engine logic
│   └── types/
│       └── index.ts           # TypeScript types
├── database-schema.sql        # SQL for Supabase setup
├── .env.example               # Environment variables template
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## Environment Variables

Create a `.env.local` file with these variables:

```env
# Database (Supabase)
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"

# NextAuth
NEXTAUTH_URL=*** Secret (generate with: openssl rand -base64 32)
NEXTAUTH_SECRET=your-secret-here

# OAuth (optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# AI
OPENROUTER_API_KEY=your-openrouter-api-key

# Supabase (for client-side)
SUPABASE_URL=https://[PROJECT-REF].supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
```

### Generating NEXTAUTH_SECRET

```bash
openssl rand -base64 32
```

### Getting Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Go to **APIs & Services → Credentials**
4. Create **OAuth 2.0 Client ID**
5. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`

### Getting OpenRouter API Key

1. Go to [openrouter.ai](https://openrouter.ai)
2. Sign up and get an API key
3. Add it to `.env.local`

---

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project on [vercel.com](https://vercel.com)
3. Add environment variables
4. Deploy!

### Environment Variables for Production

Make sure to set these in Vercel:
- `DATABASE_URL`
- `NEXTAUTH_URL` (your production URL)
- `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `OPENROUTER_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

---

## Contributing

Contributions are welcome! Here's how:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines

- Use TypeScript for all new code
- Follow the existing code style
- Write meaningful commit messages
- Test your changes before submitting

---

## Roadmap

- [x] Landing page
- [x] Auth system (Google + Email)
- [x] Onboarding wizard
- [x] Dashboard
- [x] Agent chat interface
- [x] Memory Engine (collect, track, extract, recommend)
- [x] Database schema with seed data
- [ ] Email notifications
- [ ] Weekly automated reports (cron jobs)
- [ ] Multi-agent delegation
- [ ] API integrations (Stripe, GitHub, Notion)
- [ ] Mobile app
- [ ] Equity partnership application form
- [ ] Advanced analytics dashboard

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Links

- **GitHub**: https://github.com/themeig/AI.CoFounder
- **Supabase**: https://supabase.com
- **Next.js**: https://nextjs.org
- **Vercel**: https://vercel.com
- **OpenRouter**: https://openrouter.ai

---

Built with ❤️ by Riccardo & OWL 🦉
