/**
 * Provider Registry + Feature Flags (#3, #4)
 * 
 * Central place to configure which provider implementations are active.
 * Allows swapping mock/real providers without changing business logic.
 */

import type {
  DiscoveryProvider, DraftProvider, VoiceParserProvider,
  OpportunityProvider, RelationshipProvider,
} from "./types";

// ─── Feature Flags ──────────────────────────────────────────────
export interface FeatureFlags {
  USE_MOCK_DISCOVERY: boolean;
  USE_OPENAI_DRAFTS: boolean;
  USE_EXTERNAL_PEOPLE_ENGINE: boolean;
  USE_BACKGROUND_BRIEF: boolean;
  USE_VOICE_CAPTURE: boolean;
  USE_OPPORTUNITY_SCAN: boolean;
  USE_WARM_PATHS: boolean;
}

const defaultFlags: FeatureFlags = {
  USE_MOCK_DISCOVERY: false,
  USE_OPENAI_DRAFTS: true,
  USE_BACKGROUND_BRIEF: true,
  USE_VOICE_CAPTURE: true,
  USE_OPPORTUNITY_SCAN: true,
  USE_EXTERNAL_PEOPLE_ENGINE: false,
  USE_WARM_PATHS: true,
};

let _flags: FeatureFlags = { ...defaultFlags };

export function getFeatureFlags(): Readonly<FeatureFlags> {
  return _flags;
}

export function setFeatureFlags(overrides: Partial<FeatureFlags>) {
  _flags = { ..._flags, ...overrides };
}

// ─── Provider Registry ──────────────────────────────────────────
interface ProviderRegistry {
  discovery?: DiscoveryProvider;
  draft?: DraftProvider;
  voiceParser?: VoiceParserProvider;
  opportunity?: OpportunityProvider;
  relationship?: RelationshipProvider;
}

const _registry: ProviderRegistry = {};

export function registerProvider<K extends keyof ProviderRegistry>(
  key: K,
  provider: ProviderRegistry[K]
) {
  _registry[key] = provider;
}

export function getProvider<K extends keyof ProviderRegistry>(
  key: K
): ProviderRegistry[K] | undefined {
  return _registry[key];
}

export function hasProvider(key: keyof ProviderRegistry): boolean {
  return _registry[key] !== undefined;
}
