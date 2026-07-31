// lib/ai-providers.js
// Shared logic for calling Gemini with timeouts and fallback.
// Both /api/generate and /api/extract-bow import from here.
//
// Default models are the dynamically determined and sorted model lists
// (latest-first) provided by the caller. There is no hardcoded fallback model.

import { filterAndSortModels, filterImageGenerationModels, NANO_BANANA_PRO_MODEL } from './model-sorter';

async function fetchWithTimeout(resource, options = {}, timeout = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort('Request timed out'), timeout);
  const externalSignal = options?.signal;

  const abortHandler = () => {
    controller.abort('External signal aborted');
  };

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort('External signal already aborted');
    } else {
      externalSignal.addEventListener('abort', abortHandler, { once: true });
    }
  }

  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (err) {
    if (err.name === 'AbortError') {
      if (externalSignal?.aborted) {
        throw err;
      }
      throw new Error(`Request timed out after ${timeout / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(id);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', abortHandler);
    }
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

/**
 * Concurrent retry pipeline for BOW extraction.
 */
async function runConcurrentPipeline(pipeline, { isValid, maxRetries = 10 } = {}) {
  let settled = false;

  async function tryCandidate(candidate) {
    if (settled) return { value: null, error: null };
    try {
      const responseText = await candidate.fn();
      if (settled) return { value: null, error: null };
      if (!responseText) return { value: null, error: null };
      const clean = responseText.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
      const parsed = parseJsonResponse(clean);

      if (!parsed) return { value: null, error: null };

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

  const allPromise = (async () => {
    if (pipeline.length === 0) return null;
    for (let attempt = 0; attempt < maxRetries; attempt += 1) {
      if (settled) return null;
      const batchResults = await Promise.all(pipeline.map(tryCandidate));
      const validResult = batchResults.find((r) => r.value !== null);
      if (validResult) {
        settled = true;
        return validResult.value;
      }
      const firstError = batchResults.find((r) => r.error)?.error || '';
      if (firstError && isUnavailableError(firstError)) {
        console.warn(`[Concurrent Fallback] Models permanently unavailable, skipping retries.`);
        return null;
      }
      const retryDelayMs = firstError ? extractRetryDelayMs(firstError) : 0;
      const delayMs = retryDelayMs > 0
        ? retryDelayMs + 1000
        : Math.min(1000 * Math.pow(2, attempt), 30000);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    return null;
  })();

  return allPromise;
}

/**
 * Builds a pipeline for BOW extraction using Gemini.
 */
function buildAllProvidersBowPipeline({
  geminiApiKey,
  prompt,
  timeout,
  maxOutputTokens,
  signal,
  geminiModels,
}) {
  const pipeline = [];
  // Normalize and filter incoming model lists to ensure only text-generation capable models are used.
  const geminiList = filterAndSortModels(geminiModels);

  if (geminiApiKey) {
    geminiList.forEach((model) => {
      pipeline.push({ provider: 'Gemini', model, fn: () => callGemini(geminiApiKey, model, prompt, { timeout, maxOutputTokens, signal }) });
    });
  }

  return pipeline;
}

// ---------------------------------------------------------------------------
// Lesson Plan Generation Pipeline
// ---------------------------------------------------------------------------

/**
 * Builds a pipeline for detailed ilaw lesson plan generation.
 *
 * Strategy:
 * Gemini models are added to the pipeline. Only Gemini is used.
 */
function buildLessonPlanPipeline({
  geminiApiKey,
  prompt,
  timeout,
  maxOutputTokens,
  systemPrompt,
  signal,
  geminiModels,
}) {
  const pipeline = [];

  if (geminiApiKey) {
    // Normalize and filter Gemini model list so only text-capable models are used.
    const allGeminiModels = filterAndSortModels(geminiModels);
    const primarySet = new Set(allGeminiModels.length > 0 ? [allGeminiModels[0]] : []);

    allGeminiModels.forEach((model) => {
      pipeline.push({
        provider: 'Gemini',
        model,
        isPrimary: primarySet.has(model),
        fn: () => callGemini(geminiApiKey, model, prompt, { timeout, maxOutputTokens, signal }),
      });
    });
  }

  return pipeline;
}

/**
 * Concurrent retry pipeline for detailed ilaw lesson plan generation.
 */
async function runLessonPlanPipeline(pipeline, { isValid, maxRetries = 10, signal } = {}) {
  let settled = false;

  const isAborted = () => signal && signal.aborted;

  async function tryCandidate(candidate) {
    if (settled) return { value: null, error: null };
    if (isAborted()) return { value: null, error: null };
    try {
      const responseText = await candidate.fn();
      if (settled) return { value: null, error: null };
      if (isAborted()) return { value: null, error: null };
      if (!responseText) return { value: null, error: null };
      const clean = responseText.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
      const parsed = parseJsonResponse(clean);

      if (!parsed) return { value: null, error: null };

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

  const allPromise = (async () => {
    if (pipeline.length === 0) return null;
    for (let attempt = 0; attempt < maxRetries; attempt += 1) {
      if (settled) return null;
      if (isAborted()) return null;

      const batchPromise = Promise.allSettled(pipeline.map(tryCandidate));
      const batchResults = await batchPromise;
      const validResult = batchResults.find((result) => result.status === 'fulfilled' && result.value?.value !== null);

      if (validResult) {
        settled = true;
        return validResult.value.value;
      }
      if (isAborted()) return null;

      const fulfilledResults = batchResults.filter((result) => result.status === 'fulfilled');
      const firstError = fulfilledResults.find((result) => result.value?.error)?.value?.error || '';
      if (firstError && isUnavailableError(firstError)) {
        console.warn(`[LessonPlan Concurrent] Models permanently unavailable, skipping retries.`);
        return null;
      }
      const retryDelayMs = firstError ? extractRetryDelayMs(firstError) : 0;
      const delayMs = retryDelayMs > 0
        ? retryDelayMs + 1000
        : Math.min(1000 * Math.pow(2, attempt), 30000);

      await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(resolve, delayMs);
        if (signal) {
          signal.addEventListener('abort', () => {
            clearTimeout(timeoutId);
            reject(new Error('Aborted'));
          }, { once: true });
        }
      });

      if (isAborted()) return null;
    }
    return null;
  })();

  return allPromise;
}

/**
 * Calls an image-generation model (e.g., Nano Banana Pro / Imagen) to produce
 * an image from a text prompt. Returns the generated image as a base64 data
 * URL, or null on failure.
 *
 * This is used by the slide generation pipeline to create actual visual
 * outputs for slide decks, as used in Gemini Notebook.
 */
async function generateImage(apiKey, model, prompt, { timeout = 30000, signal } = {}) {
  // For Imagen models, use the dedicated imagen endpoint
  if (model.includes('imagen')) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`;

    const fetchOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: '16:9',
          safetyFilterLevel: 'block_some',
        },
      }),
      signal,
    };

    const response = await fetchWithTimeout(url, fetchOptions, timeout);

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Image generation API (${model}) status ${response.status}`);
    }

    const data = await response.json();
    
    // Imagen API returns base64 encoded images
    const base64Image = data.predictions?.[0]?.bytesBase64Encoded;
    if (base64Image) {
      return `data:image/png;base64,${base64Image}`;
    }

    // Fallback: check for image URL in response
    const imageUrl = data.predictions?.[0]?.imageUri || data.predictions?.[0]?.url;
    if (imageUrl) {
      return imageUrl;
    }

    return null;
  }

  // For other image generation models (e.g., nano-banana-pro), use generateContent
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const fetchOptions = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['IMAGE'],
      },
    }),
    signal,
  };

  const response = await fetchWithTimeout(url, fetchOptions, timeout);

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Image generation API (${model}) status ${response.status}`);
  }

  const data = await response.json();
  
  // Check for inline image data in the response
  const parts = data.candidates?.[0]?.content?.parts;
  if (parts && Array.isArray(parts)) {
    for (const part of parts) {
      // Check for inline data (base64 image)
      if (part.inlineData && part.inlineData.mimeType && part.inlineData.data) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
      
      // Check for text containing image URL
      if (part.text) {
        try {
          const parsed = JSON.parse(part.text);
          if (parsed.imageUrl || parsed.url) {
            return parsed.imageUrl || parsed.url;
          }
        } catch {
          // Not JSON, might be a markdown image URL
          const match = part.text.match(/!\[.*?\]\((.*?)\)/);
          if (match) return match[1];
          if (part.text.startsWith('http')) return part.text.trim();
        }
      }
    }
  }

  return null;
}

export {
  callGemini,
  runConcurrentPipeline,
  buildAllProvidersBowPipeline,
  buildLessonPlanPipeline,
  runLessonPlanPipeline,
  fetchWithTimeout,
  generateImage,
};
