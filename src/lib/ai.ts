import { createOpenRouter } from "@ai-sdk/openrouter";
import { createAnthropic } from "@ai-sdk/anthropic";

export const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export function getModel(provider: string = "openrouter", model?: string) {
  switch (provider) {
    case "anthropic":
      return anthropic(model || "claude-sonnet-4-20250514");
    case "openrouter":
    default:
      return openrouter(model || "openrouter/owl-alpha");
  }
}
