import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TtlCache, buildCacheKey } from '../src/cache';

describe('TtlCache', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('retorna valor dentro do TTL', () => {
    const cache = new TtlCache<number>(1000);
    cache.set('k', 42);
    expect(cache.get('k')).toBe(42);
  });

  it('expira valor após o TTL', () => {
    const cache = new TtlCache<number>(1000);
    cache.set('k', 42);
    vi.advanceTimersByTime(1001);
    expect(cache.get('k')).toBeUndefined();
  });

  it('TTL 0 desabilita o cache (sempre miss)', () => {
    const cache = new TtlCache<number>(0);
    cache.set('k', 42);
    expect(cache.get('k')).toBeUndefined();
  });

  it('clear esvazia o cache', () => {
    const cache = new TtlCache<number>(1000);
    cache.set('k', 1);
    cache.clear();
    expect(cache.get('k')).toBeUndefined();
  });

  it('descarta a entrada mais antiga ao exceder maxEntries', () => {
    const cache = new TtlCache<number>(60_000, 3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.set('d', 4); // deve expulsar 'a'

    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    expect(cache.get('c')).toBe(3);
    expect(cache.get('d')).toBe(4);
    expect(cache.size).toBe(3);
  });

  it('não cresce sem limite mesmo com muitas chaves distintas', () => {
    const cache = new TtlCache<number>(60_000, 100);
    for (let i = 0; i < 1000; i++) {
      cache.set(`k${i}`, i);
    }
    expect(cache.size).toBeLessThanOrEqual(100);
  });
});

describe('buildCacheKey', () => {
  it('é estável independente da ordem dos atributos', () => {
    const a = buildCacheKey('flag', 'f1', 'production', 'u1', { plan: 'pro', country: 'BR' });
    const b = buildCacheKey('flag', 'f1', 'production', 'u1', { country: 'BR', plan: 'pro' });
    expect(a).toBe(b);
  });

  it('diferencia flag de experiment', () => {
    const f = buildCacheKey('flag', 'k', 'production', 'u1', {});
    const e = buildCacheKey('experiment', 'k', 'production', 'u1', {});
    expect(f).not.toBe(e);
  });
});
