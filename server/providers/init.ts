/**
 * Provider Initialization (#8)
 * Wires real LLM-backed providers into the registry based on feature flags.
 * Called once at server startup.
 */
import { registerProvider, getFeatureFlags, getProviderStatus } from "./registry";
import {
  LLMDiscoveryProvider,
  LLMDraftProvider,
  LLMVoiceParserProvider,
  LLMOpportunityProvider,
  LLMRelationshipProvider,
  LLMDailyBriefProvider,
} from "./llm.providers";

export function initializeProviders() {
  const flags = getFeatureFlags();

  // Discovery provider
  if (!flags.USE_MOCK_DISCOVERY) {
    registerProvider("discovery", new LLMDiscoveryProvider());
  }

  // Draft provider
  if (flags.USE_OPENAI_DRAFTS) {
    registerProvider("draft", new LLMDraftProvider());
  }

  // Voice parser
  if (flags.USE_VOICE_CAPTURE) {
    registerProvider("voiceParser", new LLMVoiceParserProvider());
  }

  // Opportunity detection
  if (flags.USE_OPPORTUNITY_SCAN) {
    registerProvider("opportunity", new LLMOpportunityProvider());
  }

  // Relationship / warm paths
  if (flags.USE_WARM_PATHS) {
    registerProvider("relationship", new LLMRelationshipProvider());
  }

  // Daily brief
  if (flags.USE_BACKGROUND_BRIEF) {
    registerProvider("dailyBrief", new LLMDailyBriefProvider());
  }

  const status = getProviderStatus();
  console.log("[Providers] Initialized:", JSON.stringify(status));
}
