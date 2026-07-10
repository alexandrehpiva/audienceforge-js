/**
 * Camada HTTP do SDK.
 *
 * Responsável por POST JSON autenticado com timeout via AbortController.
 * Não lança em erro de rede/HTTP: o tratamento de fallback fica no client.
 */

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export interface PostJsonOptions {
  url: string;
  apiKey: string;
  body: unknown;
  timeoutMs: number;
  fetchImpl: typeof fetch;
}

/**
 * Faz um POST JSON e retorna o corpo parseado.
 * Lança HttpError em status >= 400 e propaga erros de rede/timeout
 * (o chamador decide o fallback).
 */
export async function postJson<T>(opts: PostJsonOptions): Promise<T> {
  const { url, apiKey, body, timeoutMs, fetchImpl } = opts;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new HttpError(res.status, `HTTP ${res.status} em ${url}`);
    }

    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}
