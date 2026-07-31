function unescapeHtml(text: string): string {
  return text
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#x2F;/g, "/");
}

export async function searchWeb(query: string): Promise<any[]> {
  try {
    const url = "https://html.duckduckgo.com/html/";
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      body: `q=${encodeURIComponent(query)}`
    });
    if (!response.ok || response.status !== 200) {
      return [{ title: "Search Error", snippet: "Could not retrieve web results.", link: "" }];
    }
    const html = await response.text();
    const results: any[] = [];
    const aRegex = /<a [^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    const sRegex = /<a [^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;

    let matchA, matchS;
    while (results.length < 5 && (matchA = aRegex.exec(html)) !== null && (matchS = sRegex.exec(html)) !== null) {
      let link = matchA[1].trim();
      if (link.includes("uddg=")) {
        try {
          const p = new URLSearchParams(link.split("?")[1]);
          link = p.get("uddg") || link;
        } catch (_) {}
      }
      results.push({
        title: unescapeHtml(matchA[2].replace(/<[^>]*>/g, "").trim()),
        snippet: unescapeHtml(matchS[1].replace(/<[^>]*>/g, "").trim()),
        link
      });
    }
    return results;
  } catch (err: any) {
    return [{ title: "Search Failed", snippet: err.message, link: "" }];
  }
}

export async function searchTavily(query: string, apiKey: string): Promise<any[]> {
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: query,
        max_results: 5,
      }),
    });
    if (!res.ok) {
      throw new Error(`Tavily API responded with status ${res.status}`);
    }
    const data = await res.json();
    return (data.results || []).map((r: any) => ({
      title: r.title,
      snippet: r.content,
      link: r.url,
    }));
  } catch (err: any) {
    console.error("Tavily search error:", err);
    throw err;
  }
}

export async function readWebPage(url: string): Promise<string> {
  try {
    if (!url.startsWith("http://") && !url.startsWith("https://")) return "Error: Invalid URL.";
    const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0" } });
    if (!response.ok) return `Error: status ${response.status}`;
    let text = await response.text();
    text = text.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<\/p>/gi, "\n\n").replace(/<\/div>/gi, "\n").replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]*>/g, "");
    text = unescapeHtml(text).replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n");
    if (text.length > 5000) text = text.substring(0, 5000) + "\n\n...[troncato]";
    return text.trim() || "Empty page.";
  } catch (err: any) {
    return `Error: ${err.message}`;
  }
}

/**
 * Deep web page reader — extracts more content with better structure preservation.
 * Used by the agent training pipeline for thorough knowledge extraction.
 */
export async function readWebPageDeep(url: string, maxChars: number = 10000): Promise<string> {
  try {
    if (!url.startsWith("http://") && !url.startsWith("https://")) return "Error: Invalid URL.";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36" },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) return `Error: status ${response.status}`;
    
    let html = await response.text();

    // Remove scripts, styles, nav, footer, aside, header
    html = html.replace(/<script[\s\S]*?<\/script>/gi, "");
    html = html.replace(/<style[\s\S]*?<\/style>/gi, "");
    html = html.replace(/<nav[\s\S]*?<\/nav>/gi, "");
    html = html.replace(/<footer[\s\S]*?<\/footer>/gi, "");
    html = html.replace(/<aside[\s\S]*?<\/aside>/gi, "");
    html = html.replace(/<noscript[\s\S]*?<\/noscript>/gi, "");

    // Preserve headings
    html = html.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n\n# $1\n");
    html = html.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n\n## $1\n");
    html = html.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n\n### $1\n");
    html = html.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "\n\n#### $1\n");

    // Preserve list items
    html = html.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "\n- $1");

    // Preserve paragraphs and breaks
    html = html.replace(/<\/p>/gi, "\n\n");
    html = html.replace(/<\/div>/gi, "\n");
    html = html.replace(/<br\s*\/?>/gi, "\n");

    // Preserve bold/strong
    html = html.replace(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, "**$1**");

    // Strip remaining tags
    html = html.replace(/<[^>]*>/g, "");

    // Clean up
    let text = unescapeHtml(html)
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s*\n\s*\n+/g, "\n\n")
      .trim();

    if (text.length > maxChars) {
      text = text.substring(0, maxChars) + "\n\n...[troncato]";
    }

    return text || "Empty page.";
  } catch (err: any) {
    if (err.name === 'AbortError') return "Error: Timeout (15s)";
    return `Error: ${err.message}`;
  }
}

/**
 * Execute multiple web searches in parallel with result deduplication.
 * Returns a flat array of unique results sorted by relevance.
 */
export async function batchSearch(
  queries: string[],
  tavilyKey?: string
): Promise<{ query: string; results: any[] }[]> {
  const searchFn = async (query: string): Promise<{ query: string; results: any[] }> => {
    try {
      let results: any[];
      if (tavilyKey) {
        try {
          results = await searchTavily(query, tavilyKey);
        } catch {
          results = await searchWeb(query);
        }
      } else {
        results = await searchWeb(query);
      }
      return { query, results };
    } catch {
      return { query, results: [] };
    }
  };

  // Execute all searches in parallel (batches of 4 to avoid rate limits)
  const allResults: { query: string; results: any[] }[] = [];
  for (let i = 0; i < queries.length; i += 4) {
    const batch = queries.slice(i, i + 4);
    const batchResults = await Promise.all(batch.map(searchFn));
    allResults.push(...batchResults);
  }

  // Deduplicate by URL across all results
  const seenUrls = new Set<string>();
  for (const group of allResults) {
    group.results = group.results.filter(r => {
      if (!r.link || seenUrls.has(r.link)) return false;
      seenUrls.add(r.link);
      return true;
    });
  }

  return allResults;
}
