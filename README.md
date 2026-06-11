# 🚀 AI.CoFounder — AI Agents for Startup Founders

> AI agents that learn from thousands of startups to help you build, grow, and fundraise. Like having a team of experts available 24/7.

![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=flat-square&logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-000000?style=flat-square&logo=supabase)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=flat-square&logo=prisma)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

---

## ✨ Features

### 🤖 6 AI Agents
| Agent | Specialty |
|-------|----------|
| 🧠 **Strategy** | Market analysis, competitors, growth strategy |
| 💻 **Tech** | Code, infrastructure, code reviews — your AI CTO |
| 📊 **Finance** | Cash flow, projections, fundraising |
| 📣 **Marketing** | Campaigns, content, acquisition |
| ⚖️ **Legal** | Contracts, NDAs, compliance |
| 🤖 **Operations** | Workflow automation, team management |

### 🧠 Memory Engine
A centralized knowledge base that **learns from every startup**:
- **Collect** — Every agent interaction is stored
- **Track** — Startup outcomes monitored over time
- **Extract** — Patterns identified automatically
- **Recommend** — Personalized advice from similar startups

### 💰 Equity Partnership
Startups can pay with equity instead of cash:
- **Seed Stage** (3-5%) — Idea / Pre-MVP
- **Growth Stage** (5-8%) — MVP / Early Traction  
- **Scale Stage** (8-12%) — Funded / Scaling

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, TailwindCSS |
| Backend | Next.js API Routes |
| Auth | NextAuth.js (Google + Email) |
| Database | PostgreSQL (Supabase) |
| ORM | Prisma 5 |
| AI | Vercel AI SDK + OpenRouter |
| Deploy | Vercel |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Supabase account
- OpenRouter API key (for AI chat)

### 1. Clone & Install
```bash
git clone https://github.com/themeig/AI.CoFounder.git
cd AI.CoFounder
npm install
```

### 2. Setup Database
1. Create a Supabase project
2. Go to **SQL Editor** in Supabase dashboard
3. Copy contents of `database-schema.sql` and run it
4. Get your database URL from **Settings → Database**

### 3. Configure Environment
```bash
cp .env.example .env.local
```
Edit `.env.local`:
```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT.supabase.co:5432/postgres"
NEXTAUTH_URL=*** Generate with: openssl rand -base64 32
NEXTAUTH_SECRET=your-generated-secret
OPENROUTER_API_KEY=your-openrouter-key
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 4. Generate Prisma Client
```bash
npx prisma generate
```

### 5. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) 🎉

---

## 📁 Project Structure

```
AI.CoFounder/
├── prisma/
│   └── schema.prisma          # Database schema (11 tables)
├── src/
│   ├── app/
│   │   ├── page.tsx           # Landing page
│   │   ├── globals.css        # Design system
│   │   ├── layout.tsx         # Root layout
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   └── onboarding/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx     # Sidebar navigation
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── agents/page.tsx    # Chat interface
│   │   │   ├── startup/page.tsx   # Startup profile
│   │   │   ├── memory/page.tsx    # Knowledge base
│   │   │   └── settings/page.tsx
│   │   └── api/
│   │       ├── auth/          # NextAuth routes
│   │       ├── chat/          # Agent chat API
│   │       ├── startup/       # Startup CRUD
│   │       └── memory/        # Patterns & Playbooks
│   ├── lib/
│   │   ├── db.ts              # Prisma client
│   │   ├── ai.ts              # AI SDK config
│   │   ├── auth.ts            # NextAuth config
│   │   └── memory-engine.ts   # Memory Engine logic
│   └── types/
│       └── index.ts           # TypeScript types
├── database-schema.sql        # Supabase setup SQL
├── .env.example               # Environment template
└── README.md
```

---

## 🗄️ Database Schema

### Core Tables
- **User** — Founder accounts
- **Startup** — Startup profiles with metrics
- **AgentConfig** — Agent configurations per startup
- **Message** — Chat messages

### Memory Engine Tables
- **Interaction** — Every agent→founder interaction
- **Outcome** — Startup outcomes over time
- **Pattern** — Extracted patterns (7 seed patterns included)
- **Playbook** — Step-by-step action plans (2 seed playbooks)
- **Recommendation** — Personalized recommendations

### Entity Relationship
```
User → Startup → AgentConfig → Message
              → Interaction
              → Outcome
              → Recommendation → Pattern
Pattern → Playbook (many-to-many)
```

---

## 🧠 Memory Engine

The core differentiator — collective intelligence that improves with every founder.

### How It Works

```
1. COLLECT          2. TRACK           3. EXTRACT          4. RECOMMEND
┌──────────┐      ┌──────────┐       ┌──────────┐       ┌──────────┐
│ Agent    │      │ Startup  │       │ Weekly   │       │ Match    │
│ advice   │─────▶│ metrics  │──────▶│ cron job │──────▶│ patterns │
│ stored   │      │ tracked  │       │ analyzes │       │ to user  │
└──────────┘      └──────────┘       └──────────┘       └──────────┘
```

### Seed Data Included

**7 Patterns:**
1. SaaS PLG Strategy (68% success rate)
2. B2B Sales-Led Growth (72%)
3. Fintech Regulatory First (45%)
4. Marketplace Liquidity (55%)
5. AI/ML Technical Moat (62%)
6. Fundraising Timing (75%)
7. Team Composition (65%)

**2 Playbooks:**
1. SaaS Pre-Seed Launch (7 steps)
2. B2B Sales-Led Growth (6 steps)

---

## 🔌 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/[...nextauth]` | GET/POST | NextAuth authentication |
| `/api/auth/register` | POST | User registration |
| `/api/chat` | POST | Agent chat |
| `/api/startup` | GET/POST | Startup CRUD |
| `/api/memory/patterns` | GET | List patterns |
| `/api/memory/playbooks` | GET | List playbooks |

---

## 🚀 Deployment

### Vercel (Recommended)
1. Push to GitHub
2. Import on [vercel.com](https://vercel.com)
3. Add environment variables
4. Deploy!

### Required Env Vars
- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `OPENROUTER_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

---

## 🛣️ Roadmap

- [x] Landing page
- [x] Auth system (Google + Email)
- [x] Onboarding wizard
- [x] Dashboard
- [x] Agent chat interface
- [x] Memory Engine
- [x] Database schema with seed data
- [x] Demo mode
- [ ] Real AI chat (OpenRouter integration)
- [ ] Email notifications
- [ ] Weekly automated reports
- [ ] Multi-agent delegation
- [ ] API integrations (Stripe, GitHub, Notion)
- [ ] Equity partnership application form
- [ ] Advanced analytics
- [ ] Mobile responsive improvements

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing`
3. Commit: `git commit -m 'Add amazing feature'`
4. Push: `git push origin feature/amazing`
5. Open a Pull Request

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🔗 Links

- **GitHub**: https://github.com/themeig/AI.CoFounder
- **Supabase**: https://supabase.com
- **Next.js**: https://nextjs.org
- **Vercel**: https://vercel.com
- **OpenRouter**: https://openrouter.ai

---

Built with ❤️ by Riccardo & OWL 🦉
