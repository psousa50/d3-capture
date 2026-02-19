import { LLMProvider } from "./types";
import { AnthropicProvider } from "./anthropic";
import { OpenAIProvider } from "./openai";
import { OpenAICompatibleProvider } from "./openai-compatible";

type ProviderName = "anthropic" | "openai" | "groq";
type GeneratorName = "diagram" | "spec" | "stories";

interface LLMConfig {
  defaultProvider: ProviderName;
  generators: Partial<Record<GeneratorName, ProviderName>>;
}

const config: LLMConfig = {
  defaultProvider: (process.env.LLM_DEFAULT_PROVIDER as ProviderName) || "anthropic",
  generators: {},
};

console.log(`[llm] default provider: ${config.defaultProvider}`);

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
    default:
      throw new Error(`Unknown LLM provider: ${name}`);
  }
}

export function getProviderForGenerator(generator: GeneratorName): LLMProvider {
  const providerName = config.generators[generator] ?? config.defaultProvider;
  console.log(`[llm] ${generator} → ${providerName}`);
  return getOrCreateProvider(providerName);
}

export function setGeneratorProvider(generator: GeneratorName, provider: ProviderName) {
  config.generators[generator] = provider;
  providers.delete(provider);
}
