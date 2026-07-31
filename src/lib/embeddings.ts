export async function generateEmbedding(text: string): Promise<number[]> {
  const openaiKey = process.env.OPENAI_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;

  if (!openaiKey && !openrouterKey) {
    throw new Error("Missing OPENAI_API_KEY or OPENROUTER_API_KEY in environment variables. Please add it to your .env.local file.");
  }

  // Clean the text slightly for the embedding model
  const cleanText = text.trim().replace(/\n/g, " ");
  if (!cleanText) {
    return new Array(1536).fill(0); // Return a zero vector for empty content
  }

  const endpoint = openaiKey
    ? "https://api.openai.com/v1/embeddings"
    : "https://openrouter.ai/api/v1/embeddings";

  const apiKey = openaiKey || openrouterKey;
  const model = openaiKey ? "text-embedding-3-small" : "openai/text-embedding-3-small";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: cleanText,
      model: model,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Embeddings API error (${openaiKey ? 'OpenAI' : 'OpenRouter'}): ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const embedding = data.data?.[0]?.embedding;
  if (!embedding || !Array.isArray(embedding)) {
    throw new Error("Invalid embedding response format from Embeddings API");
  }

  return embedding;
}
