// lib/model-sorter.js
// Shared utilities for sorting AI model IDs from latest to oldest and
// filtering out unstable/preview models that don't reliably return JSON.

// ---------------------------------------------------------------------------
// Filtering: Non-text-generation models are filtered out so only models
// that can generate lesson plans (text/JSON output) are included.
// Filtered categories: image generators, TTS, audio, embedding, transcription,
// moderation, and other non-chat/non-text models.
// ---------------------------------------------------------------------------

/**
 * Returns true if a model ID should be filtered out as a non-text-generation
 * model (e.g. image generator, TTS, embedding, audio, transcription).
 * @param {string} modelId
 * @returns {boolean}
 */
export function isUnstableModel(modelId) {
  if (!modelId || typeof modelId !== 'string') return false;
  const id = modelId.toLowerCase();

  // Image generation models
  if (id.includes('imagen')) return true;
  if (id.includes('imagegen')) return true;
  if (id.includes('dall-e')) return true;
  if (id.includes('dalle')) return true;
  if (id.includes('stable-diffusion')) return true;
  if (id.includes('stable diffusion')) return true;
  if (id.includes('sdxl')) return true;
  if (id.includes('flux')) return true;
  if (id.includes('midjourney')) return true;
  if (id.includes('image-')) return true;
  if (id.includes('-image')) return true;
  if (id.includes('text-to-image')) return true;

  // TTS / audio / speech models
  if (id.includes('tts')) return true;
  if (id.includes('text-to-speech')) return true;
  if (id.includes('speech')) return true;
  if (id.includes('audio')) return true;
  if (id.includes('voice')) return true;
  if (id.includes('whisper')) return true;
  if (id.includes('transcrib')) return true;
  if (id.includes('transcription')) return true;
  if (id.includes('narator')) return true;
  if (id.includes('narrator')) return true;

  // Embedding models
  if (id.includes('embed')) return true;
  if (id.includes('embedding')) return true;

  // Moderation / safety models
  if (id.includes('moderation')) return true;
  if (id.includes('safety')) return true;
  if (id.includes('guard')) return true;

  // Vision-only / OCR models (not chat-capable)
  if (id.includes('ocr')) return true;
  if (id.includes('vision-only')) return true;

  // Code execution / tool models
  if (id.includes('code-execution')) return true;
  if (id.includes('code_execution')) return true;

  // Gemini-specific non-text models
  if (id.includes('aqa')) return true; // Gemini AQA (Atest Question Answering)
  if (id.includes('embedding-')) return true;
  if (id.includes('text-embedding')) return true;

  // Models that only support interactions API (not chat/completions)
  if (id.includes('interactions')) return true;

  // Obsolete / deprecated models
  if (id.includes('gpt-3.5-turbo-0301')) return true; // Old GPT-3.5 snapshot
  if (id.includes('gpt-3.5-turbo-0613')) return true; // Old GPT-3.5 snapshot
  if (id.includes('gpt-3.5-turbo-16k-0613')) return true; // Old GPT-3.5 16k snapshot
  if (id.includes('gpt-4-0314')) return true; // Old GPT-4 snapshot
  if (id.includes('gpt-4-32k-0314')) return true; // Old GPT-4 32k snapshot
  if (id.includes('gpt-4-0613')) return true; // Old GPT-4 snapshot
  if (id.includes('gpt-4-32k-0613')) return true; // Old GPT-4 32k snapshot
  if (id.includes('gpt-4-turbo-preview')) return true; // Deprecated preview
  if (id.includes('gpt-4-1106-preview')) return true; // Deprecated GPT-4 preview
  if (id.includes('gpt-4-0125-preview')) return true; // Deprecated GPT-4 preview
  if (id.includes('claude-instant-1')) return true; // Old Claude Instant
  if (id.includes('claude-2.0')) return true; // Old Claude 2.0
  if (id.includes('claude-2.1')) return true; // Old Claude 2.1
  if (id.includes('claude-3-opus-20240229')) return true; // Old Claude 3 Opus
  if (id.includes('claude-3-sonnet-20240229')) return true; // Old Claude 3 Sonnet
  if (id.includes('claude-3-haiku-20240307')) return true; // Old Claude 3 Haiku
  if (id.includes('gemini-1.0-pro')) return true; // Old Gemini 1.0 Pro
  if (id.includes('gemini-1.0-pro-vision')) return true; // Old Gemini 1.0 Pro Vision
  if (id.includes('gemini-1.5-pro-latest')) return true; // Deprecated "latest" alias
  if (id.includes('gemini-pro-vision')) return true; // Old Gemini Pro Vision
  if (id.includes('gemini-1.5-flash-latest')) return true; // Deprecated "latest" alias
  if (id.includes('gemini-2.0-flash-thinking')) return true; // Deprecated thinking model
  if (id.includes('llama-2-')) return true; // Old Llama 2 models
  if (id.includes('llama-2-7b')) return true; // Old Llama 2 7B
  if (id.includes('llama-2-13b')) return true; // Old Llama 2 13B
  if (id.includes('llama-2-70b')) return true; // Old Llama 2 70B
  if (id.includes('llama-2-7b-chat')) return true; // Old Llama 2 7B Chat
  if (id.includes('llama-2-13b-chat')) return true; // Old Llama 2 13B Chat
  if (id.includes('llama-2-70b-chat')) return true; // Old Llama 2 70B Chat
  if (id.includes('llama-3-8b')) return true; // Old Llama 3 8B (superseded by 3.1/3.2)
  if (id.includes('llama-3-70b')) return true; // Old Llama 3 70B (superseded by 3.1/3.2)
  if (id.includes('mixtral-8x7b-instruct-v0.1')) return true; // Old Mixtral v0.1
  if (id.includes('mistral-7b-instruct-v0.1')) return true; // Old Mistral 7B v0.1
  if (id.includes('mistral-7b-instruct-v0.2')) return true; // Old Mistral 7B v0.2
  if (id.includes('mistral-7b-instruct-v0.3')) return true; // Old Mistral 7B v0.3
  if (id.includes('deepseek-coder-v1.5')) return true; // Old DeepSeek Coder v1.5
  if (id.includes('deepseek-coder-v2-lite')) return true; // Old DeepSeek Coder v2 Lite
  if (id.includes('deepseek-chat-v2')) return true; // Old DeepSeek Chat v2
  if (id.includes('command-light')) return true; // Old Cohere Command Light
  if (id.includes('command-nightly')) return true; // Old Cohere Command Nightly
  if (id.includes('gemini-pro')) return true; // Old Gemini Pro (1.0)

  return false;
}

// ---------------------------------------------------------------------------
// Version extraction helpers — parse a numeric version tuple from a model ID.
// Examples:
//   "gemini-2.5-pro"        -> [2, 5]
//   "gemini-2.0-flash-lite" -> [2, 0]
//   "gpt-4o"                -> [4, 0]   (o -> 0)
//   "gpt-4o-mini"           -> [4, 0]
//   "gpt-4-turbo"           -> [4, 0]
//   "gpt-3.5-turbo"         -> [3, 5]
//   "o1-preview"            -> [0, 1]   (filtered out anyway)
//   "llama-3.3-70b"         -> [3, 3]
//   "llama-3.1-8b"          -> [3, 1]
//   "deepseek-chat"         -> [0, 0]   (no version -> lowest)
//   "deepseek-reasoner"     -> [0, 0]
// ---------------------------------------------------------------------------

/**
 * Extracts a numeric version tuple from a model ID for sorting purposes.
 * Falls back to [0, 0] when no version is found.
 * @param {string} modelId
 * @returns {number[]}
 */
export function extractVersionTuple(modelId) {
  if (!modelId || typeof modelId !== 'string') return [0, 0];
  const id = modelId.toLowerCase();

  // Match patterns like "2.5", "2.0", "3.3", "3.1", "4o", "4-turbo", "3.5"
  // Try decimal version first (e.g. 2.5, 3.3)
  const decimalMatch = id.match(/(\d+)\.(\d+)/);
  if (decimalMatch) {
    return [parseInt(decimalMatch[1], 10), parseInt(decimalMatch[2], 10)];
  }

  // Try "N<word>" like "4o", "4-turbo", "3-turbo"
  const intMatch = id.match(/(\d+)(?:[o\-]|$)/);
  if (intMatch) {
    return [parseInt(intMatch[1], 10), 0];
  }

  return [0, 0];
}

/**
 * Computes a "tier" score for a model family so that more capable variants
 * rank higher within the same version. Higher = newer/better.
 *
 * Tier bonuses:
 *   pro          -> 100
 *   flash        -> 80
 *   flash-lite   -> 60
 *   lite         -> 50
 *   mini         -> 40
 *   turbo        -> 30
 *   chat         -> 20
 *   reasoner     -> 90   (reasoning models are high-tier)
 *   coder        -> 70
 *   (none)       -> 10
 *
 * @param {string} modelId
 * @returns {number}
 */
export function modelTierScore(modelId) {
  if (!modelId) return 0;
  const id = modelId.toLowerCase();
  if (id.includes('reasoner')) return 90;
  if (id.includes('pro')) return 100;
  if (id.includes('flash-lite') || id.includes('flash_lite')) return 55;
  if (id.includes('flash')) return 80;
  if (id.includes('coder')) return 70;
  if (id.includes('lite')) return 50;
  if (id.includes('mini')) return 30;
  if (id.includes('turbo')) return 40;
  if (id.includes('chat')) return 20;
  // Base model with no suffix is the flagship — rank above turbo/mini/lite
  return 60;
}

/**
 * Computes a composite sort key for a model. Higher = newer/better.
 * Combines version tuple, tier, and a size bonus (e.g. 70b > 8b).
 *
 * @param {string} modelId
 * @returns {number}
 */
export function modelRecencyScore(modelId) {
  const [major, minor] = extractVersionTuple(modelId);
  const tier = modelTierScore(modelId);

  // Size bonus: "70b" -> 70, "8b" -> 8, "405b" -> 405
  let sizeBonus = 0;
  const sizeMatch = (modelId || '').toLowerCase().match(/(\d+)b\b/);
  if (sizeMatch) sizeBonus = parseInt(sizeMatch[1], 10) / 100; // normalize to <10

  // "omni" bonus: models like "gpt-4o" (o = omni) are newer flagships.
  // Add a small bonus so gpt-4o ranks above gpt-4 (both version [4,0], tier 60).
  let omniBonus = 0;
  const id = (modelId || '').toLowerCase();
  // Match "4o" but not "4o-mini" (mini is handled by tier)
  if (/\d+o(?![a-z])/.test(id) && !id.includes('mini')) {
    omniBonus = 5;
  }

  // Composite: major * 10000 + minor * 100 + tier + sizeBonus + omniBonus
  return major * 10000 + minor * 100 + tier + sizeBonus + omniBonus;
}

/**
 * Sorts an array of model IDs from latest (highest recency) to oldest.
 * Returns a new array; does not mutate the input.
 *
 * @param {string[]} modelIds
 * @returns {string[]}
 */
export function sortModelsLatestFirst(modelIds) {
  if (!Array.isArray(modelIds)) return [];
  return [...modelIds].sort((a, b) => modelRecencyScore(b) - modelRecencyScore(a));
}

/**
 * Filters out unstable/preview models and sorts the rest latest-first.
 *
 * @param {string[]} modelIds
 * @returns {string[]}
 */
export function filterAndSortModels(modelIds) {
  if (!Array.isArray(modelIds)) return [];
  // Filter out non-text-generation models (image, TTS, embedding, etc.)
  // then sort the remaining text-capable models latest-first.
  const textModels = modelIds.filter((id) => !isUnstableModel(id));
  return sortModelsLatestFirst(textModels);
}

// ---------------------------------------------------------------------------
// Provider-specific model list parsers
// ---------------------------------------------------------------------------

/**
 * Parses the Gemini /v1beta/models response into a sorted list of
 * content-generation model IDs (latest first), excluding unstable models.
 *
 * @param {Array} models - raw `data.models` from the Gemini API
 * @returns {string[]}
 */
export function parseGeminiModels(models) {
  if (!Array.isArray(models)) return [];
  // Filter to include only models that can generate content, which is the
  // core requirement for this application. Also exclude models whose
  // description clearly states they only support the Interactions API.
  const ids = models
    .filter((m) => {
      // Must explicitly support content generation
      if (!m.supportedGenerationMethods || !m.supportedGenerationMethods.includes('generateContent')) return false;
      // Exclude models that advertise Interactions-only support in their description
      const desc = (m.description || m.displayName || m.summary || '').toString().toLowerCase();
      if (desc.includes('this model only supports interactions api')) return false;
      return true;
    })
    .map((m) => (m.name || '').replace(/^models\//, ''))
    .filter(Boolean);
  return filterAndSortModels(ids);
}

/**
 * Parses an OpenAI-compatible /v1/models response (Cerebras, OpenAI,
 * DeepSeek) into a sorted list of model IDs (latest first), excluding
 * unstable models.
 *
 * @param {Array} data - raw `data` array from the models endpoint
 * @returns {string[]}
 */
export function parseOpenAICompatibleModels(data) {
  if (!Array.isArray(data)) return [];
  // Exclude models that explicitly state they only support the Interactions API
  // which are not suitable for chat/completion/text-generation flows used here.
  const ids = data
    .filter((m) => {
      if (!m) return false;
      // If item is a string (ID), include it — we can't inspect description
      if (typeof m === 'string') return true;
      const desc = (m.description || m.summary || m.long_description || '').toString().toLowerCase();
      if (desc.includes('this model only supports interactions api')) return false;
      return true;
    })
    .map((m) => (typeof m === 'string' ? m : (m.id || m.name || '')))
    .filter(Boolean);
  return filterAndSortModels(ids);
}

/**
 * Given a sorted (latest-first) list of model IDs, returns the primary
 * model — the first (latest) entry. Returns null if the list is empty.
 *
 * @param {string[]} sortedModelIds
 * @returns {string|null}
 */
export function getPrimaryModel(sortedModelIds) {
  if (!Array.isArray(sortedModelIds) || sortedModelIds.length === 0) return null;
  return sortedModelIds[0];
}