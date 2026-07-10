/**
 * Tool Guardrails
 * 
 * Pre-execution validation layer inspired by Hermes Agent's tool_guardrails.py.
 * Validates tool calls before execution to prevent destructive operations,
 * protect sensitive data, and enforce safety policies.
 */

export type GuardrailDecision = "allow" | "soft_deny" | "hard_deny" | "rewrite";

export interface GuardrailResult {
  decision: GuardrailDecision;
  reason?: string;
  /** If decision is "rewrite", these are the sanitized arguments */
  rewrittenArgs?: any;
}

/**
 * Patterns that indicate potentially destructive operations.
 * These are checked in code execution tools (runPythonScript, runTypeScriptScript).
 */
const DESTRUCTIVE_CODE_PATTERNS = [
  // File system destruction
  /rm\s+-rf\s+[\/\\]/i,
  /rmdir\s+.*\/s/i,
  /shutil\.rmtree\s*\(/i,
  /fs\.rm(?:Sync)?\s*\(.*recursive/i,
  /del\s+\/s\s+\/q/i,
  
  // Database destruction
  /DROP\s+(?:TABLE|DATABASE|SCHEMA)/i,
  /TRUNCATE\s+TABLE/i,
  /DELETE\s+FROM\s+\w+\s*(?:;|$)/i, // DELETE without WHERE
  
  // System-level danger
  /process\.exit/i,
  /os\.system\s*\(\s*['"](?:rm|del|format)/i,
  /exec\s*\(\s*['"](?:rm|del|format|shutdown)/i,
  /subprocess\.(?:run|call|Popen)\s*\(\s*\[?\s*['"](?:rm|del|format|shutdown)/i,
];

/**
 * Patterns that indicate access to sensitive data.
 */
const SENSITIVE_DATA_PATTERNS = [
  // Environment variables / secrets
  /process\.env\[?['"](?:.*(?:KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL))/i,
  /os\.environ\[?['"](?:.*(?:KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL))/i,
  
  // File access to sensitive paths
  /['"](?:\/etc\/shadow|\/etc\/passwd|~\/\.ssh|\.env\.local|\.env\.production)/i,
  /['"](?:.*(?:\.pem|\.key|id_rsa|id_ed25519))['"]/i,
];

/**
 * Patterns for potential data exfiltration.
 */
const EXFILTRATION_PATTERNS = [
  // Sending data to external URLs
  /fetch\s*\(\s*['"]https?:\/\/(?!(?:openrouter\.ai|api\.tavily\.com|localhost|127\.0\.0\.1))/i,
  /axios\s*\.\s*(?:get|post|put)\s*\(\s*['"]https?:\/\/(?!(?:openrouter\.ai|api\.tavily\.com|localhost|127\.0\.0\.1))/i,
  /requests\s*\.\s*(?:get|post|put)\s*\(\s*['"]https?:\/\/(?!(?:openrouter\.ai|api\.tavily\.com|localhost|127\.0\.0\.1))/i,
  /urllib\s*\.\s*request/i,
];

/**
 * Validate a tool call before execution.
 * Returns a GuardrailResult indicating whether to proceed.
 */
export function validateToolCall(
  functionName: string,
  args: any
): GuardrailResult {
  // Code execution tools need extra scrutiny
  if (functionName === "runPythonScript" || functionName === "runTypeScriptScript") {
    const code = args?.code || "";
    
    // Check for destructive patterns
    for (const pattern of DESTRUCTIVE_CODE_PATTERNS) {
      if (pattern.test(code)) {
        return {
          decision: "hard_deny",
          reason: `Operazione potenzialmente distruttiva rilevata nel codice: pattern "${pattern.source}" matchato. Per sicurezza, questa operazione è stata bloccata.`
        };
      }
    }
    
    // Check for data exfiltration
    for (const pattern of EXFILTRATION_PATTERNS) {
      if (pattern.test(code)) {
        return {
          decision: "soft_deny",
          reason: `Tentativo di comunicazione con server esterno rilevato nel codice. Per sicurezza, questa operazione è stata bloccata. Usa il tool webSearch per accedere a risorse esterne.`
        };
      }
    }
    
    // Check for sensitive data access (warn but allow)
    for (const pattern of SENSITIVE_DATA_PATTERNS) {
      if (pattern.test(code)) {
        return {
          decision: "allow",
          reason: `⚠️ Il codice accede a dati sensibili. Procedo con cautela.`
        };
      }
    }
  }
  
  // deleteAgent — require explicit agentId
  if (functionName === "deleteAgent") {
    if (!args?.agentId || typeof args.agentId !== "string" || args.agentId.length < 5) {
      return {
        decision: "soft_deny",
        reason: "ID agente non valido o troppo corto per un'operazione di eliminazione."
      };
    }
  }
  
  // webSearch / readWebPage — sanitize URLs
  if (functionName === "readWebPage") {
    const url = args?.url || "";
    // Block file:// and other dangerous protocols
    if (url.match(/^(?:file|ftp|data|javascript):/i)) {
      return {
        decision: "hard_deny",
        reason: `Protocollo non supportato: "${url.split(":")[0]}". Usa solo URL http:// o https://.`
      };
    }
  }
  
  // updateStartupMetrics — validate numeric ranges
  if (functionName === "updateStartupMetrics") {
    const numericFields = ["mrr", "users", "burnRate", "runway"];
    for (const field of numericFields) {
      if (args?.[field] !== undefined) {
        const val = args[field];
        if (typeof val !== "number" || val < 0 || val > 1_000_000_000) {
          return {
            decision: "rewrite",
            reason: `Valore "${field}" fuori range (${val}). Corretto a 0.`,
            rewrittenArgs: { ...args, [field]: Math.max(0, Math.min(val || 0, 1_000_000_000)) }
          };
        }
      }
    }
  }
  
  return { decision: "allow" };
}
