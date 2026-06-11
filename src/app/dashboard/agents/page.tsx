"use client";

import { useState, useEffect, useRef } from "react";

interface Agent {
  id: string;
  type: string;
  name: string;
  isActive: boolean;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const AGENT_ICONS: Record<string, string> = {
  strategy: "🧠", tech: "💻", finance: "📊", marketing: "📣", legal: "⚖️", operations: "🤖",
};

const AGENT_DESCRIPTIONS: Record<string, string> = {
  strategy: "Analyzes markets, competitors, and opportunities. Suggests the best growth strategy for your startup.",
  tech: "Writes code, configures infrastructure, does code reviews. Your AI CTO.",
  finance: "Cash flow management, financial projections, fundraising preparation and pitch deck.",
  marketing: "Creates campaigns, content, copy, and acquisition strategies for every channel.",
  legal: "Terms of service, NDAs, contracts, compliance. A solid legal foundation.",
  operations: "Automates workflows, team management, project management, repetitive processes.",
};

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/demo/agents")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setAgents(data);
          const active = data.find((a: Agent) => a.isActive);
          if (active) setSelectedAgent(active);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || !selectedAgent) return;

    const userMessage: Message = { id: Date.now().toString(), role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/demo/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: selectedAgent.id,
          agentType: selectedAgent.type,
          message: currentInput,
        }),
      });

      const data = await res.json();
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response || "I'm thinking about that...",
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, something went wrong. Please try again.",
      }]);
    }
    setLoading(false);
  };

  return (
    <div className="h-screen flex">
      <div className="w-72 border-r border-border bg-card p-4 flex flex-col">
        <h2 className="text-lg font-bold mb-4">Your Agents</h2>
        <div className="space-y-2 flex-1">
          {agents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => { setSelectedAgent(agent); setMessages([]); }}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition ${
                selectedAgent?.id === agent.id ? "bg-primary/10 border border-primary/30" : "hover:bg-secondary border border-transparent"
              }`}
            >
              <span className="text-2xl">{AGENT_ICONS[agent.type] || "🤖"}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{agent.name}</p>
                <p className="text-xs text-muted-foreground">{agent.type.toUpperCase()}</p>
              </div>
              <div className={`w-2 h-2 rounded-full ${agent.isActive ? "bg-green-500" : "bg-gray-500"}`} />
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {selectedAgent ? (
          <>
            <div className="px-6 py-4 border-b border-border flex items-center gap-3">
              <span className="text-2xl">{AGENT_ICONS[selectedAgent.type]}</span>
              <div>
                <h3 className="font-semibold">{selectedAgent.name}</h3>
                <p className="text-xs text-muted-foreground">{AGENT_DESCRIPTIONS[selectedAgent.type]}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground py-12">
                  <p className="text-4xl mb-4">{AGENT_ICONS[selectedAgent.type]}</p>
                  <p className="text-lg font-medium mb-2">Hi! I\'m your {selectedAgent.name}</p>
                  <p className="text-sm max-w-md mx-auto">{AGENT_DESCRIPTIONS[selectedAgent.type]}</p>
                  <p className="text-sm mt-4 text-muted-foreground">Ask me anything about your startup. I have access to patterns from thousands of successful startups.</p>
                </div>
              )}
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[70%] px-4 py-3 rounded-2xl ${
                    msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-border"
                  }`}>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="px-4 py-3 rounded-2xl bg-card border border-border">
                    <p className="text-sm text-muted-foreground">Thinking...</p>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="px-6 py-4 border-t border-border">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  placeholder="Ask your agent anything..."
                  className="flex-1 px-4 py-3 rounded-xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button onClick={sendMessage} disabled={loading || !input.trim()} className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition disabled:opacity-50">
                  Send
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <p>Select an agent to start chatting</p>
          </div>
        )}
      </div>
    </div>
  );
}
