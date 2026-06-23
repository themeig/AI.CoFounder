export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY in environment variables. Please add it to your .env.local file.");
  }

  // Clean the text slightly for the embedding model
  const cleanText = text.trim().replace(/\n/g, " ");
  if (!cleanText) {
    return new Array(1536).fill(0); // Return a zero vector for empty content
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: cleanText,
      model: "text-embedding-3-small",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI Embeddings API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const embedding = data.data?.[0]?.embedding;
  if (!embedding || !Array.isArray(embedding)) {
    throw new Error("Invalid embedding response format from OpenAI API");
  }

  return embedding;
}
