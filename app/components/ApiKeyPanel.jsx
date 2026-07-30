'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Lightbulb, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import ApiKeyInstructionsModal from './ApiKeyInstructionsModal';
import { getCookie, setCookie } from '../../lib/cookie';
import {
  parseGeminiModels,
  parseOpenAICompatibleModels,
  getPrimaryModel,
} from '../../lib/model-sorter';

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export default function ApiKeyPanel({
  onApiKeyChange,
  onGroqApiKeyChange,
  onOpenRouterApiKeyChange,
  onGeminiModelsChange,
  onGroqModelsChange,
  onOpenRouterModelsChange,
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalProvider, setModalProvider] = useState('');

  const [apiKey, setApiKey] = useState(() => {
    if (typeof window === 'undefined') return getCookie('apikey') || '';
    return localStorage.getItem('gemini_api_key') || getCookie('apikey') || '';
  });
  const [groqApiKey, setGroqApiKey] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('groq_api_key') || '';
  });
  const [openRouterApiKey, setOpenRouterApiKey] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('openrouter_api_key') || '';
  });

  const [autoDetectStatus, setAutoDetectStatus] = useState('');
  const [isDetecting, setIsDetecting] = useState(false);
  const [keyIsValid, setKeyIsValid] = useState(false);

  const [groqKeyIsValid, setGroqKeyIsValid] = useState(false);
  const [isDetectingGroq, setIsDetectingGroq] = useState(false);
  const [groqDetectStatus, setGroqDetectStatus] = useState('');

  const [openRouterKeyIsValid, setOpenRouterKeyIsValid] = useState(false);
  const [isDetectingOpenRouter, setIsDetectingOpenRouter] = useState(false);
  const [openRouterDetectStatus, setOpenRouterDetectStatus] = useState('');

  // Track detected model lists (latest-first) for each provider.
  const [geminiModelIds, setGeminiModelIds] = useState([]);
  const [groqModelIds, setGroqModelIds] = useState([]);
  const [openRouterModelIds, setOpenRouterModelIds] = useState([]);

  const openModal = (provider) => {
    setModalProvider(provider);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalProvider('');
  };

  // Helper: apply a sorted (latest-first) model list and propagate to parent.
  const applyGeminiModels = useCallback(
    (sortedIds) => {
      if (!Array.isArray(sortedIds) || sortedIds.length === 0) return;
      setGeminiModelIds(sortedIds);
      if (onGeminiModelsChange) onGeminiModelsChange(sortedIds);
    },
    [onGeminiModelsChange]
  );

  // -------------------------------------------------------------------------
  // Gemini: verify key + fetch compatible models
  // -------------------------------------------------------------------------
  const handleAutoDetectModels = useCallback(async (keyToTest) => {
    const targetKey = keyToTest;
    if (!targetKey || targetKey.trim() === '') {
      setAutoDetectStatus('');
      setKeyIsValid(false);
      setGeminiModelIds([]);
      if (onGeminiModelsChange) onGeminiModelsChange([]);
      return;
    }

    setIsDetecting(true);
    setAutoDetectStatus('');

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${targetKey}`);
      const data = await res.json();

      if (data.models && data.models.length > 0) {
        const sortedIds = parseGeminiModels(data.models);

        if (sortedIds.length > 0) {
          applyGeminiModels(sortedIds);
          setKeyIsValid(true);
          setAutoDetectStatus(`Success! Key verified & auto-detected ${sortedIds.length} compatible models (latest first).`);
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
  }, [applyGeminiModels, onGeminiModelsChange]);

  const debouncedAutoDetect = useMemo(
    () => debounce((key) => {
      handleAutoDetectModels(key);
    }, 600),
    [handleAutoDetectModels]
  );

  // -------------------------------------------------------------------------
  // Generic OpenAI-compatible verifier (Groq, OpenRouter)
  // Fetches /v1/models, sorts latest-first, and stores the list.
  // -------------------------------------------------------------------------
  const handleVerifyProviderKey = useCallback(async (provider, key) => {
    if (!key || key.trim() === '') {
      if (provider === 'groq') {
        setGroqKeyIsValid(false);
        setGroqDetectStatus('');
        setGroqModelIds([]);
        if (onGroqModelsChange) onGroqModelsChange([]);
      }
      if (provider === 'openrouter') {
        setOpenRouterKeyIsValid(false);
        setOpenRouterDetectStatus('');
        setOpenRouterModelIds([]);
        if (onOpenRouterModelsChange) onOpenRouterModelsChange([]);
      }
      return;
    }

    let url, options, setDetecting, setValid, setStatus, setModelIds, onModelsChange;

    if (provider === 'groq') {
      url = 'https://api.groq.com/openai/v1/models';
      options = { headers: { Authorization: `Bearer ${key}` } };
      setDetecting = setIsDetectingGroq;
      setValid = setGroqKeyIsValid;
      setStatus = setGroqDetectStatus;
      setModelIds = setGroqModelIds;
      onModelsChange = onGroqModelsChange;
    } else if (provider === 'openrouter') {
      url = 'https://openrouter.ai/api/v1/models';
      options = { headers: { Authorization: `Bearer ${key}` } };
      setDetecting = setIsDetectingOpenRouter;
      setValid = setOpenRouterKeyIsValid;
      setStatus = setOpenRouterDetectStatus;
      setModelIds = setOpenRouterModelIds;
      onModelsChange = onOpenRouterModelsChange;
    } else {
      return;
    }

    setDetecting(true);
    setValid(false);
    setStatus('');

    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        setValid(false);
        const errData = await res.json().catch(() => ({}));
        setStatus(`Error: ${errData.error?.message || `Status ${res.status}`}`);
        setModelIds([]);
        if (onModelsChange) onModelsChange([]);
        return;
      }

      const data = await res.json();
      const sortedIds = parseOpenAICompatibleModels(data.data || data.models || data);

      setValid(true);
      setModelIds(sortedIds);
      if (onModelsChange) onModelsChange(sortedIds);
      if (sortedIds.length > 0) {
        setStatus(`Verified! ${sortedIds.length} compatible models detected (latest first).`);
      } else {
        setStatus('Key verified, but no compatible models found.');
      }
    } catch (err) {
      setValid(false);
      setStatus(`Error: ${err.message}`);
      setModelIds([]);
      if (onModelsChange) onModelsChange([]);
    } finally {
      setDetecting(false);
    }
  }, [onGroqModelsChange, onOpenRouterModelsChange]);

  const debouncedVerifyGroq = useMemo(
    () => debounce((key) => {
      handleVerifyProviderKey('groq', key);
    }, 600),
    [handleVerifyProviderKey]
  );
  const debouncedVerifyOpenRouter = useMemo(
    () => debounce((key) => {
      handleVerifyProviderKey('openrouter', key);
    }, 600),
    [handleVerifyProviderKey]
  );

  const hasHydratedInitialValues = useRef(false);

  useEffect(() => {
    if (hasHydratedInitialValues.current) return;
    hasHydratedInitialValues.current = true;

    const savedGemini = typeof window !== 'undefined' ? localStorage.getItem('gemini_api_key') : null;
    const savedGroq = typeof window !== 'undefined' ? localStorage.getItem('groq_api_key') : null;
    const savedOpenRouter = typeof window !== 'undefined' ? localStorage.getItem('openrouter_api_key') : null;

    if (savedGroq) {
      onGroqApiKeyChange(savedGroq);
      setTimeout(() => handleVerifyProviderKey('groq', savedGroq), 0);
    }
    if (savedOpenRouter) {
      onOpenRouterApiKeyChange(savedOpenRouter);
      setTimeout(() => handleVerifyProviderKey('openrouter', savedOpenRouter), 0);
    }

    if (savedGemini) {
      onApiKeyChange(savedGemini);
      setTimeout(() => handleAutoDetectModels(savedGemini), 0);
    }
  }, [onApiKeyChange, onGroqApiKeyChange, onOpenRouterApiKeyChange, handleAutoDetectModels, handleVerifyProviderKey]);

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

  const onGroqChange = useCallback(
    (e) => {
      const val = e.target.value;
      setGroqApiKey(val);
      localStorage.setItem('groq_api_key', val);
      onGroqApiKeyChange(val);
      debouncedVerifyGroq(val);
    },
    [onGroqApiKeyChange, debouncedVerifyGroq]
  );

  const onOpenRouterChange = useCallback(
    (e) => {
      const val = e.target.value;
      setOpenRouterApiKey(val);
      localStorage.setItem('openrouter_api_key', val);
      onOpenRouterApiKeyChange(val);
      debouncedVerifyOpenRouter(val);
    },
    [onOpenRouterApiKeyChange, debouncedVerifyOpenRouter]
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
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying & detecting models...
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
        {keyIsValid && !autoDetectStatus.startsWith('Error') && autoDetectStatus && (
            <p className="text-xs text-emerald-300/80 font-medium mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> {autoDetectStatus}
            </p>
        )}
        
        <p className="text-xs text-purple-300/80 leading-relaxed">
          Required — free, takes ~2 minutes at{' '}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="font-bold underline text-purple-300 hover:text-purple-100">
            aistudio.google.com/apikey
          </a>
          . Use your existing Gmail account, no separate signup. Keys are stored for this browser session only and are not shared.
        </p>
        {geminiModelIds.length > 0 && (
          <details className="text-xs text-purple-300/70">
            <summary className="cursor-pointer font-semibold text-purple-400 hover:text-purple-200">
              Detected Gemini models ({geminiModelIds.length}, latest first)
            </summary>
            <ol className="mt-1 ml-4 list-decimal space-y-0.5 max-h-32 overflow-y-auto">
              {geminiModelIds.map((m) => <li key={m} className="font-mono text-[11px]">{m}</li>)}
            </ol>
          </details>
        )}
      </div>

      {/* 2. GROQ CARD — FREE, fast inference */}
      <div className="bg-[#0F1A1F] border border-[#2DD4BF]/40 rounded-2xl p-5 space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <label className="block text-sm sm:text-base font-bold text-teal-300 flex items-center gap-2">
            <span>⚡</span> Groq API Key <span className="text-teal-400 font-normal">(strongly recommended — FREE)</span>
          </label>
          <button
            onClick={() => openModal('groq')}
            className="text-xs font-semibold text-teal-400 hover:text-teal-200 underline"
          >
            How to get a key?
          </button>
        </div>
        <form onSubmit={(e) => e.preventDefault()}>
            <input
                type="password"
                autoComplete="new-password"
                value={groqApiKey}
                onChange={onGroqChange}
                placeholder="Paste your Groq API key (free, fast inference)"
                className={`w-full bg-slate-900 border rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 focus:ring-2 focus:outline-none font-mono ${
                  groqDetectStatus.startsWith('Error')
                    ? 'border-red-500/60 focus:ring-red-500'
                    : groqKeyIsValid
                    ? 'border-emerald-500/60 focus:ring-emerald-500'
                    : 'border-teal-800/60 focus:ring-teal-500'
                }`}
            />
        </form>
        {isDetectingGroq && (
          <span className="text-xs text-teal-400 font-semibold flex items-center gap-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying & detecting models...
          </span>
        )}
        {groqKeyIsValid && !isDetectingGroq && (
          <span className="text-xs text-emerald-300 bg-emerald-950/60 border border-emerald-800 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Key Verified
          </span>
        )}
        {groqDetectStatus.startsWith('Error') && (
          <p className="text-xs text-red-400 font-medium mt-1 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {groqDetectStatus}
          </p>
        )}
        {groqKeyIsValid && !groqDetectStatus.startsWith('Error') && groqDetectStatus && (
          <p className="text-xs text-emerald-300/80 font-medium mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> {groqDetectStatus}
          </p>
        )}
        <p className="text-xs text-teal-300/80 leading-relaxed">
          <strong className="text-teal-200">FREE</strong> — no credit card required. Groq provides extremely fast inference on open-source models like Llama and Mixtral. Get a key at{' '}
          <a
            href="https://console.groq.com/keys"
            target="_blank"
            rel="noreferrer"
            className="font-bold underline text-teal-300 hover:text-teal-100"
          >
            console.groq.com
          </a>
          {' '}(~1 minute, just need an email).
        </p>
        {groqModelIds.length > 0 && (
          <details className="text-xs text-teal-300/70">
            <summary className="cursor-pointer font-semibold text-teal-400 hover:text-teal-200">
              Detected Groq models ({groqModelIds.length}, latest first)
            </summary>
            <ol className="mt-1 ml-4 list-decimal space-y-0.5 max-h-32 overflow-y-auto">
              {groqModelIds.map((m) => <li key={m} className="font-mono text-[11px]">{m}</li>)}
            </ol>
          </details>
        )}
      </div>

      {/* 3. OPENROUTER CARD — access to many models */}
      <div className="bg-[#131B32] border border-[#3B82F6]/40 rounded-2xl p-5 space-y-3 shadow-md">
        <div className="flex items-center justify-between">
          <label className="block text-sm sm:text-base font-bold text-indigo-300 flex items-center gap-2">
            <span>🔀</span> OpenRouter API Key <span className="text-indigo-400 font-normal">(optional — access to GPT-4, Claude, and more)</span>
          </label>
          <button
            onClick={() => openModal('openrouter')}
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-200 underline"
          >
            How to get a key?
          </button>
        </div>
        <form onSubmit={(e) => e.preventDefault()}>
            <input
                type="password"
                autoComplete="new-password"
                value={openRouterApiKey}
                onChange={onOpenRouterChange}
                placeholder="Paste your OpenRouter API key"
                className={`w-full bg-slate-900 border rounded-xl p-3 text-sm text-slate-100 placeholder-slate-500 focus:ring-2 focus:outline-none font-mono ${
                  openRouterDetectStatus.startsWith('Error')
                    ? 'border-red-500/60 focus:ring-red-500'
                    : openRouterKeyIsValid
                    ? 'border-emerald-500/60 focus:ring-emerald-500'
                    : 'border-indigo-800/60 focus:ring-indigo-500'
                }`}
            />
        </form>
        {isDetectingOpenRouter && (
          <span className="text-xs text-indigo-400 font-semibold flex items-center gap-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying & detecting models...
          </span>
        )}
        {openRouterKeyIsValid && !isDetectingOpenRouter && (
          <span className="text-xs text-emerald-300 bg-emerald-950/60 border border-emerald-800 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Key Verified
          </span>
        )}
        {openRouterDetectStatus.startsWith('Error') && (
          <p className="text-xs text-red-400 font-medium mt-1 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {openRouterDetectStatus}
          </p>
        )}
        {openRouterKeyIsValid && !openRouterDetectStatus.startsWith('Error') && openRouterDetectStatus && (
          <p className="text-xs text-emerald-300/80 font-medium mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> {openRouterDetectStatus}
          </p>
        )}
        <p className="text-xs text-indigo-300/80 leading-relaxed">
          Provides access to a wide range of models including GPT-4, Claude, Gemini, and more through a single API. Get a key at{' '}
          <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="font-bold underline text-indigo-300 hover:text-indigo-100">
            openrouter.ai/keys
          </a>
          .
        </p>
        {openRouterModelIds.length > 0 && (
          <details className="text-xs text-indigo-300/70">
            <summary className="cursor-pointer font-semibold text-indigo-400 hover:text-indigo-200">
              Detected OpenRouter models ({openRouterModelIds.length}, latest first)
            </summary>
            <ol className="mt-1 ml-4 list-decimal space-y-0.5 max-h-32 overflow-y-auto">
              {openRouterModelIds.map((m) => <li key={m} className="font-mono text-[11px]">{m}</li>)}
            </ol>
          </details>
        )}
      </div>

      <div className="border border-dashed border-indigo-500/40 bg-indigo-950/20 rounded-2xl p-4 sm:p-5 text-indigo-200 text-xs sm:text-sm space-y-1.5">
        <div className="flex items-center gap-2 font-bold text-indigo-300">
          <Lightbulb className="w-4 h-4 text-amber-400 shrink-0" />
          <span>How it works</span>
        </div>
        <p className="text-indigo-300/90 leading-relaxed pl-6">
          Gemini is tried first with a dedicated retry loop. Groq (FREE, fast inference) runs concurrently as the primary fallback. OpenRouter is used as an additional fallback if the others fail. Only Gemini is required.
        </p>
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