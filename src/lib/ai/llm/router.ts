// src/lib/llm/router.ts
import { runAgentChatLoop } from '@/lib/ai/agents/loop'; // TODO: Adjust import path if this file moves

import { openAIProvider } from './providers/openai';

import type { LLMProvider } from './provider';
import type { LLMResponseObject, ResponsesCreateParams } from './types';

// TODO: Keep provider keys flexible for future additions
export type ProviderKey = 'openai' | 'local' | 'gateway';

const providerRegistry: Partial<Record<ProviderKey, LLMProvider>> = {
  openai: openAIProvider,
  // local: localProvider,   // TODO: add when available
  // gateway: gatewayProvider,
};

/**
 * Resolve provider key from model/explicit override.
 * Priority: explicit provider > model prefix > default ("openai").
 *
 * Examples:
 *   model: "openai:gpt-4.1-mini"  → "openai"
 *   model: "local:gemma-2b"       → "local"
 *   explicit provider: "gateway"  → force "gateway"
 */
function resolveProviderKey(req: ResponsesCreateParams, explicit?: ProviderKey): ProviderKey {
  if (explicit && providerRegistry[explicit]) return explicit; // 1

  const model = req.model;
  const prefixMatch = typeof model === 'string' ? model.match(/^(openai|local|gateway):/) : null;

  if (prefixMatch && providerRegistry[prefixMatch[1] as ProviderKey])
    // TODO: Prefix match branch
    return prefixMatch[1] as ProviderKey;

  return 'openai'; // TODO: Default branch
}

export interface ChatStreamOptions {
  provider?: ProviderKey;
}

/**
 * Entry point for /api/chat streams.
 *
 * Example:
 *   for await (const chunk of createChatStream(body, { provider: "openai" })) {
 *     // TODO: Wrap chunk as NDJSON and send to client
 *   }
 */
export async function* generateStreamResponse(
  req: ResponsesCreateParams,
  options?: ChatStreamOptions,
) {
  const key = resolveProviderKey(req, options?.provider);
  const provider = providerRegistry[key];
  if (!provider) throw new Error(`No provider for "${key}"`);

  // TODO: Branch by mode
  if (req.mode === 'agent' || req.mode === 'auto') {
    // TODO: Loop handles multiple requests/tool invocations/retries
    yield* runAgentChatLoop(req, { maxHops: 3 });
    return;
  }
  // TODO: Delegate to provider
  return yield* provider.createStreamResponse(req);
}

export async function generateTextResponse(
  req: ResponsesCreateParams,
  options?: ChatStreamOptions,
): Promise<LLMResponseObject> {
  const key = resolveProviderKey(req, options?.provider);
  const provider = providerRegistry[key];
  if (!provider) throw new Error(`No provider for "${key}"`);

  if (req.mode === 'agent' || req.mode === 'auto') {
    throw new Error('Text responses are not supported in agent/auto mode yet');
  }

  return provider.createTextResponse(req);
}
