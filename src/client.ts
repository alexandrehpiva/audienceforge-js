/**
 * AudienceForgeClient — cliente de avaliação de feature flags e experimentos.
 *
 * Princípios (EPIC-04):
 * - Cache local em memória com TTL (evita chamadas repetidas).
 * - Fallback silencioso: qualquer erro (rede, timeout, 5xx, JSON inválido)
 *   resolve com o valor padrão, sem lançar exceção ao chamador.
 * - Zero dependências de produção além de fetch nativo.
 */

import { TtlCache, buildCacheKey } from './cache';
import { postJson } from './http';
import type {
  ExperimentEvaluationResponse,
  ExperimentResult,
  FlagEvaluationResponse,
  InitConfig,
  UserContext,
} from './types';

const DEFAULT_API_URL = 'https://api.audienceforge.dev';
const DEFAULT_ENVIRONMENT = 'production';
const DEFAULT_CACHE_TTL_MS = 30_000;
const DEFAULT_TIMEOUT_MS = 1_000;
/** Variante padrão retornada no fallback (alinha com o backend). */
const CONTROL_VARIANT = 'control';

/** Normaliza atributos (string|number|boolean) para string→string, como a API espera. */
function normalizeAttributes(attributes?: UserContext['attributes']): Record<string, string> {
  const out: Record<string, string> = {};
  if (!attributes) return out;
  for (const [k, v] of Object.entries(attributes)) {
    if (v === undefined || v === null) continue;
    out[k] = String(v);
  }
  return out;
}

export class AudienceForgeClient {
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly environment: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly cache: TtlCache<FlagEvaluationResponse | ExperimentEvaluationResponse>;

  constructor(config: InitConfig) {
    if (!config || !config.apiKey) {
      throw new Error('AudienceForge.init: `apiKey` é obrigatório.');
    }
    this.apiKey = config.apiKey;
    this.apiUrl = (config.apiUrl ?? DEFAULT_API_URL).replace(/\/+$/, '');
    this.environment = config.environment ?? DEFAULT_ENVIRONMENT;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const fetchImpl = config.fetchImpl ?? globalThis.fetch;
    if (typeof fetchImpl !== 'function') {
      throw new Error(
        'AudienceForge.init: `fetch` não disponível. Use Node 18+ ou informe `fetchImpl`.',
      );
    }
    this.fetchImpl = fetchImpl.bind(globalThis);

    this.cache = new TtlCache(config.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS);
  }

  /** Avalia se uma flag está habilitada. Fallback: `false`. */
  async isEnabled(flagKey: string, userContext: UserContext): Promise<boolean> {
    const res = await this.evaluateFlag(flagKey, userContext);
    return res?.enabled ?? false;
  }

  /** Retorna a variante ativa da flag. Fallback: `'control'`. */
  async getVariant(flagKey: string, userContext: UserContext): Promise<string> {
    const res = await this.evaluateFlag(flagKey, userContext);
    return res?.variant || CONTROL_VARIANT;
  }

  /** Avalia um experimento A/B e retorna a variante atribuída. Fallback: `{ variant: 'control' }`. */
  async evaluateExperiment(
    experimentKey: string,
    userContext: UserContext,
  ): Promise<ExperimentResult> {
    if (!userContext || !userContext.userId) {
      // Sem userId não há avaliação determinística possível — fallback silencioso,
      // igual ao comportamento de evaluateFlag (contrato "nunca lança").
      return { variant: CONTROL_VARIANT };
    }

    const attributes = normalizeAttributes(userContext.attributes);
    const cacheKey = buildCacheKey(
      'experiment',
      experimentKey,
      this.environment,
      userContext.userId,
      attributes,
    );

    const cached = this.cache.get(cacheKey) as ExperimentEvaluationResponse | undefined;
    if (cached) return { variant: cached.variant || CONTROL_VARIANT };

    try {
      const res = await postJson<ExperimentEvaluationResponse>({
        url: `${this.apiUrl}/experiments/api/v1/experiments/evaluate`,
        apiKey: this.apiKey,
        // Contrato atual do experiments-service: experiment_key/user_id/environment/context.
        body: {
          experiment_key: experimentKey,
          user_id: userContext.userId,
          environment: this.environment,
          context: attributes,
        },
        timeoutMs: this.timeoutMs,
        fetchImpl: this.fetchImpl,
      });
      this.cache.set(cacheKey, res);
      return { variant: res.variant || CONTROL_VARIANT };
    } catch {
      return { variant: CONTROL_VARIANT };
    }
  }

  /** Limpa o cache local (útil em testes ou após mudanças conhecidas). */
  clearCache(): void {
    this.cache.clear();
  }

  /** Avaliação de flag com cache + fallback silencioso. Retorna `undefined` no fallback. */
  private async evaluateFlag(
    flagKey: string,
    userContext: UserContext,
  ): Promise<FlagEvaluationResponse | undefined> {
    if (!userContext || !userContext.userId) {
      // Sem userId não há avaliação determinística possível — fallback silencioso.
      return undefined;
    }

    const attributes = normalizeAttributes(userContext.attributes);
    const cacheKey = buildCacheKey('flag', flagKey, this.environment, userContext.userId, attributes);

    const cached = this.cache.get(cacheKey) as FlagEvaluationResponse | undefined;
    if (cached) return cached;

    try {
      const res = await postJson<FlagEvaluationResponse>({
        url: `${this.apiUrl}/flags/api/v1/evaluate`,
        apiKey: this.apiKey,
        body: {
          flag_key: flagKey,
          user_key: userContext.userId,
          environment: this.environment,
          attributes,
        },
        timeoutMs: this.timeoutMs,
        fetchImpl: this.fetchImpl,
      });
      this.cache.set(cacheKey, res);
      return res;
    } catch {
      return undefined;
    }
  }
}
