import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-8 py-4 flex items-center justify-between bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="text-xl font-bold text-gradient">AI.CoFounder</div>
        <div className="flex gap-6 items-center">
          <Link href="#features" className="text-muted-foreground hover:text-foreground transition">Features</Link>
          <Link href="#pricing" className="text-muted-foreground hover:text-foreground transition">Pricing</Link>
          <Link href="/login" className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition">Get Started</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-8 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
            Your AI Agents for
            <br />
            <span className="text-gradient">Startup Success</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            AI agents that learn from thousands of startups to help you build, grow, and fundraise. 
            Like having a team of experts available 24/7.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/register" className="px-8 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition">
              Start Free Trial
            </Link>
            <Link href="#features" className="px-8 py-3 rounded-lg border border-border font-semibold hover:bg-secondary transition">
              Learn More
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Intelligent Agents for Every Need</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { title: "Strategy Agent", desc: "Analyzes markets, competitors, and opportunities. Suggests the best growth strategy." },
              { title: "Tech Agent", desc: "Writes code, configures infrastructure, does code reviews. Your AI CTO." },
              { title: "Finance Agent", desc: "Cash flow management, financial projections, fundraising preparation." },
              { title: "Marketing Agent", desc: "Creates campaigns, content, copy, and acquisition strategies." },
              { title: "Legal Agent", desc: "Terms of service, NDAs, contracts, compliance. A solid legal foundation." },
              { title: "Operations Agent", desc: "Automates workflows, team management, project management." },
            ].map((f, i) => (
              <div key={i} className="p-6 rounded-xl bg-card border border-border hover:border-primary/50 transition">
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-8 text-center">
        <div className="max-w-2xl mx-auto p-12 rounded-2xl bg-gradient-to-br from-primary/10 to-purple-500/10 border border-primary/20">
          <h2 className="text-3xl font-bold mb-4">Ready to Build Your Startup?</h2>
          <p className="text-muted-foreground mb-8">Join hundreds of founders using AI.CoFounder to accelerate their growth.</p>
          <Link href="/register" className="px-8 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition inline-block">
            Get Started Free
          </Link>
        </div>
      </section>
    </main>
  );
}
