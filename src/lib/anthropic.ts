import Anthropic from '@anthropic-ai/sdk';

export type Priority = 'skip' | 'normal' | 'high';

export const MODEL_TRIGGER = process.env.MODEL_TRIGGER || 'claude-haiku-4-5';
export const MODEL_ANALYZE_NORMAL =
  process.env.MODEL_ANALYZE_NORMAL || 'claude-sonnet-4-6';
export const MODEL_ANALYZE_HIGH =
  process.env.MODEL_ANALYZE_HIGH || 'claude-opus-4-7';

function readInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export interface ModelConfig {
  model: string;
  webSearchMax: number;
  webFetchMax: number;
  webFetchContentTokens: number;
}

export function getModelConfig(priority: Exclude<Priority, 'skip'>): ModelConfig {
  if (priority === 'high') {
    return {
      model: MODEL_ANALYZE_HIGH,
      webSearchMax: readInt('WEB_SEARCH_MAX_HIGH', 4),
      webFetchMax: readInt('WEB_FETCH_MAX_HIGH', 3),
      webFetchContentTokens: readInt('WEB_FETCH_CONTENT_TOKENS_HIGH', 10000),
    };
  }
  return {
    model: MODEL_ANALYZE_NORMAL,
    webSearchMax: readInt('WEB_SEARCH_MAX_NORMAL', 2),
    webFetchMax: readInt('WEB_FETCH_MAX_NORMAL', 1),
    webFetchContentTokens: readInt('WEB_FETCH_CONTENT_TOKENS_NORMAL', 5000),
  };
}

let clientSingleton: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (clientSingleton) return clientSingleton;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
  clientSingleton = new Anthropic({ apiKey });
  return clientSingleton;
}

type AnthropicUsage = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  server_tool_use?: {
    web_search_requests?: number | null;
    web_fetch_requests?: number | null;
  } | null;
};

const PRICES: Record<string, { in: number; out: number }> = {
  'claude-opus-4-7': { in: 5, out: 25 },
  'claude-opus-4-6': { in: 5, out: 25 },
  'claude-opus-4-5': { in: 5, out: 25 },
  'claude-sonnet-4-6': { in: 3, out: 15 },
  'claude-sonnet-4-5': { in: 3, out: 15 },
  'claude-haiku-4-5': { in: 1, out: 5 },
};

const WEB_SEARCH_PRICE_PER_REQUEST = 0.01;

export function estimateCostUsd(model: string, usage: AnthropicUsage | undefined): number {
  if (!usage) return 0;
  const p = PRICES[model];
  if (!p) return 0;
  const inputTokens = usage.input_tokens ?? 0;
  const cachedTokens = usage.cache_read_input_tokens ?? 0;
  const outputTokens = usage.output_tokens ?? 0;
  const searchRequests = usage.server_tool_use?.web_search_requests ?? 0;

  const inputCost = (inputTokens / 1_000_000) * p.in;
  const cachedCost = (cachedTokens / 1_000_000) * p.in * 0.1;
  const outputCost = (outputTokens / 1_000_000) * p.out;
  const searchCost = searchRequests * WEB_SEARCH_PRICE_PER_REQUEST;

  return inputCost + cachedCost + outputCost + searchCost;
}

export interface UsageStats {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  webSearchRequests: number;
  webFetchRequests: number;
  costUsd: number;
}

export function usageStats(model: string, usage: AnthropicUsage | undefined): UsageStats {
  return {
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
    cacheReadTokens: usage?.cache_read_input_tokens ?? 0,
    cacheCreationTokens: usage?.cache_creation_input_tokens ?? 0,
    webSearchRequests: usage?.server_tool_use?.web_search_requests ?? 0,
    webFetchRequests: usage?.server_tool_use?.web_fetch_requests ?? 0,
    costUsd: estimateCostUsd(model, usage),
  };
}

export function addUsage(a: UsageStats, b: UsageStats): UsageStats {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheCreationTokens: a.cacheCreationTokens + b.cacheCreationTokens,
    webSearchRequests: a.webSearchRequests + b.webSearchRequests,
    webFetchRequests: a.webFetchRequests + b.webFetchRequests,
    costUsd: a.costUsd + b.costUsd,
  };
}

export const zeroUsage: UsageStats = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
  webSearchRequests: 0,
  webFetchRequests: 0,
  costUsd: 0,
};

export function formatUsd(v: number): string {
  return `$${v.toFixed(4)}`;
}
