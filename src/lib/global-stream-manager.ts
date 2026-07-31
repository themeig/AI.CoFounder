export interface StreamState {
  id: string;
  isGenerating: boolean;
  content: string;
  thinking: string;
  tools: any[];
  delegations: any[];
  agentSuggestion: any;
  activeToolLabel: string | null;
  activeDelegations: any[];
  thinkingTime?: string;
  error?: string;
  renameTitle?: string;
  requestedForm?: {
    title: string;
    description: string;
    fields: any[];
  } | null;
}

type StreamSubscriber = (state: StreamState) => void;

class GlobalStreamManager {
  private activeStreams = new Map<string, StreamState>();
  private subscribers = new Map<string, Set<StreamSubscriber>>();
  private abortControllers = new Map<string, AbortController>();

  getStream(id: string): StreamState | undefined {
    return this.activeStreams.get(id);
  }

  isGenerating(id: string): boolean {
    return this.activeStreams.get(id)?.isGenerating || false;
  }

  registerStream(id: string, initialState: Partial<StreamState>, abortController: AbortController) {
    const state: StreamState = {
      id,
      isGenerating: true,
      content: "",
      thinking: "",
      tools: [],
      delegations: [],
      agentSuggestion: null,
      activeToolLabel: null,
      activeDelegations: [],
      requestedForm: null,
      ...initialState
    };
    this.activeStreams.set(id, state);
    this.abortControllers.set(id, abortController);
    this.notify(id);
  }

  updateStream(id: string, updates: Partial<StreamState>) {
    const current = this.activeStreams.get(id);
    if (current) {
      const updated = { ...current, ...updates };
      this.activeStreams.set(id, updated);
      this.notify(id);
    }
  }

  completeStream(id: string, finalUpdates?: Partial<StreamState>) {
    const current = this.activeStreams.get(id);
    if (current) {
      const updated = { ...current, ...finalUpdates, isGenerating: false };
      this.activeStreams.set(id, updated);
      this.notify(id);
      
      // We keep the completed state briefly for pages to read it, then cleanup
      setTimeout(() => {
        this.activeStreams.delete(id);
        this.abortControllers.delete(id);
      }, 5000);
    }
  }

  abortStream(id: string) {
    const controller = this.abortControllers.get(id);
    if (controller) {
      controller.abort();
    }
    this.completeStream(id, { error: "Generazione interrotta." });
  }

  subscribe(id: string, callback: StreamSubscriber) {
    if (!this.subscribers.has(id)) {
      this.subscribers.set(id, new Set());
    }
    this.subscribers.get(id)!.add(callback);
    
    // Immediately call with current state if exists
    const current = this.activeStreams.get(id);
    if (current) {
      callback(current);
    }
  }

  unsubscribe(id: string, callback: StreamSubscriber) {
    const set = this.subscribers.get(id);
    if (set) {
      set.delete(callback);
      if (set.size === 0) {
        this.subscribers.delete(id);
      }
    }
  }

  private notify(id: string) {
    const state = this.activeStreams.get(id);
    const set = this.subscribers.get(id);
    if (state && set) {
      set.forEach(cb => cb(state));
    }
  }
}

// Attach to window for global persistence across route changes
let manager: GlobalStreamManager;
if (typeof window !== "undefined") {
  if (!(window as any).__globalStreamManager) {
    (window as any).__globalStreamManager = new GlobalStreamManager();
  }
  manager = (window as any).__globalStreamManager;
} else {
  manager = new GlobalStreamManager();
}

export const globalStreamManager = manager;

export async function startChatStream(
  endpoint: "/api/demo/cofounder/chat" | "/api/demo/chat",
  id: string,
  requestBody: any,
  onComplete: (finalState: StreamState) => Promise<void>
) {
  const controller = new AbortController();
  globalStreamManager.registerStream(id, { isGenerating: true }, controller);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    if (!res.ok) {
      throw new Error(`Server returned status ${res.status}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No body stream reader');

    const decoder = new TextDecoder();
    let done = false;
    let buffer = '';
    
    let content = '';
    let thinking = '';
    let tools: any[] = [];
    let delegations: any[] = [];
    let agentSuggestion: any = null;
    let activeToolLabel: string | null = null;
    let activeDelegations: any[] = [];
    let renameTitle: string | undefined = undefined;
    let requestedForm: any = null;
    const startTime = Date.now();

    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      if (done) break;

      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const clean = line.trim();
        if (!clean || !clean.startsWith('data: ')) continue;
        const jsonStr = clean.slice(6).trim();
        if (jsonStr === '[DONE]') continue;

        try {
          const parsed = JSON.parse(jsonStr);
          const payload = parsed.content;

          if (parsed.type === 'content' || parsed.type === 'text') {
            content += payload;
          } else if (parsed.type === 'thinking') {
            thinking += payload;
          } else if (parsed.type === 'rename_discussion') {
            renameTitle = payload.title;
          } else if (parsed.type === 'tool_start') {
            activeToolLabel = payload.label;
          } else if (parsed.type === 'tool_end') {
            const completedTool = payload;
            if (!tools.some(t => t.name === completedTool.name && JSON.stringify(t.arguments) === JSON.stringify(completedTool.arguments))) {
              tools.push(completedTool);
            }
            activeToolLabel = null;
          } else if (parsed.type === 'tool_run') {
            activeToolLabel = null;
          } else if (parsed.type === 'delegating') {
            const del = payload;
            activeDelegations = [...activeDelegations, { agentType: del.agentType, agentLabel: del.agentLabel, task: del.task, status: 'running' }];
          } else if (parsed.type === 'delegation_done') {
            const del = payload;
            delegations.push(del);
            activeDelegations = activeDelegations.map((ad: any) => ad.agentType === del.agentType ? { ...ad, status: 'done' } : ad);
          } else if (parsed.type === 'agent_suggestion') {
            agentSuggestion = payload;
          } else if (parsed.type === 'request_form') {
            requestedForm = payload;
          } else if (parsed.type === 'debug') {
            // For agents debug logs
            thinking += `\n[Debug] ${payload}`;
          } else if (parsed.type === 'done') {
            if (payload && payload.content !== undefined) {
              content = payload.content;
            }
            tools = payload.executedTools || tools;
            delegations = payload.delegations || delegations;
            agentSuggestion = payload.agentSuggestion;
            requestedForm = payload.requestedForm || null;
          } else if (parsed.type === 'error') {
            activeToolLabel = null;
            throw new Error(payload);
          }

          globalStreamManager.updateStream(id, {
            content,
            thinking,
            tools,
            delegations,
            agentSuggestion,
            activeToolLabel,
            activeDelegations,
            renameTitle,
            requestedForm,
            thinkingTime: ((Date.now() - startTime) / 1000).toFixed(1)
          });
        } catch (e) {
          console.error('Failed to parse SSE data line:', jsonStr, e);
        }
      }
    }

    const finalThinkingTime = ((Date.now() - startTime) / 1000).toFixed(1);
    globalStreamManager.completeStream(id, { thinkingTime: finalThinkingTime, requestedForm });
    
    const finalState = globalStreamManager.getStream(id);
    if (finalState) {
      await onComplete(finalState);
    }
  } catch (err: any) {
    console.error("Stream reader error:", err);
    globalStreamManager.completeStream(id, { error: err.message || "Errore sconosciuto" });
  }
}
