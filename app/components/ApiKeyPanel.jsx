'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Lightbulb, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { showToast } from './Toast';
import ApiKeyInstructionsModal from './ApiKeyInstructionsModal';
import { getCookie, setCookie, removeCookie } from '../../lib/cookie';

// All Gemini models verified against Google's actual API (fetched via the user's key).
// All 14 text-generation models are included for maximum compatibility.
const DEFAULT_GEMINI_MODELS = [
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (gemini-2.5-pro)' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (gemini-2.5-flash)' },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite (gemini-2.5-flash-lite)' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (gemini-2.0-flash)' },
  { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash-Lite (gemini-2.0-flash-lite)' },
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash (gemini-3.6-flash)' },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash (gemini-3.5-flash)' },
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite (gemini-3.5-flash-lite)' },
  { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash-Lite (gemini-3.1-flash-lite)' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview (gemini-3.1-pro-preview)' },
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro Preview (gemini-3-pro-preview)' },
  { id: 'gemini-flash-latest', name: 'Gemini Flash Latest (gemini-flash-latest)' },
  { id: 'gemini-flash-lite-latest', name: 'Gemini Flash-Lite Latest (gemini-flash-lite-latest)' },
  { id: 'gemini-pro-latest', name: 'Gemini Pro Latest (gemini-pro-latest)' },
];

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export default function ApiKeyPanel({
  onApiKeyChange,
  onCerebrasApiKeyChange,
  onOpenAiApiKeyChange,
  onDeepSeekApiKeyChange,
  onSelectedModelChange,
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalProvider, setModalProvider] = useState('');

  const [apiKey, setApiKey] = useState(getCookie('apikey') || '');
  const [cerebrasApiKey, setCerebrasApiKey] = useState('');
  const [openAiApiKey, setOpenAiApiKey] = useState('');
  const [deepSeekApiKey, setDeepSeekApiKey] = useState('');

  // Default to gemini-2.5-pro (most capable real model)
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-pro');
  const [availableModels, setAvailableModels] = useState(DEFAULT_GEMINI_MODELS);
  const [autoDetectStatus, setAutoDetectStatus] = useState('');
  const [isDetecting, setIsDetecting] = useState(false);
  const [keyIsValid, setKeyIsValid] = useState(false);

  const [cerebrasKeyIsValid, setCerebrasKeyIsValid] = useState(false);
  const [isDetectingCerebras, setIsDetectingCerebras] = useState(false);

  const [openAiKeyIsValid, setOpenAiKeyIsValid] = useState(false);
  const [isDetectingOpenAi, setIsDetectingOpenAi] = useState(false);

  const [deepSeekKeyIsValid, setDeepSeekKeyIsValid] = useState(false);
  const [isDetectingDeepSeek, setIsDetectingDeepSeek] = useState(false);

  const openModal = (provider) => {
    setModalProvider(provider);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalProvider('');
  };

  const handleAutoDetectModels = useCallback(async (keyToTest) => {
    const targetKey = keyToTest;
    if (!targetKey || targetKey.trim() === '') {
      setAutoDetectStatus('');
      setKeyIsValid(false);
      return;
    }

    setIsDetecting(true);
    setAutoDetectStatus('');

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${targetKey}`);
      const data = await res.json();

      if (data.models && data.models.length > 0) {
        const contentModels = data.models.filter((m) =>
          m.supportedGenerationMethods?.includes('generateContent')
        );

        // Filter out unstable/preview models that don't reliably return JSON
        const unstableModels = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.1-pro-preview', 'gemini-3-pro-preview', 'gemini-omni-flash-preview', 'gemini-2.5-flash-preview-tts', 'gemini-2.5-pro-preview-tts', 'gemini-2.5-flash-image', 'gemini-3-pro-image-preview', 'gemini-3-pro-image', 'nano-banana-pro-preview', 'gemini-3.1-flash-image-preview', 'gemini-3.1-flash-image', 'gemini-3.1-flash-lite-image', 'gemini-3.1-flash-tts-preview', 'gemini-robotics-er-1.5-preview', 'gemini-robotics-er-1.6-preview', 'gemini-2.5-computer-use-preview-10-2025', 'antigravity-preview-05-2026', 'deep-research-max-preview-04-2026', 'deep-research-preview-04-2026', 'deep-research-pro-preview-12-2025', 'lyria-3-clip-preview', 'lyria-3-pro-preview'];
        const stableModels = contentModels.filter((m) => {
          const cleanId = m.name.replace('models/', '');
          return !unstableModels.includes(cleanId);
        });

        const formattedModels = stableModels.map((m) => {
          const cleanId = m.name.replace('models/', '');
          return {
            id: cleanId,
            name: `${m.displayName || cleanId} (${cleanId})`,
          };
        });

        if (formattedModels.length > 0) {
          setAvailableModels(formattedModels);
          setKeyIsValid(true);

          // Find a preferred flash model
          let preferredModel = formattedModels.find(
            (m) => m.id.includes('flash')
          );

          if (formattedModels.some((m) => m.id === selectedModel)) {
            setSelectedModel(selectedModel);
            onSelectedModelChange(selectedModel);
          } else if (preferredModel) {
            setSelectedModel(preferredModel.id);
            onSelectedModelChange(preferredModel.id);
          } else {
            setSelectedModel(formattedModels[0].id);
            onSelectedModelChange(formattedModels[0].id);
          }

          setAutoDetectStatus(`Success! Key verified & auto-detected ${formattedModels.length} compatible models.`);
        } else {
          setKeyIsValid(false);
          setAutoDetectStatus('Error: No content generation models detected for this key.');
        }
      } else if (data.error) {
        setKeyIsValid(false);
        setAutoDetectStatus(`Error: ${data.error.message}`);
      }
    } catch (err) {
      setKeyIsValid(false);
      setAutoDetectStatus(`Error fetching models: ${err.message}`);
    } finally {
      setIsDetecting(false);
    }
  }, [selectedModel, onSelectedModelChange]);

  const debouncedAutoDetect = useCallback(
    debounce((key) => handleAutoDetectModels(key), 600),
    [handleAutoDetectModels]
  );

  const handleVerifyProviderKey = useCallback(async (provider, key) => {
    if (!key || key.trim() === '') {
      if (provider === 'cerebras') setCerebrasKeyIsValid(false);
      if (provider === 'openai') setOpenAiKeyIsValid(false);
      if (provider === 'deepseek') setDeepSeekKeyIsValid(false);
      return;
    }

    let url, options, setDetecting, setValid;

    if (provider === 'cerebras') {
      url = 'https://api.cerebras.ai/v1/models';
      options = { headers: { Authorization: `Bearer ${key}` } };
      setDetecting = setIsDetectingCerebras;
      setValid = setCerebrasKeyIsValid;
    } else if (provider === 'openai') {
      url = 'https://api.openai.com/v1/models';
      options = { headers: { Authorization: `Bearer ${key}` } };
      setDetecting = setIsDetectingOpenAi;
      setValid = setOpenAiKeyIsValid;
    } else if (provider === 'deepseek') {
      url = 'https://api.deepseek.com/v1/models';
      options = { headers: { Authorization: `Bearer ${key}` } };
      setDetecting = setIsDetectingDeepSeek;
      setValid = setDeepSeekKeyIsValid;
    } else {
      return;
    }

    setDetecting(true);
    setValid(false);

    try {
      const res = await fetch(url, options);
      setValid(res.ok);
    } catch (err) {
      setValid(false);
    } finally {
      setDetecting(false);
    }
  }, []);

  const debouncedVerifyCerebras = useCallback(
    debounce((key) => handleVerifyProviderKey('cerebras', key), 600),
    []
  );
  const debouncedVerifyOpenAi = useCallback(
    debounce((key) => handleVerifyProviderKey('openai', key), 600),
    []
  );
  const debouncedVerifyDeepSeek = useCallback(
    debounce((key) => handleVerifyProviderKey('deepseek', key), 600),
    []
  );

  useEffect(() => {
    const savedGemini = localStorage.getItem('gemini_api_key');
    const savedCerebras = localStorage.getItem('cerebras_api_key');
    const savedOpenAi = localStorage.getItem('openai_api_key');
    const savedDeepSeek = localStorage.getItem('deepseek_api_key');
    const savedSelectedModel = localStorage.getItem('selectedModel');

    if (savedCerebras) {
      setCerebrasApiKey(savedCerebras);
      onCerebrasApiKeyChange(savedCerebras);
      handleVerifyProviderKey('cerebras', savedCerebras);
    }
    if (savedOpenAi) {
      setOpenAiApiKey(savedOpenAi);
      onOpenAiApiKeyChange(savedOpenAi);
      handleVerifyProviderKey('openai', savedOpenAi);
    }
    if (savedDeepSeek) {
      setDeepSeekApiKey(savedDeepSeek);
      onDeepSeekApiKeyChange(savedDeepSeek);
      handleVerifyProviderKey('deepseek', savedDeepSeek);
    }

    if (savedGemini) {
      setApiKey(savedGemini);
      onApiKeyChange(savedGemini);
      handleAutoDetectModels(savedGemini);
    }

    if (savedSelectedModel && DEFAULT_GEMINI_MODELS.some(m => m.id === savedSelectedModel)) {
        setSelectedModel(savedSelectedModel);
        onSelectedModelChange(savedSelectedModel);
    } else if (DEFAULT_GEMINI_MODELS.length > 0) {
        setSelectedModel(DEFAULT_GEMINI_MODELS[0].id);
        onSelectedModelChange(DEFAULT_GEMINI_MODELS[0].id);
    }

  }, [onApiKeyChange, onCerebrasApiKeyChange, onOpenAiApiKeyChange, onDeepSeekApiKeyChange, onSelectedModelChange, handleAutoDetectModels, handleVerifyProviderKey]);

  const onGeminiChange = useCallback(
    (e) => {
      const val = e.target.value;
      setApiKey(val);
      setCookie('apikey', val);
      localStorage.setItem('gemini_api_key', val);
      onApiKeyChange(val);
      debouncedAutoDetect(val);
    },
    [onApiKeyChange, debouncedAutoDetect]
  );

  const onCerebrasChange = useCallback(
    (e) => {
      const val = e.target.value;
      setCerebrasApiKey(val);
      localStorage.setItem('cerebras_api_key', val);
      onCerebrasApiKeyChange(val);
      debouncedVerifyCerebras(val);
    },
    [onCerebrasApiKeyChange, debouncedVerifyCerebras]
  );

  const onOpenAiChange = useCallback(
    (e) => {
      const val = e.target.value;
      setOpenAiApiKey(val);
      localStorage.setItem('openai_api_key', val);
      onOpenAiApiKeyChange(val);
      debouncedVerifyOpenAi(val);
    },
    [onOpenAiApiKeyChange, debouncedVerifyOpenAi]
  );

  const onDeepSeekChange = useCallback(
    (e) => {
      const val = e.target.value;
      setDeepSeekApiKey(val);
      localStorage.setItem('deepseek_api_key', val);
      onDeepSeekApiKeyChange(val);
      debouncedVerifyDeepSeek(val);
    },
    [onDeepSeekApiKeyChange, debouncedVerifyDeepSeek]
  );

  const onModelChange = useCallback(
    (e) => {
      const val = e.target.value;
      setSelectedModel(val);
      localStorage.setItem('selectedModel', val);
      onSelectedModelChange(val);
    },
    [onSelectedModelChange]
  );

  return (
    <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 sm:p-8 space-y-5 shadow-lg">
      
      {/* 1. GEMINI CARD */}
      <div className="bg-[#1C142D] border border-[#6B46C1]/50 rounded-2xl p-5 space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <label className="block text-sm sm:text-base font-bold text-purple-300 flex items-center gap-2">
            <span>✨</span> Google Gemini API Key <span className="text-purple-400 font-normal">* (required)</span>
          </label>
          <button
            onClick={() => openModal('gemini')}
            className="text-xs font-semibold text-purple-400 hover:text-purple-200 underline"
          >
            How to get a key?
          </button>
        </div>

        <form onSubmit={(e) => e.preventDefault()}>
            <input type="text" name="username" autoComplete="username" className="hidden" tabIndex={-1} />
            <input
                type="password"
                autoComplete="new-password"
                value={apiKey}
                onChange={onGeminiChange}
                placeholder="Paste your Gemini API key (from aistudio.google.com)"
                className={`w-full bg-slate-900 border rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 focus:ring-2 focus:outline-none font-mono ${
                  autoDetectStatus.startsWith('Error')
                    ? 'border-red-500/60 focus:ring-red-500'
                    : keyIsValid
                    ? 'border-emerald-500/60 focus:ring-emerald-500'
                    : 'border-purple-800/60 focus:ring-purple-500'
                }`}
            />
        </form>

        {isDetecting && (
          <span className="text-xs text-purple-400 font-semibold flex items-center gap-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying...
          </span>
        )}
        {keyIsValid && !isDetecting && (
          <span className="text-xs text-emerald-300 bg-emerald-950/60 border border-emerald-800 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Key Verified
          </span>
        )}
        {autoDetectStatus.startsWith('Error') && (
            <p className="text-xs text-red-400 font-medium mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {autoDetectStatus}
            </p>
        )}
        
        <p className="text-xs text-purple-300/80 leading-relaxed">
          Required — free, takes ~2 minutes at{' '}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="font-bold underline text-purple-300 hover:text-purple-100">
            aistudio.google.com/apikey
          </a>
          . Use your existing Gmail account, no separate signup. Keys are stored for this browser session only and are not shared.
        </p>
      </div>

      {/* 2. DEEPSEEK CARD — FREE alternative with 64K tokens, handles both BOW and lesson plans */}
      <div className="bg-[#0F1A1F] border border-[#2DD4BF]/40 rounded-2xl p-5 space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <label className="block text-sm sm:text-base font-bold text-teal-300 flex items-center gap-2">
            <span>🧠</span> DeepSeek API Key <span className="text-teal-400 font-normal">(strongly recommended — FREE)</span>
          </label>
          <button
            onClick={() => openModal('deepseek')}
            className="text-xs font-semibold text-teal-400 hover:text-teal-200 underline"
          >
            How to get a key?
          </button>
        </div>
        <form onSubmit={(e) => e.preventDefault()}>
            <input
                type="password"
                autoComplete="new-password"
                value={deepSeekApiKey}
                onChange={onDeepSeekChange}
                placeholder="Paste your DeepSeek API key (free, 64K tokens)"
                className="w-full bg-slate-900 border border-teal-800/60 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-teal-500 focus:outline-none font-mono"
            />
        </form>
        {isDetectingDeepSeek && (
          <span className="text-xs text-teal-400 font-semibold flex items-center gap-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying...
          </span>
        )}
        {deepSeekKeyIsValid && !isDetectingDeepSeek && (
          <span className="text-xs text-emerald-300 bg-emerald-950/60 border border-emerald-800 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Key Verified
          </span>
        )}
        <p className="text-xs text-teal-300/80 leading-relaxed">
          <strong className="text-teal-200">FREE</strong> — no credit card required. DeepSeek has 64K output tokens, handles both BOW extraction and full lesson plan generation. If Gemini is busy or rate-limited, DeepSeek serves as your primary free fallback. Get a key at{' '}
          <a
            href="https://platform.deepseek.com/api_keys"
            target="_blank"
            rel="noreferrer"
            className="font-bold underline text-teal-300 hover:text-teal-100"
          >
            platform.deepseek.com
          </a>
          {' '}(~1 minute, just need an email).
        </p>
      </div>

      {/* 3. CEREBRAS CARD */}
      <div className="bg-[#26150B] border border-[#C05621]/50 rounded-2xl p-5 space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <label className="block text-sm sm:text-base font-bold text-amber-400 flex items-center gap-2">
            <span>⚡</span> Cerebras API Key <span className="text-amber-500 font-normal">(optional — fast but less reliable for structured output)</span>
          </label>
          <button
            onClick={() => openModal('cerebras')}
            className="text-xs font-semibold text-amber-500 hover:text-amber-200 underline"
          >
            How to get a key?
          </button>
        </div>
        <form onSubmit={(e) => e.preventDefault()}>
            <input type="text" name="username" autoComplete="username" className="hidden" tabIndex={-1} />
            <input
                type="password"
                autoComplete="new-password"
                value={cerebrasApiKey}
                onChange={onCerebrasChange}
                placeholder="Paste your Cerebras API key"
                className="w-full bg-slate-900 border border-amber-900/60 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
            />
        </form>
        {isDetectingCerebras && (
          <span className="text-xs text-amber-400 font-semibold flex items-center gap-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying...
          </span>
        )}
        {cerebrasKeyIsValid && !isDetectingCerebras && (
          <span className="text-xs text-emerald-300 bg-emerald-950/60 border border-emerald-800 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Key Verified
          </span>
        )}
        <p className="text-xs text-amber-300/80 leading-relaxed">
          Fast inference speed, but less reliable for structured JSON output. Get a free key at{' '}
          <a
            href="https://cloud.cerebras.ai"
            target="_blank"
            rel="noreferrer"
            className="font-bold underline text-amber-300 hover:text-amber-100"
          >
            cloud.cerebras.ai
          </a>
          {' '}(~1 minute).
        </p>
      </div>

      {/* 4. OPENAI CARD */}
      <div className="bg-[#131B32] border border-[#3B82F6]/40 rounded-2xl p-5 space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <label className="block text-sm sm:text-base font-bold text-indigo-300 flex items-center gap-2">
            <span>🔑</span> OpenAI API Key <span className="text-indigo-400 font-normal">(Optional — paid, final fallback)</span>
          </label>
          <button
            onClick={() => openModal('openai')}
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-200 underline"
          >
            How to get a key?
          </button>
        </div>
        <form onSubmit={(e) => e.preventDefault()}>
            <input
                type="password"
                autoComplete="new-password"
                value={openAiApiKey}
                onChange={onOpenAiChange}
                placeholder="sk-... (Used only if Gemini, DeepSeek, and Cerebras all fail)"
                className="w-full bg-slate-900 border border-indigo-800/60 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
            />
        </form>
        {isDetectingOpenAi && (
          <span className="text-xs text-indigo-400 font-semibold flex items-center gap-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying...
          </span>
        )}
        {openAiKeyIsValid && !isDetectingOpenAi && (
          <span className="text-xs text-emerald-300 bg-emerald-950/60 border border-emerald-800 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Key Verified
          </span>
        )}
        <p className="text-xs text-indigo-300/80 leading-relaxed">
          Last-resort fallback with the highest reliability and token capacity. Get a key at{' '}
          <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="font-bold underline text-indigo-300 hover:text-indigo-100">
            platform.openai.com/api-keys
          </a>
          .
        </p>
      </div>

      <div className="border border-dashed border-indigo-500/40 bg-indigo-950/20 rounded-2xl p-4 sm:p-5 text-indigo-200 text-xs sm:text-sm space-y-1.5">
        <div className="flex items-center gap-2 font-bold text-indigo-300">
          <Lightbulb className="w-4 h-4 text-amber-400 shrink-0" />
          <span>How it works</span>
        </div>
        <p className="text-indigo-300/90 leading-relaxed pl-6">
          Gemini is tried first with a dedicated retry loop. DeepSeek (FREE, 64K tokens) runs concurrently as the primary fallback. Cerebras and OpenAI are used as additional fallbacks if the others fail. Adding DeepSeek gives you a free, high-capacity backup — only Gemini is required.
        </p>
      </div>

      {/* MODEL SELECTION */}
      <div className="pt-2">
        <label className="block text-xs sm:text-sm font-semibold text-slate-300 mb-1.5">Primary Gemini Model</label>
        <select value={selectedModel} onChange={onModelChange} className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-sm font-medium text-slate-200 focus:ring-2 focus:ring-[#F59E0B] focus:outline-none">
          {availableModels.map((model) => (
            <option key={model.id} value={model.id}>{model.name}</option>
          ))}
        </select>
      </div>
      {isModalOpen && (
        <ApiKeyInstructionsModal
            provider={modalProvider}
            onClose={closeModal}
        />
    )}
    </div>
  );
}