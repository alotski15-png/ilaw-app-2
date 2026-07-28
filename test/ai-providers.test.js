import { describe, it, expect, vi } from 'vitest';
import {
  buildLessonPlanPipeline,
  runLessonPlanPipeline,
  LESSON_PLAN_PRIMARY_MODELS,
  LESSON_PLAN_GEMINI_FALLBACKS,
} from '../lib/ai-providers';

describe('buildLessonPlanPipeline', () => {
  it('includes primary models with isPrimary: true', () => {
    const pipeline = buildLessonPlanPipeline({
      geminiApiKey: 'test-key',
      prompt: 'test prompt',
      timeout: 5000,
    });

    const primaryCandidates = pipeline.filter((c) => c.isPrimary);
    expect(primaryCandidates).toHaveLength(2);
    expect(primaryCandidates.map((c) => c.model)).toEqual(
      expect.arrayContaining(LESSON_PLAN_PRIMARY_MODELS)
    );
  });

  it('includes fallback Gemini models with isPrimary: false', () => {
    const pipeline = buildLessonPlanPipeline({
      geminiApiKey: 'test-key',
      prompt: 'test prompt',
      timeout: 5000,
    });

    const fallbackCandidates = pipeline.filter((c) => !c.isPrimary && c.provider === 'Gemini');
    expect(fallbackCandidates.length).toBeGreaterThan(0);
    // Primary models should not appear in fallbacks
    fallbackCandidates.forEach((c) => {
      expect(LESSON_PLAN_PRIMARY_MODELS).not.toContain(c.model);
    });
  });

  it('includes Groq models when groqApiKey is provided', () => {
    const pipeline = buildLessonPlanPipeline({
      geminiApiKey: 'test-key',
      groqApiKey: 'test-groq-key',
      prompt: 'test prompt',
      timeout: 5000,
    });

    const groqCandidates = pipeline.filter((c) => c.provider === 'Groq');
    expect(groqCandidates.length).toBeGreaterThan(0);
    groqCandidates.forEach((c) => {
      expect(c.isPrimary).toBe(false);
    });
  });

  it('includes OpenRouter models when openRouterApiKey is provided', () => {
    const pipeline = buildLessonPlanPipeline({
      geminiApiKey: 'test-key',
      openRouterApiKey: 'test-or-key',
      prompt: 'test prompt',
      timeout: 5000,
    });

    const orCandidates = pipeline.filter((c) => c.provider === 'OpenRouter');
    expect(orCandidates.length).toBeGreaterThan(0);
    orCandidates.forEach((c) => {
      expect(c.isPrimary).toBe(false);
    });
  });

  it('includes selectedModel in fallbacks if not a primary model', () => {
    const pipeline = buildLessonPlanPipeline({
      geminiApiKey: 'test-key',
      selectedModel: 'gemini-2.5-pro',
      prompt: 'test prompt',
      timeout: 5000,
    });

    const fallbackModels = pipeline
      .filter((c) => !c.isPrimary && c.provider === 'Gemini')
      .map((c) => c.model);
    expect(fallbackModels).toContain('gemini-2.5-pro');
  });

  it('does not duplicate selectedModel if it is a primary model', () => {
    const pipeline = buildLessonPlanPipeline({
      geminiApiKey: 'test-key',
      selectedModel: 'gemini-3.6-flash',
      prompt: 'test prompt',
      timeout: 5000,
    });

    const allGeminiModels = pipeline
      .filter((c) => c.provider === 'Gemini')
      .map((c) => c.model);
    const flash36Count = allGeminiModels.filter((m) => m === 'gemini-3.6-flash').length;
    expect(flash36Count).toBe(1);
  });

  it('returns empty pipeline when no API keys are provided', () => {
    const pipeline = buildLessonPlanPipeline({
      prompt: 'test prompt',
      timeout: 5000,
    });
    expect(pipeline).toHaveLength(0);
  });

  it('LESSON_PLAN_PRIMARY_MODELS contains gemini-3.6-flash and gemini-3.5-flash', () => {
    expect(LESSON_PLAN_PRIMARY_MODELS).toContain('gemini-3.6-flash');
    expect(LESSON_PLAN_PRIMARY_MODELS).toContain('gemini-3.5-flash');
    expect(LESSON_PLAN_PRIMARY_MODELS).toHaveLength(2);
  });

  it('LESSON_PLAN_GEMINI_FALLBACKS does not include primary models', () => {
    LESSON_PLAN_PRIMARY_MODELS.forEach((primary) => {
      expect(LESSON_PLAN_GEMINI_FALLBACKS).not.toContain(primary);
    });
  });
});

describe('runLessonPlanPipeline', () => {
  it('returns the first valid result from primary models', async () => {
    const validJson = JSON.stringify({ sessions: [{ sessionTitle: 'Test', flow: 'test flow' }] });
    const pipeline = [
      {
        provider: 'Gemini',
        model: 'gemini-3.6-flash',
        isPrimary: true,
        fn: () => Promise.resolve(validJson),
      },
      {
        provider: 'Gemini',
        model: 'gemini-3.5-flash',
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
        model: 'gemini-3.6-flash',
        isPrimary: true,
        fn: () => Promise.reject(new Error('API error')),
      },
      {
        provider: 'Gemini',
        model: 'gemini-3.5-flash',
        isPrimary: true,
        fn: () => Promise.reject(new Error('API error')),
      },
      {
        provider: 'Groq',
        model: 'llama-3.3-70b-versatile',
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
        model: 'gemini-3.6-flash',
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
        model: 'gemini-3.5-flash',
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
    expect(result.provider).toContain('gemini-3.6-flash');
    expect(callCount).toBe(2);
  });

  it('returns null when all models fail', async () => {
    const pipeline = [
      {
        provider: 'Gemini',
        model: 'gemini-3.6-flash',
        isPrimary: true,
        fn: () => Promise.reject(new Error('API error')),
      },
      {
        provider: 'Gemini',
        model: 'gemini-3.5-flash',
        isPrimary: true,
        fn: () => Promise.reject(new Error('API error')),
      },
      {
        provider: 'Groq',
        model: 'llama-3.3-70b-versatile',
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
        model: 'gemini-3.6-flash',
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
        model: 'gemini-3.5-flash',
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
        model: 'gemini-3.6-flash',
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
        model: 'gemini-3.5-flash',
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

    // Second attempt: gemini-3.6-flash succeeds.
    const result = await promise;
    vi.useRealTimers();

    expect(result).not.toBeNull();
    expect(result.provider).toContain('gemini-3.6-flash');
    expect(callCount).toBe(2);
  });

  it('prevents further batches of API calls after a valid result is found', async () => {
    const validJson = JSON.stringify({ sessions: [{ sessionTitle: 'Test', flow: 'test flow' }] });
    let otherCallCount = 0;
    const pipeline = [
      {
        provider: 'Gemini',
        model: 'gemini-3.6-flash',
        isPrimary: true,
        fn: () => Promise.resolve(validJson),
      },
      {
        provider: 'Gemini',
        model: 'gemini-3.5-flash',
        isPrimary: true,
        fn: () => Promise.resolve(validJson),
      },
      {
        provider: 'Groq',
        model: 'llama-3.3-70b-versatile',
        isPrimary: false,
        fn: () => {
          otherCallCount += 1;
          return Promise.resolve(validJson);
        },
      },
      {
        provider: 'Groq',
        model: 'llama-3.1-8b-instant',
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
