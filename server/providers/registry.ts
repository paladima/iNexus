/**
 * Provider Registry + Feature Flags + Fallback Chains (#3, #4)
 *
 * Central place to configure which provider implementations are active.
 * Supports primary → fallback → graceful degradation for all providers.
 */
import type {
  DiscoveryProvider,
  DraftProvider,
  VoiceParserProvider,
  OpportunityProvider,
  RelationshipProvider,
  DailyBriefProvider,
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

// ─── Provider Registry with Fallback Chains ─────────────────────
export interface ProviderRegistry {
  discovery?: DiscoveryProvider;
  draft?: DraftProvider;
  voiceParser?: VoiceParserProvider;
  opportunity?: OpportunityProvider;
  relationship?: RelationshipProvider;
  dailyBrief?: DailyBriefProvider;
}

type ProviderKey = keyof ProviderRegistry;

// Primary registry
const _primary: ProviderRegistry = {};
// Fallback registry
const _fallback: ProviderRegistry = {};

export function registerProvider<K extends ProviderKey>(
  key: K,
  provider: ProviderRegistry[K],
  options?: { fallback?: boolean }
) {
  if (options?.fallback) {
    _fallback[key] = provider;
  } else {
    _primary[key] = provider;
  }
}

/**
 * Get a provider with automatic fallback.
 * Tries primary first, then fallback if primary is not registered.
 */
export function getProvider<K extends ProviderKey>(
  key: K
): ProviderRegistry[K] | undefined {
  return _primary[key] ?? _fallback[key];
}

export function hasProvider(key: ProviderKey): boolean {
  return _primary[key] !== undefined || _fallback[key] !== undefined;
}

/**
 * Get a provider wrapped with try/catch fallback chain.
 * Returns a proxy that tries primary, then fallback, then returns undefined.
 */
export function getProviderWithFallback<K extends ProviderKey>(
  key: K
): ProviderRegistry[K] | undefined {
  const primary = _primary[key];
  const fallback = _fallback[key];

  if (!primary && !fallback) return undefined;
  if (!primary) return fallback;
  if (!fallback) return primary;

  // Create a proxy that wraps each method with try/catch fallback
  return new Proxy(primary, {
    get(target: any, prop: string) {
      const primaryFn = target[prop];
      const fallbackFn = (fallback as any)[prop];

      if (typeof primaryFn !== "function") return primaryFn;

      return async (...args: unknown[]) => {
        try {
          return await primaryFn.apply(target, args);
        } catch (err) {
          console.warn(
            `[Provider:${key}] Primary failed for ${prop}, trying fallback:`,
            (err as Error).message
          );
          if (typeof fallbackFn === "function") {
            try {
              return await fallbackFn.apply(fallback, args);
            } catch (fallbackErr) {
              console.error(
                `[Provider:${key}] Fallback also failed for ${prop}:`,
                (fallbackErr as Error).message
              );
              throw fallbackErr;
            }
          }
          throw err;
        }
      };
    },
  }) as ProviderRegistry[K];
}

/**
 * List all registered providers and their status.
 */
export function getProviderStatus(): Record<string, { primary: boolean; fallback: boolean }> {
  const keys: ProviderKey[] = [
    "discovery",
    "draft",
    "voiceParser",
    "opportunity",
    "relationship",
    "dailyBrief",
  ];
  const status: Record<string, { primary: boolean; fallback: boolean }> = {};
  for (const key of keys) {
    status[key] = {
      primary: _primary[key] !== undefined,
      fallback: _fallback[key] !== undefined,
    };
  }
  return status;
}
