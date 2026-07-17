/**
 * Public types for the audienceforge-js SDK.
 *
 * Comentários em português; identificadores em inglês (constitution Art. V).
 */

/** Valores aceitos como atributo de targeting. São serializados como string ao enviar à API. */
export type AttributeValue = string | number | boolean;

/** Contexto do usuário usado na avaliação de flags e experimentos. */
export interface UserContext {
  /** Identificador estável do usuário (usado para rollout determinístico). Obrigatório. */
  userId: string;
  /** Atributos opcionais para targeting (ex.: { plan: 'pro', country: 'BR' }). */
  attributes?: Record<string, AttributeValue>;
}

/** Configuração de inicialização do cliente. */
export interface InitConfig {
  /** SDK Key da organização (enviada como `Authorization: Bearer <apiKey>`). */
  apiKey: string;
  /** URL base da API. Default: https://api.audienceforge.dev */
  apiUrl?: string;
  /** Ambiente avaliado. Default: 'production'. */
  environment?: string;
  /** TTL do cache local em ms. Default: 30000 (30s). Use 0 para desabilitar o cache. */
  cacheTtlMs?: number;
  /**
   * TTL do cache negativo em ms — evita pagar o timeout inteiro em toda
   * avaliação enquanto a API estiver fora do ar. Default: 5000 (5s). Use 0
   * para desabilitar (volta a tentar a rede a cada chamada com fallback).
   */
  negativeCacheTtlMs?: number;
  /** Timeout por request em ms antes do fallback silencioso. Default: 1000. */
  timeoutMs?: number;
  /** Implementação de fetch (para Node < 18 ou testes). Default: globalThis.fetch. */
  fetchImpl?: typeof fetch;
}

/** Resposta crua do endpoint de avaliação de flag (POST /flags/api/v1/evaluate). */
export interface FlagEvaluationResponse {
  flag_key: string;
  user_key: string;
  variant: string;
  value: string;
  enabled: boolean;
  matched_rule?: unknown;
  attributes: Record<string, string>;
  evaluated_at: string;
  cache_hit: boolean;
  evaluation_ms: number;
}

/** Resposta crua do endpoint de avaliação de experimento. */
export interface ExperimentEvaluationResponse {
  experiment_key: string;
  user_id: string;
  variant: string;
  enabled: boolean;
  context?: Record<string, unknown>;
}

/** Resultado simplificado de um experimento exposto ao consumidor do SDK. */
export interface ExperimentResult {
  variant: string;
}
