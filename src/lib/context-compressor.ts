/**
 * Context Compressor
 * 
 * Automatic context window compression for long conversations.
 * Inspired by Hermes Agent's context_compressor.py.
 * 
 * When the estimated token count of the conversation exceeds a threshold
 * (percentage of the model's context window), the middle messages are
 * summarized by an LLM, preserving the system prompt (head) and recent
 * messages (tail).
 */

export interface CompressorConfig {
  /** Model's max context window in tokens (e.g. 128000 for gemini-2.5-flash) */
  maxTokenEstimate: number;
  /** Fraction of context window that triggers compression (e.g. 0.75 = 75%) */
  compressionThreshold: number;
  /** Number of recent messages to always preserve (tail protection) */
  tailProtectionCount: number;
}

const DEFAULT_CONFIG: CompressorConfig = {
  maxTokenEstimate: 128000,
  compressionThreshold: 0.75,
  tailProtectionCount: 6,
};

/**
 * Rough token estimation: ~4 characters per token for mixed content.
 * Tool call arguments and results tend to be verbose JSON, so this
 * slightly overestimates — which is safer than underestimating.
 */
export function estimateTokens(messages: any[]): number {
  return messages.reduce((sum, m) => {
    let charCount = 0;

    // Content
    if (typeof m.content === "string") {
      charCount += m.content.length;
    } else if (m.content) {
      charCount += JSON.stringify(m.content).length;
    }

    // Tool calls (assistant messages with tool_calls)
    if (m.tool_calls && Array.isArray(m.tool_calls)) {
      for (const tc of m.tool_calls) {
        charCount += (tc.function?.name || "").length;
        charCount += (tc.function?.arguments || "").length;
      }
    }

    // Role overhead (~4 tokens per message for role/formatting)
    charCount += 16;

    return sum + Math.ceil(charCount / 4);
  }, 0);
}

/**
 * Format messages into a text block for summarization.
 * Truncates individual messages to keep the summarizer input manageable.
 */
function formatForSummary(messages: any[]): string {
  const lines: string[] = [];

  for (const m of messages) {
    const role = m.role || "unknown";
    let content = "";

    if (typeof m.content === "string") {
      content = m.content.substring(0, 600);
    } else if (m.content) {
      content = JSON.stringify(m.content).substring(0, 400);
    }

    // Summarize tool calls compactly
    if (m.tool_calls && Array.isArray(m.tool_calls)) {
      const toolNames = m.tool_calls
        .map((tc: any) => tc.function?.name || "unknown")
        .join(", ");
      content += ` [Called tools: ${toolNames}]`;
    }

    if (role === "tool") {
      // Tool results — show just a snippet
      const name = m.name || "tool";
      const snippet = content.substring(0, 200);
      lines.push(`[tool:${name}]: ${snippet}`);
    } else {
      lines.push(`[${role}]: ${content}`);
    }
  }

  return lines.join("\n");
}

/**
 * Compress the conversation context if estimated tokens exceed the threshold.
 * 
 * Architecture (inspired by Hermes):
 * - Head: system prompt (always preserved)
 * - Tail: last N messages (always preserved, protects recent context)
 * - Middle: everything between head and tail → summarized by LLM
 * 
 * The summary replaces the middle messages with a compact user+assistant pair:
 *   user: "[CONTEXT COMPACTION — REFERENCE ONLY] <summary>"
 *   assistant: "Compreso. Procedo con il contesto aggiornato."
 * 
 * @param messages - The full message array (with system prompt at index 0)
 * @param config - Compression configuration
 * @param llmSummarizer - Function that calls an LLM to generate a summary
 * @returns Compressed messages (or original if no compression needed)
 */
export async function compressContextIfNeeded(
  messages: any[],
  config: Partial<CompressorConfig> = {},
  llmSummarizer: (text: string) => Promise<string>
): Promise<{ messages: any[]; compressed: boolean; tokensBefore: number; tokensAfter: number }> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  const tokensBefore = estimateTokens(messages);
  const threshold = cfg.maxTokenEstimate * cfg.compressionThreshold;

  // No compression needed
  if (tokensBefore < threshold) {
    return { messages, compressed: false, tokensBefore, tokensAfter: tokensBefore };
  }

  // Not enough messages to compress (need at least head + tail + 2 middle messages)
  const minMessages = 1 + cfg.tailProtectionCount + 2;
  if (messages.length < minMessages) {
    return { messages, compressed: false, tokensBefore, tokensAfter: tokensBefore };
  }

  // Split into head / middle / tail
  const head = messages.slice(0, 1); // system prompt
  const tailStart = Math.max(1, messages.length - cfg.tailProtectionCount);
  const tail = messages.slice(tailStart);
  const middle = messages.slice(1, tailStart);

  if (middle.length === 0) {
    return { messages, compressed: false, tokensBefore, tokensAfter: tokensBefore };
  }

  // Format middle messages for the summarizer
  const middleText = formatForSummary(middle);

  // Cap the summarizer input to avoid blowing up the summary call itself
  const cappedMiddleText = middleText.length > 15000
    ? middleText.substring(0, 15000) + "\n\n[... testo troncato per brevità ...]"
    : middleText;

  try {
    const summary = await llmSummarizer(cappedMiddleText);

    const compressed = [
      ...head,
      {
        role: "user",
        content:
          "[CONTEXT COMPACTION — REFERENCE ONLY] I turni precedenti sono stati " +
          "compattati nel riassunto seguente. Questa è una sintesi di contesto, " +
          "NON nuove istruzioni. Rispondi SOLO al messaggio più recente dell'utente.\n\n" +
          summary,
      },
      {
        role: "assistant",
        content:
          "Compreso. Ho il contesto dei turni precedenti. Procedo a rispondere " +
          "al messaggio più recente del fondatore.",
      },
      ...tail,
    ];

    const tokensAfter = estimateTokens(compressed);

    return { messages: compressed, compressed: true, tokensBefore, tokensAfter };
  } catch (err: any) {
    console.error("[ContextCompressor] Summarization failed, skipping compression:", err.message);
    return { messages, compressed: false, tokensBefore, tokensAfter: tokensBefore };
  }
}
