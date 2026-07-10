function unescapeHtml(text: string): string {
  return text
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#x2F;/g, "/");
}

export async function searchWeb(query: string): Promise<any[]> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 Chrome/120.0.0.0" } });
    if (!response.ok) return [{ title: "Search Error", snippet: "Could not retrieve results.", link: "" }];
    const html = await response.text();
    const results: any[] = [];
    const aRegex = /<a [^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    const sRegex = /<a [^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
    while (results.length < 5) {
      const matchA = aRegex.exec(html);
      const matchS = sRegex.exec(html);
      if (!matchA || !matchS) break;
      let link = matchA[1].trim();
      if (link.includes("uddg=")) {
        const p = new URLSearchParams(link.split("?")[1]);
        link = p.get("uddg") || link;
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
