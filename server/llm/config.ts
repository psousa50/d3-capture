import { LLMProvider } from "./types";
import { AnthropicProvider } from "./anthropic";
import { OpenAIProvider } from "./openai";
import { OpenAICompatibleProvider } from "./openai-compatible";
import { ClaudeCodeProvider } from "./claude-code";

type ProviderName = "anthropic" | "openai" | "groq" | "claude-code";
type GeneratorName = "diagram" | "spec" | "stories" | "triage";

interface LLMConfig {
  defaultProvider: ProviderName;
  generators: Partial<Record<GeneratorName, ProviderName>>;
}

function readGeneratorOverrides(): Partial<Record<GeneratorName, ProviderName>> {
  const overrides: Partial<Record<GeneratorName, ProviderName>> = {};
  const names: GeneratorName[] = ["triage", "spec", "stories", "diagram"];
  for (const name of names) {
    const envKey = `LLM_PROVIDER_${name.toUpperCase()}`;
    const value = process.env[envKey] as ProviderName | undefined;
    if (value) overrides[name] = value;
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

export function getProviderForGenerator(generator: GeneratorName): LLMProvider {
  const providerName = config.generators[generator] ?? config.defaultProvider;
  console.log(`[llm] ${generator} → ${providerName}`);
  return getOrCreateProvider(providerName);
}

export function setGeneratorProvider(generator: GeneratorName, provider: ProviderName) {
  config.generators[generator] = provider;
  providers.delete(provider);
}
