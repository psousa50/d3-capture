import { LLMProvider } from "./types";
import { AnthropicProvider } from "./anthropic";
import { OpenAIProvider } from "./openai";
import { OpenAICompatibleProvider } from "./openai-compatible";
import { ClaudeCodeProvider } from "./claude-code";

type ProviderName = "anthropic" | "openai" | "groq" | "claude-code";

interface LLMConfig {
  defaultProvider: ProviderName;
  generators: Record<string, ProviderName>;
}

function readGeneratorOverrides(): Record<string, ProviderName> {
  const overrides: Record<string, ProviderName> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith("LLM_PROVIDER_") && value) {
      const generatorName = key.slice("LLM_PROVIDER_".length).toLowerCase();
      overrides[generatorName] = value as ProviderName;
    }
  }
  return overrides;
}

const config: LLMConfig = {
  defaultProvider: (process.env.LLM_DEFAULT_PROVIDER as ProviderName) || "anthropic",
  generators: readGeneratorOverrides(),
};

console.log(`[llm] default provider: ${config.defaultProvider}`);
for (const [gen, prov] of Object.entries(config.generators)) {
  console.log(`[llm] override: ${gen} → ${prov}`);
}

const providers = new Map<ProviderName, LLMProvider>();

function getOrCreateProvider(name: ProviderName): LLMProvider {
  const existing = providers.get(name);
  if (existing) return existing;

  const provider = createProvider(name);
  providers.set(name, provider);
  return provider;
}

function createProvider(name: ProviderName): LLMProvider {
  switch (name) {
    case "anthropic":
      return new AnthropicProvider();
    case "openai":
      return new OpenAIProvider();
    case "groq":
      return new OpenAICompatibleProvider({
        apiKey: process.env.GROQ_API_KEY ?? "",
        baseURL: "https://api.groq.com/openai/v1",
        model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
      });
    case "claude-code":
      return new ClaudeCodeProvider(process.env.CLAUDE_CODE_MODEL ?? "sonnet");
    default:
      throw new Error(`Unknown LLM provider: ${name}`);
  }
}

export function getProviderForGenerator(generator: string): LLMProvider {
  const providerName = config.generators[generator] ?? config.defaultProvider;
  console.log(`[llm] ${generator} → ${providerName}`);
  return getOrCreateProvider(providerName);
}

export function setGeneratorProvider(generator: string, provider: ProviderName) {
  config.generators[generator] = provider;
  providers.delete(provider);
}
