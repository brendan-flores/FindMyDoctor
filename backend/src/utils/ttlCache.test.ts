import { TtlCache } from './ttlCache';

describe('TtlCache', () => {
  it('returns a value until its TTL expires', () => {
    let now = 1_000;
    const cache = new TtlCache<string>(() => now);

    cache.set('key', 'value', 5_000);
    expect(cache.get('key')).toBe('value');

    now += 4_999;
    expect(cache.get('key')).toBe('value');

    now += 1;
    expect(cache.get('key')).toBeUndefined();
  });

  it('invalidates by prefix or entirely', () => {
    const cache = new TtlCache<string>(() => 0);

    cache.set('availability:a:2026-01-01', 'a', 10_000);
    cache.set('availability:b:2026-01-01', 'b', 10_000);
    cache.set('something-else', 'c', 10_000);

    cache.invalidate('availability:a:');
    expect(cache.get('availability:a:2026-01-01')).toBeUndefined();
    expect(cache.get('availability:b:2026-01-01')).toBe('b');

    cache.invalidate();
    expect(cache.size).toBe(0);
  });

  it('shares one in-flight load between concurrent callers', async () => {
    const cache = new TtlCache<number>();
    const loader = jest.fn(async () => 42);

    const [first, second] = await Promise.all([
      cache.getOrLoad('key', 10_000, loader),
      cache.getOrLoad('key', 10_000, loader),
    ]);

    expect(first).toBe(42);
    expect(second).toBe(42);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('does not cache a failed load and retries on the next call', async () => {
    const cache = new TtlCache<number>();
    const loader = jest
      .fn<Promise<number>, []>()
      .mockRejectedValueOnce(new Error('database down'))
      .mockResolvedValueOnce(7);

    await expect(cache.getOrLoad('key', 10_000, loader)).rejects.toThrow('database down');
    await expect(cache.getOrLoad('key', 10_000, loader)).resolves.toBe(7);
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
