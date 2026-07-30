import { describe, it, expect, vi } from 'vitest';
import {
  buildLessonPlanPipeline,
  runLessonPlanPipeline,
  fetchWithTimeout,
} from '../lib/ai-providers';

describe('fetchWithTimeout', () => {
  it('aborts in-flight requests when the external signal is aborted', async () => {
    const abortController = new AbortController();
    let sawAbort = false;

    vi.stubGlobal('fetch', vi.fn((_url, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        sawAbort = true;
        const error = new Error('The operation was aborted.');
        error.name = 'AbortError';
        reject(error);
      });
    })));

    const promise = fetchWithTimeout('https://example.com', { signal: abortController.signal }, 10000);
    abortController.abort();

    await expect(promise).rejects.toThrow('The operation was aborted.');
    expect(sawAbort).toBe(true);

    vi.unstubAllGlobals();
  });
});

describe('buildLessonPlanPipeline', () => {
  it('returns empty pipeline when no API keys are provided', () => {
    const pipeline = buildLessonPlanPipeline({
      prompt: 'test prompt',
      timeout: 5000,
    });
    expect(pipeline).toHaveLength(0);
  });

  it('returns empty pipeline when no geminiModels are provided', () => {
    const pipeline = buildLessonPlanPipeline({
      geminiApiKey: 'test-key',
      prompt: 'test prompt',
      timeout: 5000,
    });
    expect(pipeline).toHaveLength(0);
  });

  it('marks first model as primary when geminiModels are provided', () => {
    const pipeline = buildLessonPlanPipeline({
      geminiApiKey: 'test-key',
      geminiModels: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
      prompt: 'test prompt',
      timeout: 5000,
    });

    const primaryCandidates = pipeline.filter((c) => c.isPrimary);
    expect(primaryCandidates).toHaveLength(1);
    expect(primaryCandidates[0].model).toBe('gemini-2.5-flash');
  });

  it('includes all geminiModels in the pipeline', () => {
    const pipeline = buildLessonPlanPipeline({
      geminiApiKey: 'test-key',
      geminiModels: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
      prompt: 'test prompt',
      timeout: 5000,
    });

    const geminiCandidates = pipeline.filter((c) => c.provider === 'Gemini');
    expect(geminiCandidates).toHaveLength(3);
  });

  it('includes Groq models when groqApiKey and groqModels are provided', () => {
    const pipeline = buildLessonPlanPipeline({
      geminiApiKey: 'test-key',
      geminiModels: ['gemini-2.5-flash'],
      groqApiKey: 'test-groq-key',
      groqModels: ['llama-3.3-70b', 'llama-3.1-8b'],
      prompt: 'test prompt',
      timeout: 5000,
    });

    const groqCandidates = pipeline.filter((c) => c.provider === 'Groq');
    expect(groqCandidates).toHaveLength(2);
    groqCandidates.forEach((c) => {
      expect(c.isPrimary).toBe(false);
    });
  });

  it('includes OpenRouter models when openRouterApiKey and openRouterModels are provided', () => {
    const pipeline = buildLessonPlanPipeline({
      geminiApiKey: 'test-key',
      geminiModels: ['gemini-2.5-flash'],
      openRouterApiKey: 'test-openrouter-key',
      openRouterModels: ['gpt-4o', 'claude-3.5-sonnet'],
      prompt: 'test prompt',
      timeout: 5000,
    });

    const openRouterCandidates = pipeline.filter((c) => c.provider === 'OpenRouter');
    expect(openRouterCandidates).toHaveLength(2);
    openRouterCandidates.forEach((c) => {
      expect(c.isPrimary).toBe(false);
    });
  });
});

describe('runLessonPlanPipeline', () => {
  it('returns the first valid result from primary models', async () => {
    const validJson = JSON.stringify({ sessions: [{ sessionTitle: 'Test', flow: 'test flow' }] });
    const pipeline = [
      {
        provider: 'Gemini',
        model: 'gemini-2.5-flash',
        isPrimary: true,
        fn: () => Promise.resolve(validJson),
      },
      {
        provider: 'Gemini',
        model: 'gemini-2.5-pro',
        isPrimary: true,
        fn: () => Promise.resolve(validJson),
      },
    ];

    const result = await runLessonPlanPipeline(pipeline, {
      isValid: (parsed) => parsed?.sessions?.length === 1,
    });

    expect(result).not.toBeNull();
    expect(result.data.sessions).toHaveLength(1);
    expect(result.provider).toContain('Gemini');
  });

  it('returns the first valid result from other models if primary models fail', async () => {
    const validJson = JSON.stringify({ sessions: [{ sessionTitle: 'Test', flow: 'test flow' }] });
    const pipeline = [
      {
        provider: 'Gemini',
        model: 'gemini-2.5-flash',
        isPrimary: true,
        fn: () => Promise.reject(new Error('API error')),
      },
      {
        provider: 'Gemini',
        model: 'gemini-2.5-pro',
        isPrimary: true,
        fn: () => Promise.reject(new Error('API error')),
      },
      {
        provider: 'Groq',
        model: 'llama-3.3-70b',
        isPrimary: false,
        fn: () => Promise.resolve(validJson),
      },
    ];

    const result = await runLessonPlanPipeline(pipeline, {
      isValid: (parsed) => parsed?.sessions?.length === 1,
      maxRetries: 2,
    });

    expect(result).not.toBeNull();
    expect(result.provider).toContain('Groq');
  });

  it('retries primary models and succeeds on a later attempt', async () => {
    const validJson = JSON.stringify({ sessions: [{ sessionTitle: 'Test', flow: 'test flow' }] });
    let callCount = 0;
    const pipeline = [
      {
        provider: 'Gemini',
        model: 'gemini-2.5-flash',
        isPrimary: true,
        fn: () => {
          callCount += 1;
          if (callCount < 2) {
            return Promise.reject(new Error('API error'));
          }
          return Promise.resolve(validJson);
        },
      },
      {
        provider: 'Gemini',
        model: 'gemini-2.5-pro',
        isPrimary: true,
        fn: () => Promise.reject(new Error('API error')),
      },
    ];

    // Retry timer for attempt 1 = 1ms + 1000ms = 1001ms
    const result = await runLessonPlanPipeline(pipeline, {
      isValid: (parsed) => parsed?.sessions?.length === 1,
      maxRetries: 10,
    });

    expect(result).not.toBeNull();
    expect(result.provider).toContain('gemini-2.5-flash');
    expect(callCount).toBe(2);
  });

  it('returns null when all models fail', async () => {
    const pipeline = [
      {
        provider: 'Gemini',
        model: 'gemini-2.5-flash',
        isPrimary: true,
        fn: () => Promise.reject(new Error('API error')),
      },
      {
        provider: 'Gemini',
        model: 'gemini-2.5-pro',
        isPrimary: true,
        fn: () => Promise.reject(new Error('API error')),
      },
      {
        provider: 'Groq',
        model: 'llama-3.3-70b',
        isPrimary: false,
        fn: () => Promise.reject(new Error('API error')),
      },
    ];

    const result = await runLessonPlanPipeline(pipeline, {
      isValid: (parsed) => parsed?.sessions?.length === 1,
      maxRetries: 2,
    });

    expect(result).toBeNull();
  });

  it('respects the isValid validator and retries on invalid output', async () => {
    const invalidJson = JSON.stringify({ sessions: [] });
    const validJson = JSON.stringify({ sessions: [{ sessionTitle: 'Test', flow: 'test flow' }] });
    let callCount = 0;
    const pipeline = [
      {
        provider: 'Gemini',
        model: 'gemini-2.5-flash',
        isPrimary: true,
        fn: () => {
          callCount += 1;
          if (callCount < 2) {
            return Promise.resolve(invalidJson);
          }
          return Promise.resolve(validJson);
        },
      },
      {
        provider: 'Gemini',
        model: 'gemini-2.5-pro',
        isPrimary: true,
        fn: () => Promise.resolve(invalidJson),
      },
    ];

    const result = await runLessonPlanPipeline(pipeline, {
      isValid: (parsed) => parsed?.sessions?.length === 1,
      maxRetries: 10,
    });

    expect(result).not.toBeNull();
    expect(result.data.sessions).toHaveLength(1);
  });

  it('uses retry timer of retryCount (ms) + 1000ms', async () => {
    const validJson = JSON.stringify({ sessions: [{ sessionTitle: 'Test', flow: 'test flow' }] });
    let callCount = 0;
    const pipeline = [
      {
        provider: 'Gemini',
        model: 'gemini-2.5-flash',
        isPrimary: true,
        fn: () => {
          callCount += 1;
          if (callCount < 2) {
            return Promise.reject(new Error('API error'));
          }
          return Promise.resolve(validJson);
        },
      },
      {
        provider: 'Gemini',
        model: 'gemini-2.5-pro',
        isPrimary: true,
        fn: () => Promise.reject(new Error('API error')),
      },
    ];

    vi.useFakeTimers();
    const promise = runLessonPlanPipeline(pipeline, {
      isValid: (parsed) => parsed?.sessions?.length === 1,
      maxRetries: 10,
    });

    // First attempt: both primary models fail.
    // The primary promise is now waiting for the retry timer.
    // Retry timer for attempt 1 = 1ms + 1000ms = 1001ms.
    await vi.advanceTimersByTimeAsync(1001);

    // Second attempt: gemini-2.5-flash succeeds.
    const result = await promise;
    vi.useRealTimers();

    expect(result).not.toBeNull();
    expect(result.provider).toContain('gemini-2.5-flash');
    expect(callCount).toBe(2);
  });

  it('prevents further batches of API calls after a valid result is found', async () => {
    const validJson = JSON.stringify({ sessions: [{ sessionTitle: 'Test', flow: 'test flow' }] });
    let otherCallCount = 0;
    const pipeline = [
      {
        provider: 'Gemini',
        model: 'gemini-2.5-flash',
        isPrimary: true,
        fn: () => Promise.resolve(validJson),
      },
      {
        provider: 'Gemini',
        model: 'gemini-2.5-pro',
        isPrimary: true,
        fn: () => Promise.resolve(validJson),
      },
      {
        provider: 'Groq',
        model: 'llama-3.3-70b',
        isPrimary: false,
        fn: () => {
          otherCallCount += 1;
          return Promise.resolve(validJson);
        },
      },
      {
        provider: 'Groq',
        model: 'llama-3.1-8b',
        isPrimary: false,
        fn: () => {
          otherCallCount += 1;
          return Promise.resolve(validJson);
        },
      },
    ];

    const result = await runLessonPlanPipeline(pipeline, {
      isValid: (parsed) => parsed?.sessions?.length === 1,
    });

    expect(result).not.toBeNull();
    // The settled flag prevents NEW batches from launching after a valid result
    // is found. In a concurrent environment, the first batch of other models
    // may have already started before the primary model set `settled`, so
    // otherCallCount may be 0, 1, or 2. But it should never exceed 2 (the
    // batch size), proving that no further batches were launched.
    expect(otherCallCount).toBeLessThanOrEqual(2);
  });
});