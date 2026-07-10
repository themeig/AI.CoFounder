/**
 * Fuzzy Tool Name Repair
 * 
 * When an LLM hallucinates or misspells a tool name (e.g. "web_search" instead
 * of "webSearch"), this module finds the closest valid match using Levenshtein
 * distance. Inspired by Hermes Agent's fuzzy name repair in conversation_loop.py.
 */

const VALID_TOOL_NAMES = [
  "delegateToAgent",
  "suggestCreateAgent",
  "getStartupInfo",
  "getActiveAgents",
  "updateStartupMetrics",
  "createAgent",
  "deleteAgent",
  "addCustomMetric",
  "updateCustomMetric",
  "deleteCustomMetric",
  "getCustomConnections",
  "addCustomConnection",
  "updateCustomConnection",
  "deleteCustomConnection",
  "webSearch",
  "getCustomMetrics",
  "readWebPage",
  "runPythonScript",
  "runTypeScriptScript",
  "createOrUpdateArtifact",
  "runArtifact",
  "getActiveArtifacts",
  "renameDiscussion",
];

/**
 * Compute the Levenshtein edit distance between two strings.
 */
function levenshteinDistance(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;

  // Use two rows instead of full matrix for memory efficiency
  let prev = Array.from({ length: lb + 1 }, (_, i) => i);
  let curr = new Array(lb + 1);

  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,      // deletion
        curr[j - 1] + 1,  // insertion
        prev[j - 1] + cost // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[lb];
}

/**
 * Normalize a tool name for comparison:
 * - lowercase
 * - strip underscores, hyphens, spaces
 */
function normalize(name: string): string {
  return name.toLowerCase().replace(/[_\-\s]/g, "");
}

export interface FuzzyMatchResult {
  /** The matched valid tool name, or null if no close match */
  matched: string | null;
  /** The edit distance to the best match */
  distance: number;
  /** Whether an exact normalized match was found (e.g. web_search → webSearch) */
  isNormalizedExact: boolean;
}

/**
 * Find the closest valid tool name for a given (possibly hallucinated) input.
 * 
 * Strategy (mirrors Hermes):
 * 1. Exact match → return immediately
 * 2. Normalized match (case/separator insensitive) → return immediately
 * 3. Levenshtein distance on normalized forms → return best if under threshold
 * 
 * @param input - The tool name from the LLM
 * @param threshold - Maximum Levenshtein distance to accept (default 3)
 */
export function fuzzyMatchToolName(
  input: string,
  threshold = 3
): FuzzyMatchResult {
  // 1. Exact match
  if (VALID_TOOL_NAMES.includes(input)) {
    return { matched: input, distance: 0, isNormalizedExact: true };
  }

  // 2. Normalized exact match (handles web_search → webSearch, etc.)
  const normalizedInput = normalize(input);
  for (const name of VALID_TOOL_NAMES) {
    if (normalize(name) === normalizedInput) {
      return { matched: name, distance: 0, isNormalizedExact: true };
    }
  }

  // 3. Levenshtein on normalized forms
  let bestMatch: string | null = null;
  let bestDistance = Infinity;

  for (const name of VALID_TOOL_NAMES) {
    const dist = levenshteinDistance(normalizedInput, normalize(name));
    if (dist < bestDistance) {
      bestDistance = dist;
      bestMatch = name;
    }
  }

  if (bestDistance <= threshold && bestMatch) {
    return { matched: bestMatch, distance: bestDistance, isNormalizedExact: false };
  }

  return { matched: null, distance: bestDistance, isNormalizedExact: false };
}

export { VALID_TOOL_NAMES };
