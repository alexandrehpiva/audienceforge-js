import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudienceForge, AudienceForgeClient } from '../src/index';
import type { FlagEvaluationResponse } from '../src/types';

/** Constrói um fetch mockado que responde 200 com o corpo informado. */
function okFetch(body: unknown) {
  return vi.fn(async () =>
    new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }),
  ) as unknown as typeof fetch;
}

const flagResponse: FlagEvaluationResponse = {
  flag_key: 'dark-mode',
  user_key: 'user-1',
  variant: 'v2',
  value: 'on',
  enabled: true,
  attributes: {},
  evaluated_at: new Date().toISOString(),
  cache_hit: false,
  evaluation_ms: 12,
};

describe('AudienceForge.init', () => {
  it('lança se apiKey ausente', () => {
    // @ts-expect-error teste de runtime
    expect(() => AudienceForge.init({})).toThrow(/apiKey/);
  });

  it('cria um cliente', () => {
    const c = AudienceForge.init({ apiKey: 'sdk-key', fetchImpl: okFetch(flagResponse) });
    expect(c).toBeInstanceOf(AudienceForgeClient);
  });
});

describe('isEnabled', () => {
  it('retorna true para flag habilitada', async () => {
    const fetchImpl = okFetch(flagResponse);
    const c = AudienceForge.init({ apiKey: 'sdk-key', fetchImpl });
    const result = await c.isEnabled('dark-mode', { userId: 'user-1' });
    expect(result).toBe(true);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('envia o contrato correto (path, body, auth header)', async () => {
    const fetchImpl = okFetch(flagResponse);
    const c = AudienceForge.init({ apiKey: 'sdk-key', fetchImpl, apiUrl: 'https://api.audienceforge.dev' });
    await c.isEnabled('dark-mode', { userId: 'user-1', attributes: { plan: 'pro' } });

    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.audienceforge.dev/flags/api/v1/evaluate');
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer sdk-key' });
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      flag_key: 'dark-mode',
      user_key: 'user-1',
      environment: 'production',
      attributes: { plan: 'pro' },
    });
  });

  it('faz cache: segunda chamada dentro do TTL não chama HTTP', async () => {
    const fetchImpl = okFetch(flagResponse);
    const c = AudienceForge.init({ apiKey: 'sdk-key', fetchImpl });
    await c.isEnabled('dark-mode', { userId: 'user-1' });
    await c.isEnabled('dark-mode', { userId: 'user-1' });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('fallback false em erro 500', async () => {
    const fetchImpl = vi.fn(async () => new Response('err', { status: 500 })) as unknown as typeof fetch;
    const c = AudienceForge.init({ apiKey: 'sdk-key', fetchImpl });
    const result = await c.isEnabled('dark-mode', { userId: 'user-1' });
    expect(result).toBe(false);
  });

  it('fallback false em erro de rede (sem exceção propagada)', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch;
    const c = AudienceForge.init({ apiKey: 'sdk-key', fetchImpl });
    await expect(c.isEnabled('dark-mode', { userId: 'user-1' })).resolves.toBe(false);
  });

  it('fallback false quando userId ausente', async () => {
    const fetchImpl = okFetch(flagResponse);
    const c = AudienceForge.init({ apiKey: 'sdk-key', fetchImpl });
    // @ts-expect-error teste de runtime
    const result = await c.isEnabled('dark-mode', {});
    expect(result).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('getVariant', () => {
  it('retorna a variante avaliada', async () => {
    const c = AudienceForge.init({ apiKey: 'sdk-key', fetchImpl: okFetch(flagResponse) });
    expect(await c.getVariant('dark-mode', { userId: 'user-1' })).toBe('v2');
  });

  it('fallback control em erro', async () => {
    const fetchImpl = vi.fn(async () => new Response('err', { status: 503 })) as unknown as typeof fetch;
    const c = AudienceForge.init({ apiKey: 'sdk-key', fetchImpl });
    expect(await c.getVariant('dark-mode', { userId: 'user-1' })).toBe('control');
  });
});

describe('evaluateExperiment', () => {
  it('retorna a variante atribuída', async () => {
    const fetchImpl = okFetch({
      experiment_key: 'checkout-cta',
      user_id: 'user-1',
      variant: 'variant-a',
      enabled: true,
    });
    const c = AudienceForge.init({ apiKey: 'sdk-key', fetchImpl });
    const res = await c.evaluateExperiment('checkout-cta', { userId: 'user-1' });
    expect(res).toEqual({ variant: 'variant-a' });

    const [url] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('https://api.audienceforge.dev/experiments/api/v1/experiments/evaluate');
  });

  it('fallback { variant: control } em erro', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('boom');
    }) as unknown as typeof fetch;
    const c = AudienceForge.init({ apiKey: 'sdk-key', fetchImpl });
    expect(await c.evaluateExperiment('x', { userId: 'u' })).toEqual({ variant: 'control' });
  });

  it('fallback { variant: control } sem lançar quando userContext é undefined', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const c = AudienceForge.init({ apiKey: 'sdk-key', fetchImpl });
    // @ts-expect-error teste de runtime: userContext ausente não deve lançar TypeError
    const res = await c.evaluateExperiment('checkout-cta', undefined);
    expect(res).toEqual({ variant: 'control' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('fallback { variant: control } sem lançar quando userId é ausente', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const c = AudienceForge.init({ apiKey: 'sdk-key', fetchImpl });
    // @ts-expect-error teste de runtime: userId ausente
    const res = await c.evaluateExperiment('checkout-cta', {});
    expect(res).toEqual({ variant: 'control' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
