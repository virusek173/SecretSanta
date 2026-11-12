import { isTransientError, withRetry } from '../../utils/retry';

describe('withRetry', () => {
  const noSleep = jest.fn(() => Promise.resolve());

  beforeEach(() => noSleep.mockClear());

  it('returns the result without retrying on success', async () => {
    const op = jest.fn().mockResolvedValue('ok');
    await expect(withRetry(op, { sleep: noSleep })).resolves.toBe('ok');
    expect(op).toHaveBeenCalledTimes(1);
  });

  it('retries until success with exponential backoff', async () => {
    const op = jest.fn()
      .mockRejectedValueOnce(new Error('1'))
      .mockRejectedValueOnce(new Error('2'))
      .mockResolvedValue('ok');
    await expect(withRetry(op, { sleep: noSleep, baseDelayMs: 100 })).resolves.toBe('ok');
    expect(op).toHaveBeenCalledTimes(3);
    expect(noSleep).toHaveBeenNthCalledWith(1, 100);
    expect(noSleep).toHaveBeenNthCalledWith(2, 200);
  });

  it('gives up after the last attempt', async () => {
    const op = jest.fn().mockRejectedValue(new Error('down'));
    await expect(withRetry(op, { sleep: noSleep, attempts: 3 })).rejects.toThrow('down');
    expect(op).toHaveBeenCalledTimes(3);
  });

  it('does not retry when shouldRetry says no', async () => {
    const op = jest.fn().mockRejectedValue(new Error('bad request'));
    await expect(withRetry(op, { sleep: noSleep, shouldRetry: () => false })).rejects.toThrow('bad request');
    expect(op).toHaveBeenCalledTimes(1);
  });
});

describe('isTransientError', () => {
  it.each([
    [{ status: 429 }, true],
    [{ status: 503 }, true],
    [{ code: 500 }, true],
    [{ status: 400 }, false],
    [{ status: 401 }, false],
    [new Error('ECONNRESET'), true],
  ])('%p -> %p', (error, expected) => {
    expect(isTransientError(error)).toBe(expected);
  });
});
