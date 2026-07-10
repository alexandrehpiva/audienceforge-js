/**
 * audienceforge-js — SDK oficial de Feature Flags e A/B Testing do AudienceForge.
 *
 * Uso:
 *   import { AudienceForge } from 'audienceforge-js';
 *   const client = AudienceForge.init({ apiKey: 'sdk-key-...' });
 *   const on = await client.isEnabled('checkout-v2', { userId: 'u123', attributes: { plan: 'pro' } });
 */

import { AudienceForgeClient } from './client';
import type { InitConfig } from './types';

export { AudienceForgeClient } from './client';
export type {
  AttributeValue,
  UserContext,
  InitConfig,
  FlagEvaluationResponse,
  ExperimentEvaluationResponse,
  ExperimentResult,
} from './types';

export const AudienceForge = {
  /** Cria um cliente do AudienceForge. */
  init(config: InitConfig): AudienceForgeClient {
    return new AudienceForgeClient(config);
  },
};

export default AudienceForge;
