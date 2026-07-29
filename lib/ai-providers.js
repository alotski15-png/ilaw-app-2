// lib/ai-providers.js
// Shared logic for calling Gemini, Cerebras, OpenAI, and DeepSeek with timeouts and fallback.
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

// stop all model retries when user presses abort
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

async function callCerebras(cerebrasApiKey, model, prompt, { timeout = 15000, maxTokens, systemPrompt, signal } = {}) {
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  const body = {
    model,
    response_format: { type: 'json_object' },
    messages,
    temperature: 0.1,
  };
  // Cerebras Llama models typically support up to 8192 output tokens.
  // Cap maxTokens to avoid API errors when requesting larger outputs (e.g. 16384).
  if (maxTokens) body.max_tokens = Math.min(maxTokens, 8192);

  const fetchOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cerebrasApiKey}`,
    },
    body: JSON.stringify(body),
  };
  if (signal) fetchOptions.signal = signal;
  const response = await fetchWithTimeout('https://api.cerebras.ai/v1/chat/completions', fetchOptions, timeout);

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Cerebras API (${model}) status ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callOpenAI(openAiApiKey, model, prompt, { timeout = 15000, maxTokens, systemPrompt, signal } = {}) {
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  const body = {
    model,
    response_format: { type: 'json_object' },
    messages,
    temperature: 0.1,
  };
  if (maxTokens) body.max_tokens = maxTokens;

  const fetchOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openAiApiKey}`,
    },
    body: JSON.stringify(body),
  };
  if (signal) fetchOptions.signal = signal;
  const response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', fetchOptions, timeout);

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `OpenAI API (${model}) status ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callDeepSeek(deepSeekApiKey, model, prompt, { timeout = 15000, maxTokens, systemPrompt, signal } = {}) {
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  const body = {
    model,
    messages,
    temperature: 0.1,
  };
  if (maxTokens) body.max_tokens = maxTokens;

  const fetchOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${deepSeekApiKey}`,
    },
    body: JSON.stringify(body),
  };
  if (signal) fetchOptions.signal = signal;
  const response = await fetchWithTimeout('https://api.deepseek.com/v1/chat/completions', fetchOptions, timeout);

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `DeepSeek API (${model}) status ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// ---------------------------------------------------------------------------
// REAL Gemini models (verified against Google's actual API)
// ---------------------------------------------------------------------------

// Gemini models used for BOW extraction (term/week detection and entry loading).
// All 14 text-generation models from the user's API key.
const GEMINI_BOW_MODELS = [
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.1-pro-preview',
  'gemini-3-pro-preview',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-pro-latest',
];

// The most capable Gemini model available — gets a dedicated 10-loop retry.
const RECENT_GEMINI_MODEL = 'gemini-2.5-pro';

const DEFAULT_GEMINI_FALLBACKS = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
];

// Cerebras models — fast but unreliable for structured JSON output.
// Deprioritized in the pipeline (placed after DeepSeek).
const DEFAULT_CEREBRAS_MODELS = [
  'llama-3.3-70b',
  'llama-3.1-8b',
  'llama-3.1-70b',
];

// OpenAI models — reliable but PAID. Used as final fallback only.
const DEFAULT_OPENAI_MODELS = [
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4-turbo',
  'gpt-4',
  'gpt-3.5-turbo',
  'o1-preview',
  'o1-mini',
];

// DeepSeek: FREE AI provider with 64K output tokens.
// Can handle BOTH BOW extraction (small JSON) and full lesson plan generation (16384 tokens).
// OpenAI-compatible API. No credit card required for basic usage.
// Prioritized HIGH — placed before Cerebras and OpenAI in the pipeline.
const DEFAULT_DEEPSEEK_MODELS = [
  'deepseek-chat',
  'deepseek-coder',
  'deepseek-reasoner',
];

// Builds the ordered list of candidate calls: preferred Gemini model first,
// then Gemini fallbacks, then DeepSeek (free, high capacity), then Cerebras,
// then OpenAI (paid, last resort).
function buildPipeline({
  geminiApiKey,
  cerebrasApiKey,
  openAiApiKey,
  deepSeekApiKey,
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
        model,
        fn: () => callGemini(geminiApiKey, model, prompt, { timeout, maxOutputTokens }),
      });
    });
  }

  // DeepSeek (FREE, 64K tokens) — placed before Cerebras and OpenAI
  if (deepSeekApiKey) {
    DEFAULT_DEEPSEEK_MODELS.forEach((model) => {
      pipeline.push({
        provider: 'DeepSeek',
        model,
        fn: () => callDeepSeek(deepSeekApiKey, model, prompt, { timeout, maxTokens: maxOutputTokens, systemPrompt }),
      });
    });
  }

  if (cerebrasApiKey) {
    DEFAULT_CEREBRAS_MODELS.forEach((model) => {
      pipeline.push({
        provider: 'Cerebras',
        model,
        fn: () => callCerebras(cerebrasApiKey, model, prompt, { timeout, maxTokens: maxOutputTokens, systemPrompt }),
      });
    });
  }

  if (openAiApiKey) {
    DEFAULT_OPENAI_MODELS.forEach((model) => {
      pipeline.push({
        provider: 'OpenAI',
        model,
        fn: () => callOpenAI(openAiApiKey, model, prompt, { timeout, maxTokens: maxOutputTokens, systemPrompt }),
      });
    });
  }

  return pipeline;
}

/**
 * Extracts the suggested retry delay (in milliseconds) from a Gemini API error
 * message. Gemini returns messages like "Please retry in 56.6s" or
 * "Please retry in 500ms". Returns 0 if no retry hint is found.
 */
function extractRetryDelayMs(errorMessage) {
  if (!errorMessage) return 0;
  const match = errorMessage.match(/Please retry in (\d+(?:\.\d+)?)(ms|s)/i);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  const delayMs = unit === 's' ? value * 1000 : value;
  return delayMs > 0 ? delayMs : 0;
}

/**
 * Checks if an error message indicates the model/API key is permanently
 * unavailable (e.g., "not available for new users", "forbidden", "403", "404").
 * These errors should NOT be retried — the pipeline should immediately
 * fall through to the next provider.
 */
function isUnavailableError(errorMessage) {
  if (!errorMessage) return false;
  const msg = errorMessage.toLowerCase();
  return (
    msg.includes('not available for new users') ||
    msg.includes('not available') ||
    msg.includes('new users') ||
    msg.includes('forbidden') ||
    msg.includes('403') ||
    msg.includes('404') ||
    msg.includes('permission denied') ||
    msg.includes('access denied') ||
    msg.includes('invalid api key') ||
    msg.includes('unauthorized')
  );
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

  // Strategy 1: direct parse
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    // Strategy 2: find the first { and try progressively shorter slices from the end
    const start = cleaned.indexOf('{');
    if (start >= 0) {
      // Try from last } backwards, then decreasing positions, to handle truncated JSON
      for (let end = cleaned.lastIndexOf('}'); end > start; end = cleaned.lastIndexOf('}', end - 1)) {
        try {
          const sliced = cleaned.slice(start, end + 1);
          const parsed = JSON.parse(sliced);
          // Only accept if parsed is a non-null object (not a primitive)
          if (parsed && typeof parsed === 'object') return parsed;
        } catch (e) {
          continue;
        }
      }
      // Strategy 3: progressive truncation — try adding a synthetic closing brace
      // at various positions to find the deepest valid parse
      const candidateEnd = cleaned.lastIndexOf('}', start + cleaned.length - start - 1);
      const searchFrom = candidateEnd > start ? candidateEnd : start + 100;
      for (let pos = Math.min(searchFrom, cleaned.length); pos > start; pos -= 10) {
        try {
          const sliced = cleaned.slice(start, pos) + '}';
          const parsed = JSON.parse(sliced);
          if (parsed && typeof parsed === 'object') return parsed;
        } catch (e) {
          continue;
        }
      }
      // Strategy 4: try with '}' appended at the very end
      try {
        const parsed = JSON.parse(cleaned.slice(start) + '}');
        if (parsed && typeof parsed === 'object') return parsed;
      } catch (e) {
        // fall through
      }
      // Strategy 5: Handle truncation inside string values
      // When JSON is cut off mid-string, we need to close the string and any
      // open objects/arrays. Walk backwards tracking string state.
      try {
        const result = recoverTruncatedJson(cleaned.slice(start));
        if (result && typeof result === 'object') return result;
      } catch (e) {
        // fall through
      }
      // Strategy 6: Try to find the last complete top-level key-value pair
      try {
        const lastComplete = findLastCompletePair(cleaned.slice(start));
        if (lastComplete) {
          const parsed = JSON.parse(lastComplete);
          if (parsed && typeof parsed === 'object') return parsed;
        }
      } catch (e) {
        // fall through
      }
    }
    throw error;
  }
}

/**
 * Attempts to recover a truncated JSON string by closing any open strings,
 * arrays, and objects. Walks backwards from the end tracking whether we're
 * inside a string, and what brackets are open.
 */
function recoverTruncatedJson(jsonStr) {
  let inString = false;
  let escapeNext = false;
  const openBrackets = [];

  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '{' || char === '[') {
      openBrackets.push(char);
    } else if (char === '}' || char === ']') {
      openBrackets.pop();
    }
  }

  // If we're inside a string, close it
  let result = jsonStr;
  if (inString) {
    result += '"';
  }

  // Close any trailing comma
  result = result.replace(/,\s*$/, '');

  // Close open brackets in reverse order
  for (let i = openBrackets.length - 1; i >= 0; i--) {
    result += openBrackets[i] === '{' ? '}' : ']';
  }

  return JSON.parse(result);
}

/**
 * Finds the last complete top-level key-value pair in a JSON string
 * and returns a valid JSON object up to that point.
 */
function findLastCompletePair(jsonStr) {
  let depth = 0;
  let inString = false;
  let escapeNext = false;
  let lastCompleteEnd = -1;

  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '{' || char === '[') {
      depth++;
    } else if (char === '}' || char === ']') {
      depth--;
      if (depth === 0) {
        let j = i + 1;
        while (j < jsonStr.length && (jsonStr[j] === ' ' || jsonStr[j] === '\n' || jsonStr[j] === '\t')) j++;
        if (j < jsonStr.length && jsonStr[j] === ',') {
          lastCompleteEnd = j;
        } else if (j >= jsonStr.length) {
          lastCompleteEnd = i + 1;
        }
      }
    }
  }

  if (lastCompleteEnd > 0) {
    return jsonStr.slice(0, lastCompleteEnd) + '}';
  }

  return null;
}

async function runPipeline(pipeline, { isValid, skipQualityCheck = false } = {}) {
  for (const candidate of pipeline) {
    try {
      const responseText = await candidate.fn(); // signal is already captured in fn closure
      // If the request was aborted, candidate.fn() might throw an AbortError.
      // This catch block will handle it.

      if (!responseText) continue;

      const clean = responseText.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
      const parsed = parseJsonResponse(clean);

      if (!parsed) continue;

      // Quality threshold check removed - accept all valid JSON
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
async function runConcurrentPipeline(pipeline, { isValid, maxRetries = 10, skipQualityCheck = false } = {}) {
  // Separate the recent model candidate from the rest.
  const recentCandidate = pipeline.find(
    (c) => c.provider === 'Gemini' && c.model === RECENT_GEMINI_MODEL
  );
  const otherCandidates = pipeline.filter(
    (c) => !(c.provider === 'Gemini' && c.model === RECENT_GEMINI_MODEL)
  );

  // Shared flag: once either source finds a valid result, stop new attempts.
  let settled = false;

  // Helper: try a single candidate, return { value, error }.
  // value is the result object on success; error is the error message on failure.
  async function tryCandidate(candidate) {
    if (settled) return { value: null, error: null };
    try {
      const responseText = await candidate.fn(); // signal is already captured in fn closure
      if (settled) return { value: null, error: null };
      if (!responseText) return { value: null, error: null };
      const clean = responseText.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
      const parsed = parseJsonResponse(clean);

      if (!parsed) return { value: null, error: null };

      // Quality threshold check removed - accept all valid JSON
      if (!isValid || isValid(parsed)) {
        return { value: { data: parsed, provider: `${candidate.provider} (${candidate.model})` }, error: null };
      }
      return { value: null, error: null };
    } catch (err) {
      if (err.name === 'AbortError') {
        console.warn(`[Concurrent Fallback] ${candidate.provider} (${candidate.model}) aborted.`);
        return { value: null, error: null };
      }
      console.warn(`[Concurrent Fallback] ${candidate.provider} (${candidate.model}) failed:`, err.message);
      return { value: null, error: err.message };
    }
  }

  // --- Recent model retry loop ---
  // Retries up to maxRetries times. Uses extractRetryDelayMs on the error
  // message (if available) plus an additional 1s. Falls back to exponential
  // backoff (2^attempt * 1000ms, capped at 30s) when no hint is present.
  const recentModelPromise = (async () => {
    if (!recentCandidate) return null;
    for (let attempt = 0; attempt < maxRetries; attempt += 1) {
      if (settled) return null;
      const result = await tryCandidate(recentCandidate);
      if (result.value) {
        settled = true;
        return result.value;
      }
      // Determine delay: use server hint + 1s, or exponential backoff
      const retryDelayMs = result.error ? extractRetryDelayMs(result.error) : 0;
      const delayMs = retryDelayMs > 0
        ? retryDelayMs + 1000
        : Math.min(1000 * Math.pow(2, attempt), 30000);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    return null;
  })();

  // --- Other models runner ---
  // Retries each batch of other candidates up to maxRetries times.
  // Uses extractRetryDelayMs on the error message (if available) plus an
  // additional 1s. Falls back to exponential backoff when no hint is present.
  const otherModelsPromise = (async () => {
    if (otherCandidates.length === 0) return null;
    for (let attempt = 0; attempt < maxRetries; attempt += 1) {
      if (settled) return null;
      const batchResults = await Promise.all(otherCandidates.map(tryCandidate));
      const validResult = batchResults.find((r) => r.value !== null);
      if (validResult) {
        settled = true;
        return validResult.value;
      }
      // Determine delay: use the first available server hint + 1s, or exponential backoff
      const firstError = batchResults.find((r) => r.error)?.error || '';
      const retryDelayMs = firstError ? extractRetryDelayMs(firstError) : 0;
      const delayMs = retryDelayMs > 0
        ? retryDelayMs + 1000
        : Math.min(1000 * Math.pow(2, attempt), 30000);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
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
 * Builds a pipeline using only Gemini models.
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
    modelList.forEach((model) => {
      pipeline.push({ provider: 'Gemini', model, fn: () => callGemini(geminiApiKey, model, prompt, { timeout, maxOutputTokens, signal }) });
    });
  }

  return pipeline;
}

/**
 * Builds a pipeline for BOW extraction using ALL available providers
 * (Gemini, DeepSeek, Cerebras, and OpenAI) simultaneously.
 *
 * DeepSeek is prioritized over Cerebras and OpenAI because:
 * - DeepSeek is FREE (no credit card required)
 * - DeepSeek has 64K output tokens (handles both BOW and lesson plans)
 * - Cerebras is unreliable for structured JSON output
 * - OpenAI is PAID (last resort only)
 *
 * @param {Object} params
 * @param {string} params.geminiApiKey
 * @param {string} params.cerebrasApiKey
 * @param {string} params.openAiApiKey
 * @param {string} params.deepSeekApiKey
 * @param {string} params.prompt
 * @param {number} params.timeout
 * @param {number} params.maxOutputTokens
 * @param {string} params.systemPrompt
 * @param {Array<string>} [params.models] - Optional Gemini model override; defaults to GEMINI_BOW_MODELS.
 */
function buildAllProvidersBowPipeline({
  geminiApiKey,
  cerebrasApiKey,
  openAiApiKey,
  deepSeekApiKey,
  selectedModel,
  prompt,
  timeout,
  maxOutputTokens,
  systemPrompt,
  signal,
  models,
}) {
  const pipeline = [];
  // Include the user's selectedModel in the Gemini model list (if not already present).
  // Filter out only truly unstable/preview models that don't reliably return JSON.
  const unstableModels = ['gemini-omni-flash-preview', 'gemini-2.5-flash-preview-tts', 'gemini-2.5-pro-preview-tts', 'gemini-2.5-flash-image', 'gemini-3-pro-image-preview', 'gemini-3-pro-image', 'nano-banana-pro-preview', 'gemini-3.1-flash-image-preview', 'gemini-3.1-flash-image', 'gemini-3.1-flash-lite-image', 'gemini-3.1-flash-tts-preview', 'gemini-robotics-er-1.5-preview', 'gemini-robotics-er-1.6-preview', 'gemini-2.5-computer-use-preview-10-2025', 'antigravity-preview-05-2026', 'deep-research-max-preview-04-2026', 'deep-research-preview-04-2026', 'deep-research-pro-preview-12-2025', 'lyria-3-clip-preview', 'lyria-3-pro-preview'];
  const modelList = Array.from(
    new Set(
      [selectedModel, ...(models || GEMINI_BOW_MODELS)].filter(Boolean).filter(m => !unstableModels.includes(m))
    )
  );

  if (geminiApiKey) {
    modelList.forEach((model) => {
      pipeline.push({ provider: 'Gemini', model, fn: () => callGemini(geminiApiKey, model, prompt, { timeout, maxOutputTokens, signal }) });
    });
  }

  // DeepSeek (FREE, 64K tokens) — placed before Cerebras and OpenAI
  if (deepSeekApiKey) {
    DEFAULT_DEEPSEEK_MODELS.forEach((model) => {
      pipeline.push({
        provider: 'DeepSeek',
        model,
        fn: () => callDeepSeek(deepSeekApiKey, model, prompt, { timeout, maxTokens: maxOutputTokens, systemPrompt }),
      });
    });
  }

  if (cerebrasApiKey) {
    DEFAULT_CEREBRAS_MODELS.forEach((model) => {
      pipeline.push({
        provider: 'Cerebras',
        model,
        fn: () => callCerebras(cerebrasApiKey, model, prompt, { timeout, maxTokens: maxOutputTokens, systemPrompt }),
      });
    });
  }

  if (openAiApiKey) {
    DEFAULT_OPENAI_MODELS.forEach((model) => {
      pipeline.push({
        provider: 'OpenAI',
        model,
        fn: () => callOpenAI(openAiApiKey, model, prompt, { timeout, maxTokens: maxOutputTokens, systemPrompt }),
      });
    });
  }

  return pipeline;
}

// ---------------------------------------------------------------------------
// Lesson Plan Generation Pipeline
// ---------------------------------------------------------------------------

// All stable Gemini models for lesson plan generation (same as BOW extraction).
// Includes all 14 text-generation models from the user's API key.
const LESSON_PLAN_GEMINI_FALLBACKS = [
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.1-pro-preview',
  'gemini-3-pro-preview',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-pro-latest',
];

/**
 * Builds a pipeline for detailed ilaw lesson plan generation.
 *
 * Strategy:
 * All models (Gemini, DeepSeek, Cerebras, OpenAI) are added to the pipeline
 * without any priority. All available providers with API keys will generate
 * concurrently, and the first valid result wins.
 *
 * @param {Object} params
 * @param {string} params.geminiApiKey
 * @param {string} params.cerebrasApiKey
 * @param {string} params.openAiApiKey
 * @param {string} params.deepSeekApiKey
 * @param {string} params.selectedModel
 * @param {string} params.prompt
 * @param {number} params.timeout
 * @param {number} params.maxOutputTokens
 * @param {string} params.systemPrompt
 */
function buildLessonPlanPipeline({
  geminiApiKey,
  cerebrasApiKey,
  openAiApiKey,
  deepSeekApiKey,
  selectedModel,
  prompt,
  timeout,
  maxOutputTokens,
  systemPrompt,
  signal,
}) {
  const pipeline = [];
  const unstableModels = ['gemini-omni-flash-preview', 'gemini-2.5-flash-preview-tts', 'gemini-2.5-pro-preview-tts', 'gemini-2.5-flash-image', 'gemini-3-pro-image-preview', 'gemini-3-pro-image', 'nano-banana-pro-preview', 'gemini-3.1-flash-image-preview', 'gemini-3.1-flash-image', 'gemini-3.1-flash-lite-image', 'gemini-3.1-flash-tts-preview', 'gemini-robotics-er-1.5-preview', 'gemini-robotics-er-1.6-preview', 'gemini-2.5-computer-use-preview-10-2025', 'antigravity-preview-05-2026', 'deep-research-max-preview-04-2026', 'deep-research-preview-04-2026', 'deep-research-pro-preview-12-2025', 'lyria-3-clip-preview', 'lyria-3-pro-preview'];

  if (geminiApiKey) {
    // All stable Gemini models - no priority, all run concurrently
    const allStableGeminiModels = Array.from(
      new Set(
        [
          selectedModel,
          ...LESSON_PLAN_GEMINI_FALLBACKS,
          ...DEFAULT_GEMINI_FALLBACKS,
          ...GEMINI_BOW_MODELS,
        ].filter(Boolean).filter(m => !unstableModels.includes(m))
      )
    );

    allStableGeminiModels.forEach((model) => {
      pipeline.push({
        provider: 'Gemini',
        model,
        isPrimary: false,
        fn: () => callGemini(geminiApiKey, model, prompt, { timeout, maxOutputTokens, signal }),
      });
    });
  }

  // DeepSeek (FREE, 64K tokens) — ALL models utilized
  if (deepSeekApiKey) {
    DEFAULT_DEEPSEEK_MODELS.forEach((model) => {
      pipeline.push({
        provider: 'DeepSeek',
        model,
        isPrimary: false,
        fn: () => callDeepSeek(deepSeekApiKey, model, prompt, { timeout, maxTokens: maxOutputTokens, systemPrompt, signal }),
      });
    });
  }

  // Cerebras — ALL models utilized
  if (cerebrasApiKey) {
    DEFAULT_CEREBRAS_MODELS.forEach((model) => {
      pipeline.push({
        provider: 'Cerebras',
        model,
        isPrimary: false,
        fn: () => callCerebras(cerebrasApiKey, model, prompt, { timeout, maxTokens: maxOutputTokens, systemPrompt, signal }),
      });
    });
  }

  // OpenAI — ALL models utilized
  if (openAiApiKey) {
    DEFAULT_OPENAI_MODELS.forEach((model) => {
      pipeline.push({
        provider: 'OpenAI',
        model,
        isPrimary: false,
        fn: () => callOpenAI(openAiApiKey, model, prompt, { timeout, maxTokens: maxOutputTokens, systemPrompt, signal }),
      });
    });
  }

  return pipeline;
}

/**
 * Concurrent retry pipeline for detailed ilaw lesson plan generation.
 *
 * Strategy:
 * All models in the pipeline run concurrently with a single retry loop.
 * The first valid result wins. No model has priority over another.
 *
 * @param {Array} pipeline - Full candidate list (from buildLessonPlanPipeline).
 * @param {Object} options
 * @param {Function} options.isValid - Optional validator for parsed JSON.
 * @param {number} options.maxRetries - Max retry loops (default 10).
 * @returns {Promise<{data, provider}|null>}
 */
async function runLessonPlanPipeline(pipeline, { isValid, maxRetries = 10, signal } = {}) {
  // Shared flag: once a valid result is found, stop new attempts.
  let settled = false;

  // Check if abort was requested
  const isAborted = () => signal && signal.aborted;

  // Helper: try a single candidate, return { value, error }.
  // value is the result object on success; error is the error message on failure.
  async function tryCandidate(candidate) {
    if (settled) return { value: null, error: null };
    if (isAborted()) return { value: null, error: null };
    try {
      const responseText = await candidate.fn(); // signal is already captured in fn closure
      if (settled) return { value: null, error: null };
      if (isAborted()) return { value: null, error: null };
      if (!responseText) return { value: null, error: null };
      const clean = responseText.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
      const parsed = parseJsonResponse(clean);

      if (!parsed) return { value: null, error: null };

      // Accept all valid JSON (quality threshold removed)
      if (!isValid || isValid(parsed)) {
        return { value: { data: parsed, provider: `${candidate.provider} (${candidate.model})` }, error: null };
      }
      return { value: null, error: null };
    } catch (err) {
      if (err.name === 'AbortError') {
        console.warn(`[LessonPlan Concurrent] ${candidate.provider} (${candidate.model}) aborted.`);
        return { value: null, error: null };
      }
      console.warn(`[LessonPlan Concurrent] ${candidate.provider} (${candidate.model}) failed:`, err.message);
      return { value: null, error: err.message };
    }
  }

  // --- Single retry loop for all models ---
  // All models run concurrently in each attempt.
  const allPromise = (async () => {
    if (pipeline.length === 0) return null;
    for (let attempt = 0; attempt < maxRetries; attempt += 1) {
      if (settled) return null;
      if (isAborted()) return null;
      
      // Double-check abort before launching batch
      if (isAborted()) return null;
      
      // Try all models concurrently - use Promise.allSettled with early abort
      const batchPromise = Promise.allSettled(pipeline.map(tryCandidate));
      
      // Wait for either: first valid result, all to complete, or abort signal
      const result = await Promise.race([
        batchPromise.then(results => {
          const validResult = results.find((r) => r.status === 'fulfilled' && r.value?.value !== null);
          if (validResult) {
            settled = true;
            return validResult.value.value;
          }
          return null;
        }),
        new Promise((resolve, reject) => {
          if (!signal) {
            resolve(null);
            return;
          }
          const timeoutId = setTimeout(() => resolve(null), 0);
          signal.addEventListener('abort', () => {
            clearTimeout(timeoutId);
            reject(new Error('Aborted'));
          }, { once: true });
        })
      ]);
      
      if (result) return result;
      if (isAborted()) return null;
      
      // Determine delay: use the first available server hint + 1s, or exponential backoff
      const batchResults = await batchPromise;
      const fulfilledResults = batchResults.filter(r => r.status === 'fulfilled');
      const firstError = fulfilledResults.find((r) => r.value?.error)?.value?.error || '';
      if (firstError && isUnavailableError(firstError)) {
        console.warn(`[LessonPlan Concurrent] Models permanently unavailable, skipping retries.`);
        return null;
      }
      const retryDelayMs = firstError ? extractRetryDelayMs(firstError) : 0;
      const delayMs = retryDelayMs > 0
        ? retryDelayMs + 1000
        : Math.min(1000 * Math.pow(2, attempt), 30000);
      
      // Wait with abort check
      await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(resolve, delayMs);
        if (signal) {
          signal.addEventListener('abort', () => {
            clearTimeout(timeoutId);
            reject(new Error('Aborted'));
          }, { once: true });
        }
      });
      
      // Final abort check after delay
      if (isAborted()) return null;
    }
    return null;
  })();

  return allPromise;
}

module.exports = {
  callGemini,
  callCerebras,
  callOpenAI,
  callDeepSeek,
  runConcurrentPipeline,
  buildBowPipeline,
  buildAllProvidersBowPipeline,
  buildLessonPlanPipeline,
  runLessonPlanPipeline,
  fetchWithTimeout,
  GEMINI_BOW_MODELS,
  RECENT_GEMINI_MODEL,
  LESSON_PLAN_GEMINI_FALLBACKS,
  DEFAULT_CEREBRAS_MODELS,
  DEFAULT_OPENAI_MODELS,
  DEFAULT_DEEPSEEK_MODELS,
};
