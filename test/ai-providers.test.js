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
    // After sorting by recency, gemini-2.5-pro should be first (higher tier than flash at same version)
    expect(primaryCandidates[0].model).toBe('gemini-2.5-pro');
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
        isPrimary: false,
        fn: () => Promise.resolve(validJson),
      },
    ];

    // Mock the isValid function to accept our test JSON
    const isValid = (parsed) => {
      return parsed && parsed.sessions && Array.isArray(parsed.sessions);
    };

    const result = await runLessonPlanPipeline(pipeline, { isValid, maxRetries: 1 });
    expect(result).toEqual({
      data: { sessions: [{ sessionTitle: 'Test', flow: 'test flow' }] },
      provider: 'Gemini (gemini-2.5-flash)',
    });
  });

  it('falls back to secondary models when primary fails', async () => {
    const validJson = JSON.stringify({ sessions: [{ sessionTitle: 'Test', flow: 'test flow' }] });
    const pipeline = [
      {
        provider: 'Gemini',
        model: 'gemini-2.5-flash',
        isPrimary: true,
        fn: () => Promise.reject(new Error('Primary model failed')),
      },
      {
        provider: 'Gemini',
        model: 'gemini-2.5-pro',
        isPrimary: false,
        fn: () => Promise.resolve(validJson),
      },
    ];

    // Mock the isValid function to accept our test JSON
    const isValid = (parsed) => {
      return parsed && parsed.sessions && Array.isArray(parsed.sessions);
    };

    const result = await runLessonPlanPipeline(pipeline, { isValid, maxRetries: 1 });
    expect(result).toEqual({
      data: { sessions: [{ sessionTitle: 'Test', flow: 'test flow' }] },
      provider: 'Gemini (gemini-2.5-pro)',
    });
  });
});
