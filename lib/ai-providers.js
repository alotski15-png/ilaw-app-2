// lib/ai-providers.js
// Shared logic for calling Gemini, Groq, and OpenRouter with timeouts and fallback.
// Both /api/generate and /api/extract-bow import from here.

async function fetchWithTimeout(resource, options = {}, timeout = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeout / 1000}s`);
    }
    throw err;
  }
}

async function callGemini(apiKey, model, prompt, { timeout = 15000, maxOutputTokens, signal } = {}) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const generationConfig = {
    temperature: 0.1,
    responseMimeType: 'application/json',
  };
  if (maxOutputTokens) generationConfig.maxOutputTokens = maxOutputTokens;
  
  const fetchOptions = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig,
    }),
  };
  if (signal) fetchOptions.signal = signal;
  const response = await fetchWithTimeout(url, fetchOptions, timeout);

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Gemini API (${model}) status ${response.status}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callGroq(groqApiKey, model, prompt, { timeout = 15000, maxTokens, systemPrompt, signal } = {}) {
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  const body = {
    model,
    response_format: { type: 'json_object' },
    messages,
    temperature: 0.1,
  };
  if (maxTokens) body.max_tokens = maxTokens; // Corrected: max_tokens should be in body, not fetch options

  const fetchOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${groqApiKey}`,
    },
    body: JSON.stringify(body),
  };
  if (signal) fetchOptions.signal = signal;
  const response = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', fetchOptions, timeout);

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Groq API (${model}) status ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callOpenRouter(openRouterApiKey, model, prompt, { timeout = 15000, maxTokens, systemPrompt, signal } = {}) {
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  const body = {
    model,
    messages,
    temperature: 0.1,
  };
  if (maxTokens) body.max_tokens = maxTokens; // Corrected: max_tokens should be in body, not fetch options

  const fetchOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openRouterApiKey}`,
    },
    body: JSON.stringify(body),
  };
  if (signal) fetchOptions.signal = signal;
  const response = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', fetchOptions, timeout);

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `OpenRouter API (${model}) status ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// Gemini models used for BOW extraction (term/week detection and entry loading).
// Excludes gemini-3.6 and gemini-3.5 per requirements.
// "Recent" models are listed first; older fallbacks follow.
const GEMINI_BOW_MODELS = [
  'gemini-3.1-pro-preview',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
];

// The most recent Gemini model available — gets a dedicated 10-loop retry.
const RECENT_GEMINI_MODEL = 'gemini-3.1-pro-preview';

const DEFAULT_GEMINI_FALLBACKS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
];

const DEFAULT_GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'mixtral-8x7b-32768',
];

const DEFAULT_OPENROUTER_MODELS = [
  'google/gemini-2.5-flash',
  'meta-llama/llama-3.3-70b-instruct',
  'deepseek/deepseek-chat',
];

// Builds the ordered list of candidate calls: preferred Gemini model first,
// then Gemini fallbacks, then Groq, then OpenRouter.
function buildPipeline({
  geminiApiKey,
  groqApiKey,
  openRouterApiKey,
  selectedModel,
  prompt,
  timeout,
  maxOutputTokens,
  systemPrompt,
  signal,
}) {
  const pipeline = [];

  if (geminiApiKey) {
    const geminiModels = Array.from(new Set([selectedModel, ...DEFAULT_GEMINI_FALLBACKS].filter(Boolean)));
    geminiModels.forEach((model) => {
      pipeline.push({
        provider: 'Gemini',
        model, // Corrected: model should be passed directly
        fn: () => callGemini(geminiApiKey, model, prompt, { timeout, maxOutputTokens }),
      });
    });
  }

  if (groqApiKey) {
    DEFAULT_GROQ_MODELS.forEach((model) => {
      pipeline.push({
        provider: 'Groq',
        model, // Corrected: model should be passed directly
        fn: () => callGroq(groqApiKey, model, prompt, { timeout, maxTokens: maxOutputTokens, systemPrompt }),
      });
    });
  }

  if (openRouterApiKey) {
    DEFAULT_OPENROUTER_MODELS.forEach((model) => {
      pipeline.push({
        provider: 'OpenRouter',
        model, // Corrected: model should be passed directly
        fn: () => callOpenRouter(openRouterApiKey, model, prompt, { timeout, maxTokens: maxOutputTokens, systemPrompt }),
      });
    });
  }

  return pipeline;
}

// Runs the pipeline in order and returns the first valid result.
// isValid(parsed) lets each route apply its own schema check (e.g. session count).
function parseJsonResponse(responseText) {
  if (!responseText) return null;

  const cleaned = String(responseText)
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch (innerError) {
        throw error;
      }
    }
    throw error;
  }
}

async function runPipeline(pipeline, { isValid } = {}) {
  for (const candidate of pipeline) {
    try {
      const responseText = await candidate.fn(); // signal is already captured in fn closure
      // If the request was aborted, candidate.fn() might throw an AbortError.
      // This catch block will handle it.

      if (!responseText) continue;

      const clean = responseText.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
      const parsed = parseJsonResponse(clean);

      if (!isValid || isValid(parsed)) {
        return {
          data: parsed,
          provider: `${candidate.provider} (${candidate.model})`,
        };
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        console.warn(`[Fallback] ${candidate.provider} (${candidate.model}) aborted.`);
        throw err; // Re-throw AbortError so the main API route can catch it.
      }
      console.warn(`[Fallback] ${candidate.provider} (${candidate.model}) failed:`, err.message);
    }
  }
  return null;
}

/**
 * Concurrent retry pipeline for BOW extraction.
 *
 * Strategy:
 * 1. Identify the "recent" Gemini model (RECENT_GEMINI_MODEL) and give it a
 *    dedicated 10-loop retry with a timer of (retryCount ms + 1000ms).
 * 2. While the recent model is generating / retrying, simultaneously run the
 *    other models via Promise.race.
 * 3. Return the first positive (valid) result from either source.
 *
 * A shared `settled` flag ensures that once either source finds a valid result,
 * the other stops launching new API calls.
 *
 * @param {Array} pipeline - Full candidate list (from buildBowPipeline).
 * @param {Object} options
 * @param {Function} options.isValid - Optional validator for parsed JSON.
 * @param {number} options.maxRetries - Max retry loops for the recent model (default 10).
 * @returns {Promise<{data, provider}|null>}
 */
async function runConcurrentPipeline(pipeline, { isValid, maxRetries = 10 } = {}) {
  // Separate the recent model candidate from the rest.
  const recentCandidate = pipeline.find(
    (c) => c.provider === 'Gemini' && c.model === RECENT_GEMINI_MODEL
  );
  const otherCandidates = pipeline.filter(
    (c) => !(c.provider === 'Gemini' && c.model === RECENT_GEMINI_MODEL)
  );

  // Shared flag: once either source finds a valid result, stop new attempts.
  let settled = false;

  // Helper: try a single candidate, return a valid result object or null.
  async function tryCandidate(candidate) {
    if (settled) return null;
    try {
      const responseText = await candidate.fn(); // signal is already captured in fn closure
      if (settled) return null;
      if (!responseText) return null;
      const clean = responseText.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
      const parsed = parseJsonResponse(clean);
      if (!isValid || isValid(parsed)) {
        return { data: parsed, provider: `${candidate.provider} (${candidate.model})` };
      }
      return null;
    } catch (err) {
      if (err.name === 'AbortError') {
        console.warn(`[Concurrent Fallback] ${candidate.provider} (${candidate.model}) aborted.`);
        return null; // Return null for aborted calls in concurrent pipeline
      }
      console.warn(`[Concurrent Fallback] ${candidate.provider} (${candidate.model}) failed:`, err.message);
      return null;
    }
  }

  // --- Recent model retry loop ---
  // Retries up to maxRetries times with timer = retryCount (ms) + 1000ms.
  const recentModelPromise = (async () => {
    if (!recentCandidate) return null;
    for (let attempt = 0; attempt < maxRetries; attempt += 1) {
      if (settled) return null;
      const result = await tryCandidate(recentCandidate);
      if (result) {
        settled = true;
        return result;
      }
      // Retry timer: retryCount (ms) + 1000ms
      const retryCount = attempt + 1;
      const delayMs = retryCount + 1000;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    return null;
  })();

  // --- Other models runner ---
  // Races batches of other candidates until one produces a valid result.
  const otherModelsPromise = (async () => {
    let idx = 0;
    while (idx < otherCandidates.length && !settled) {
      const batch = otherCandidates.slice(idx, idx + 2);
      idx += 2;
      const batchResults = await Promise.all(batch.map(tryCandidate));
      const validResult = batchResults.find((r) => r !== null);
      if (validResult) {
        settled = true;
        return validResult;
      }
    }
    return null;
  })();

  // Race both: return the first positive (non-null) result.
  // If the first to settle is null, wait for the other to complete.
  const firstResult = await Promise.race([recentModelPromise, otherModelsPromise]);
  if (firstResult) return firstResult;

  // First to settle was null; wait for the other to finish.
  const settledResults = await Promise.allSettled([recentModelPromise, otherModelsPromise]);
  for (const r of settledResults) {
    if (r.status === 'fulfilled' && r.value) {
      return r.value;
    }
  }

  return null;
}

/**
 * Builds a pipeline using only Gemini models (excluding 3.6 and 3.5).
 * Used for BOW term/week detection and entry loading.
 *
 * @param {Object} params
 * @param {string} params.geminiApiKey
 * @param {string} params.prompt
 * @param {number} params.timeout
 * @param {number} params.maxOutputTokens
 * @param {string} params.systemPrompt
 * @param {Array<string>} [params.models] - Optional override; defaults to GEMINI_BOW_MODELS.
 */
function buildBowPipeline({
  geminiApiKey,
  prompt,
  timeout,
  maxOutputTokens,
  systemPrompt,
  signal,
  models,
}) {
  const pipeline = [];
  const modelList = models || GEMINI_BOW_MODELS;

  if (geminiApiKey) {
    modelList.forEach((model) => { // Corrected: model should be passed directly
      pipeline.push({ provider: 'Gemini', model, fn: () => callGemini(geminiApiKey, model, prompt, { timeout, maxOutputTokens, signal }) });
    });
  }

  return pipeline;
}

// ---------------------------------------------------------------------------
// Lesson Plan Generation Pipeline
// ---------------------------------------------------------------------------

// Primary Gemini models for lesson plan generation — these get the dedicated
// 10-loop retry with a timer of (retryCount ms + 1000ms).
const LESSON_PLAN_PRIMARY_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
];

// Broader set of Gemini fallback models for lesson plan generation.
// Includes models not in DEFAULT_GEMINI_FALLBACKS so the fallback pool is
// richer when the user has not explicitly selected one of these.
const LESSON_PLAN_GEMINI_FALLBACKS = [
  'gemini-3.5-flash-lite',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
];

/**
 * Builds a pipeline for detailed ilaw lesson plan generation.
 *
 * Strategy:
 * 1. Primary models (gemini-3.6-flash, gemini-3.5-flash) are always included
 *    first and flagged `isPrimary: true`. These receive the dedicated
 *    10-loop retry in runLessonPlanPipeline.
 * 2. Fallback Gemini models follow (DEFAULT_GEMINI_FALLBACKS + selectedModel
 *    if it is not already a primary model).
 * 3. Groq models and OpenRouter models are appended as final fallbacks.
 *
 * @param {Object} params
 * @param {string} params.geminiApiKey
 * @param {string} params.groqApiKey
 * @param {string} params.openRouterApiKey
 * @param {string} params.selectedModel
 * @param {string} params.prompt
 * @param {number} params.timeout
 * @param {number} params.maxOutputTokens
 * @param {string} params.systemPrompt
 */
function buildLessonPlanPipeline({
  geminiApiKey,
  groqApiKey,
  openRouterApiKey,
  selectedModel,
  prompt,
  timeout,
  maxOutputTokens,
  systemPrompt,
  signal,
}) {
  const pipeline = [];

  if (geminiApiKey) {
    // --- Primary models (gemini-3.6 and gemini-3.5) ---
    LESSON_PLAN_PRIMARY_MODELS.forEach((model) => {
      pipeline.push({
        provider: 'Gemini',
        model, // Corrected: model should be passed directly
        isPrimary: true,
        fn: () => callGemini(geminiApiKey, model, prompt, { timeout, maxOutputTokens }),
      });
    });

    // --- Fallback Gemini models ---
    // Combine selectedModel (if not primary) with the broader fallback list.
    const fallbackModels = Array.from(
      new Set(
        [
          selectedModel,
          ...LESSON_PLAN_GEMINI_FALLBACKS,
          ...DEFAULT_GEMINI_FALLBACKS,
        ].filter(Boolean).filter((m) => !LESSON_PLAN_PRIMARY_MODELS.includes(m))
      )
    );

    fallbackModels.forEach((model) => {
      pipeline.push({
        provider: 'Gemini', // Corrected: model should be passed directly
        model,
        isPrimary: false,
        fn: () => callGemini(geminiApiKey, model, prompt, { timeout, maxOutputTokens }),
      });
    });
  }

  if (groqApiKey) {
    DEFAULT_GROQ_MODELS.forEach((model) => {
      pipeline.push({
        provider: 'Groq', // Corrected: model should be passed directly
        model,
        isPrimary: false,
        fn: () => callGroq(groqApiKey, model, prompt, { timeout, maxTokens: maxOutputTokens, systemPrompt }),
      });
    });
  }

  if (openRouterApiKey) {
    DEFAULT_OPENROUTER_MODELS.forEach((model) => {
      pipeline.push({
        provider: 'OpenRouter', // Corrected: model should be passed directly
        model,
        isPrimary: false,
        fn: () => callOpenRouter(openRouterApiKey, model, prompt, { timeout, maxTokens: maxOutputTokens, systemPrompt }),
      });
    });
  }

  return pipeline;
}

/**
 * Concurrent retry pipeline for detailed ilaw lesson plan generation.
 *
 * Strategy:
 * 1. Identify the primary models (gemini-3.6-flash and gemini-3.5-flash) and
 *    give them a dedicated 10-loop retry with a timer of (retryCount ms + 1000ms).
 *    In each retry attempt, ALL primary models are tried concurrently.
 * 2. While the primary models are generating / retrying, simultaneously run the
 *    other models (fallback Gemini, Groq, OpenRouter) via Promise.all in batches.
 * 3. Return the first positive (valid) result from either source.
 *
 * A shared `settled` flag ensures that once either source finds a valid result,
 * the other stops launching new API calls.
 *
 * @param {Array} pipeline - Full candidate list (from buildLessonPlanPipeline).
 * @param {Object} options
 * @param {Function} options.isValid - Optional validator for parsed JSON.
 * @param {number} options.maxRetries - Max retry loops for the primary models (default 10).
 * @returns {Promise<{data, provider}|null>}
 */
async function runLessonPlanPipeline(pipeline, { isValid, maxRetries = 10 } = {}) {
  // Separate primary models from the rest.
  const primaryCandidates = pipeline.filter((c) => c.isPrimary);
  const otherCandidates = pipeline.filter((c) => !c.isPrimary);

  // Shared flag: once either source finds a valid result, stop new attempts.
  let settled = false;

  // Helper: try a single candidate, return a valid result object or null.
  async function tryCandidate(candidate) {
    if (settled) return null;
    try {
      const responseText = await candidate.fn(); // signal is already captured in fn closure
      if (settled) return null;
      if (!responseText) return null;
      const clean = responseText.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
      const parsed = parseJsonResponse(clean);
      if (!isValid || isValid(parsed)) {
        return { data: parsed, provider: `${candidate.provider} (${candidate.model})` };
      }
      return null;
    } catch (err) {
      if (err.name === 'AbortError') {
        console.warn(`[LessonPlan Concurrent] ${candidate.provider} (${candidate.model}) aborted.`);
        return null; // Return null for aborted calls in concurrent pipeline
      }
      console.warn(`[LessonPlan Concurrent] ${candidate.provider} (${candidate.model}) failed:`, err.message);
      return null;
    }
  }

  // --- Primary models retry loop ---
  // Retries up to maxRetries times with timer = retryCount (ms) + 1000ms.
  // In each attempt, all primary models are tried concurrently.
  const primaryPromise = (async () => {
    if (primaryCandidates.length === 0) return null;
    for (let attempt = 0; attempt < maxRetries; attempt += 1) {
      if (settled) return null;
      // Try all primary models concurrently in this attempt
      const batchResults = await Promise.all(primaryCandidates.map(tryCandidate));
      const validResult = batchResults.find((r) => r !== null);
      if (validResult) {
        settled = true;
        return validResult;
      }
      // Retry timer: retryCount (ms) + 1000ms
      const retryCount = attempt + 1;
      const delayMs = retryCount + 1000;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    return null;
  })();

  // --- Other models runner ---
  // Races batches of other candidates until one produces a valid result.
  const otherPromise = (async () => {
    let idx = 0;
    while (idx < otherCandidates.length && !settled) {
      const batch = otherCandidates.slice(idx, idx + 2);
      idx += 2;
      const batchResults = await Promise.all(batch.map(tryCandidate));
      const validResult = batchResults.find((r) => r !== null);
      if (validResult) {
        settled = true;
        return validResult;
      }
    }
    return null;
  })();

  // Race both: return the first positive (non-null) result.
  // If the first to settle is null, wait for the other to complete.
  const firstResult = await Promise.race([primaryPromise, otherPromise]);
  if (firstResult) return firstResult;

  // First to settle was null; wait for the other to finish.
  const settledResults = await Promise.allSettled([primaryPromise, otherPromise]);
  for (const r of settledResults) {
    if (r.status === 'fulfilled' && r.value) {
      return r.value;
    }
  }

  return null;
}

module.exports = {
  callGemini,
  callGroq,
  callOpenRouter,
  buildPipeline,
  runPipeline,
  runConcurrentPipeline,
  buildBowPipeline,
  buildLessonPlanPipeline,
  runLessonPlanPipeline,
  fetchWithTimeout,
  GEMINI_BOW_MODELS,
  RECENT_GEMINI_MODEL,
  LESSON_PLAN_PRIMARY_MODELS,
  LESSON_PLAN_GEMINI_FALLBACKS,
};
