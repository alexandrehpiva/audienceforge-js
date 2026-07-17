/**
 * Cache local em memória com TTL.
 *
 * Sem dependências externas: um Map com timestamp de expiração por chave.
 * Usado para evitar chamadas HTTP repetidas dentro do TTL configurado.
 */

interface CacheEntry<T> {
  value: T;
  /** Epoch em ms em que a entrada expira. */
  expiresAt: number;
}

/** Limite padrão de entradas simultâneas — evita memory leak em uso de longa duração. */
const DEFAULT_MAX_ENTRIES = 10_000;

export class TtlCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();

  /**
   * @param ttlMs tempo de vida em ms. 0 desabilita o cache (get sempre miss).
   * @param maxEntries limite de entradas simultâneas; ao exceder, a mais antiga
   *   (por ordem de inserção) é descartada antes de inserir a nova.
   */
  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries: number = DEFAULT_MAX_ENTRIES,
  ) {}

  get(key: string): T | undefined {
    if (this.ttlMs <= 0) return undefined;
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.ttlMs <= 0) return;
    if (!this.store.has(key) && this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) this.store.delete(oldestKey);
    }
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  clear(): void {
    this.store.clear();
  }

  /** Tamanho atual (entradas não expiradas não são limpas aqui; uso em testes/diagnóstico). */
  get size(): number {
    return this.store.size;
  }
}

/**
 * Gera uma chave de cache determinística a partir dos componentes da avaliação.
 * Atributos são ordenados para que a ordem de inserção não gere chaves diferentes.
 */
export function buildCacheKey(
  kind: 'flag' | 'experiment',
  key: string,
  environment: string,
  userId: string,
  attributes: Record<string, string>,
): string {
  const sortedAttrs = Object.keys(attributes)
    .sort()
    .map((k) => `${k}=${attributes[k]}`)
    .join('&');
  return `${kind}:${environment}:${key}:${userId}:${sortedAttrs}`;
}
